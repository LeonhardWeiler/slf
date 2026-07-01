package main

import (
	"log"
	"net/http"
	"os"
	"path/filepath"

	"slf/internal/websocket"
)

func main() {
	hub := websocket.NewHub()

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
	log.Printf("Server läuft auf %s", addr)
	if err := http.ListenAndServe(addr, mux); err != nil {
		log.Fatal(err)
	}
}

// spaHandler serves static files from dir and falls back to index.html for
// paths that do not map to an existing file (single-page-app routing).
func spaHandler(dir string) http.Handler {
	fs := http.FileServer(http.Dir(dir))
	index := filepath.Join(dir, "index.html")
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
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
