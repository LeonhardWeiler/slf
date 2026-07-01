package main

import (
	"context"
	"io"
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
	hub.StartJanitor() // reap abandoned lobbies

	mux := http.NewServeMux()

	mux.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		websocket.ServeWS(hub, w, r)
	})

	mux.HandleFunc("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	})

	// When STATIC_DIR is set (production / single-image Docker), the Go server
	// also serves the built frontend and falls back to index.html so client-side
	// routes (/join/:code, /lobby) resolve. In dev this is empty and the frontend
	// is served by Vite instead.
	if staticDir := os.Getenv("STATIC_DIR"); staticDir != "" {
		mux.Handle("/", spaHandler(staticDir))
		log.Printf("Serviere Frontend aus %s", staticDir)
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

	// Stop accepting new connections on SIGINT/SIGTERM (e.g. `docker stop`) and
	// shut down cleanly instead of being killed mid-request.
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	go func() {
		log.Printf("Server läuft auf %s", addr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server-Fehler: %v", err)
		}
	}()

	<-ctx.Done()
	stop() // a second signal now terminates immediately
	log.Println("Fahre herunter…")

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Printf("Shutdown-Fehler: %v", err)
	}
	log.Println("Server beendet")
}

// setupLogging configures the global slog logger from the environment
// (SRS 12.9). LOG_LEVEL: debug|info|warn|error (default info). LOG_FORMAT:
// text|json (default text). LOG_FILE: if set, logs are appended to that file in
// addition to stdout — in Docker this path lives on a volume (see compose).
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
			log.Printf("Konnte Logdatei %s nicht öffnen: %v", lf, err)
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
// attributes → 'unsafe-inline' for style only), data: images (QR canvas),
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
	h.Set("Permissions-Policy", "camera=(self), microphone=(), geolocation=()")
	// Only honoured by browsers over HTTPS (ignored on plain-HTTP localhost/LAN),
	// so it is safe to always send and hardens a future TLS/domain deployment.
	h.Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
}

// spaHandler serves static files from dir and falls back to index.html for
// paths that do not map to an existing file (single-page-app routing).
func spaHandler(dir string) http.Handler {
	fs := http.FileServer(http.Dir(dir))
	index := filepath.Join(dir, "index.html")
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		securityHeaders(w.Header())
		clean := filepath.Clean(r.URL.Path)
		path := filepath.Join(dir, clean)
		// Only serve a real file inside dir; otherwise hand the SPA its entrypoint.
		if info, err := os.Stat(path); err == nil && !info.IsDir() {
			fs.ServeHTTP(w, r)
			return
		}
		http.ServeFile(w, r, index)
	})
}
