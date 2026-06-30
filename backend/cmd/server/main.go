package main

import (
	"log"
	"net/http"

	"slf/internal/websocket"
)

func main() {
	hub := websocket.NewHub()

	http.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		websocket.ServeWS(hub, w, r)
	})

	log.Println("Server läuft auf :8080")
	if err := http.ListenAndServe("0.0.0.0:8080", nil); err != nil {
		log.Fatal(err)
	}
}
