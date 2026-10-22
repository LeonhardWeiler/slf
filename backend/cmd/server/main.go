package main

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"io"
	"io/fs"
	"log"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"
	"time"

	"slf/internal/websocket"
)

func main() {
	setupLogging()

	hub := websocket.NewHub()
	// STATE_DIRECTORY (set by systemd) keeps idle lobbies across a restart.
	stateFile := ""
	if dir := os.Getenv("STATE_DIRECTORY"); dir != "" {
		stateFile = filepath.Join(dir, "lobbies.json")
		if err := hub.Load(stateFile); err != nil {
			log.Printf("Restoring lobbies failed: %v", err)
		}
	}
	hub.StartJanitor() // reap abandoned lobbies

	mux := http.NewServeMux()

	mux.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		websocket.ServeWS(hub, w, r)
	})

	mux.HandleFunc("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	})

	// When STATIC_DIR is set (production), the Go server
	// also serves the built frontend and falls back to index.html so client-side
	// routes (/ and /join/:code, where the active lobby also lives) resolve. In
	// dev this is empty and the frontend is served by Vite instead.
	if staticDir := os.Getenv("STATIC_DIR"); staticDir != "" {
		mux.Handle("/", spaHandler(staticDir))
		log.Printf("Serving frontend from %s", staticDir)
	}

	addr := "0.0.0.0:8080"
	srv := &http.Server{
		Addr:    addr,
		Handler: mux,
		// Bound the handshake/header read against slowloris. No ReadTimeout/
		// WriteTimeout: they would kill long-lived WebSocket connections (which
		// coder/websocket manages with its own deadlines after the upgrade).
		ReadHeaderTimeout: 10 * time.Second,
		IdleTimeout:       120 * time.Second,
	}

	// SIGINT/SIGTERM stop now. SIGHUP (systemd reload on deploy) first lets
	// running games finish, at most for an hour.
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	hup := make(chan os.Signal, 1)
	signal.Notify(hup, syscall.SIGHUP)

	go func() {
		log.Printf("Server listening on %s", addr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server error: %v", err)
		}
	}()

	select {
	case <-ctx.Done():
	case <-hup:
		log.Println("Draining…")
		drainCtx, cancel := context.WithTimeout(ctx, time.Hour)
		hub.Drain(drainCtx)
		cancel()
	}
	stop() // a second signal now terminates immediately
	log.Println("Shutting down…")
	if stateFile != "" {
		if err := hub.Save(stateFile); err != nil {
			log.Printf("Saving lobbies failed: %v", err)
		}
	}

	// Cleanly close all live WebSockets (1001) so clients reconnect gracefully
	// instead of seeing a hard drop when the process exits.
	hub.Shutdown()

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Printf("Shutdown error: %v", err)
	}
	log.Println("Server stopped")
}

// setupLogging configures the global slog logger from the environment
// (SRS 12.9). LOG_LEVEL: debug|info|warn|error (default info). LOG_FORMAT:
// text|json (default text). LOG_FILE: if set, logs are appended to that file in
// addition to stdout.
func setupLogging() {
	level := slog.LevelInfo
	switch strings.ToLower(os.Getenv("LOG_LEVEL")) {
	case "debug":
		level = slog.LevelDebug
	case "warn":
		level = slog.LevelWarn
	case "error":
		level = slog.LevelError
	}

	var w io.Writer = os.Stdout
	if lf := os.Getenv("LOG_FILE"); lf != "" {
		f, err := os.OpenFile(lf, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o644)
		if err != nil {
			log.Printf("Could not open log file %s: %v", lf, err)
		} else {
			w = io.MultiWriter(os.Stdout, f)
		}
	}

	opts := &slog.HandlerOptions{Level: level}
	var h slog.Handler = slog.NewTextHandler(w, opts)
	if strings.ToLower(os.Getenv("LOG_FORMAT")) == "json" {
		h = slog.NewJSONHandler(w, opts)
	}
	slog.SetDefault(slog.New(h))
}

// securityHeaders applies a strict-but-functional set of headers to the served
// SPA. The CSP allows: same-origin scripts/styles (React sets inline style
// attributes -> 'unsafe-inline' for style only), data: images (QR canvas),
// same-origin WebSocket (ws/wss for /ws), and blob: workers (qr-scanner).
// getUserMedia for the QR scanner needs camera=(self) in Permissions-Policy.
func securityHeaders(h http.Header) {
	h.Set("Content-Security-Policy",
		"default-src 'self'; base-uri 'self'; frame-ancestors 'none'; "+
			"object-src 'none'; form-action 'self'; img-src 'self' data:; "+
			"style-src 'self' 'unsafe-inline'; "+
			// The only inline script is the pre-paint theme switcher in
			// frontend/index.html (anti-FOUC). Its sha256 is allow-listed so we do
			// NOT need 'unsafe-inline' for scripts. If that snippet changes, update
			// this hash (the browser console prints the expected value).
			"script-src 'self' 'sha256-4sXzUGvzAZlY5lT80QJC2LfIdvaAGVrh73rtFO9aWVQ='; "+
			"connect-src 'self'; worker-src 'self' blob:; font-src 'self'")
	h.Set("X-Content-Type-Options", "nosniff")
	h.Set("Referrer-Policy", "no-referrer")
	h.Set("X-Frame-Options", "DENY")
	// Isolate our browsing context from any window that opened us (defence in
	// depth against cross-origin popup/opener attacks).
	h.Set("Cross-Origin-Opener-Policy", "same-origin")
	h.Set("Permissions-Policy", "camera=(self), microphone=(), geolocation=()")
	// Only honoured by browsers over HTTPS (ignored on plain-HTTP localhost/LAN),
	// so it is safe to always send and hardens a future TLS/domain deployment.
	h.Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload")
}

// spaHandler serves static files from dir and falls back to index.html for
// paths that do not map to an existing file (single-page-app routing), except
// under /assets/, where a missing chunk is a 404. A precompressed sibling (.br,
// .gz from the build) is served when the client accepts it. Every file carries
// a content-hash ETag and no Last-Modified: the Nix store pins all mtimes to
// 1970, so a date never changes across deploys.
func spaHandler(dir string) http.Handler {
	etags := map[string]string{}
	_ = filepath.WalkDir(dir, func(p string, d fs.DirEntry, err error) error {
		if err != nil || d.IsDir() {
			return err
		}
		b, err := os.ReadFile(p)
		if err != nil {
			return err
		}
		sum := sha256.Sum256(b)
		etags[p] = `"` + hex.EncodeToString(sum[:8]) + `"`
		return nil
	})
	index := filepath.Join(dir, "index.html")
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		h := w.Header()
		securityHeaders(h)
		h.Set("Vary", "Accept-Encoding")
		asset := strings.HasPrefix(r.URL.Path, "/assets/")
		path := filepath.Join(dir, filepath.Clean(r.URL.Path))
		if _, ok := etags[path]; !ok {
			if asset {
				http.NotFound(w, r)
				return
			}
			path = index
		}
		if asset {
			h.Set("Cache-Control", "public, max-age=31536000, immutable")
		} else {
			h.Set("Cache-Control", "no-cache")
		}
		name := path
		accept := r.Header.Get("Accept-Encoding")
		for _, enc := range [][2]string{{"br", ".br"}, {"gzip", ".gz"}} {
			if _, ok := etags[path+enc[1]]; ok && strings.Contains(accept, enc[0]) {
				h.Set("Content-Encoding", enc[0])
				path += enc[1]
				break
			}
		}
		f, err := os.Open(path)
		if err != nil {
			http.NotFound(w, r)
			return
		}
		defer f.Close()
		h.Set("ETag", etags[path])
		http.ServeContent(w, r, name, time.Time{}, f)
	})
}
