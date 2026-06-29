package main

import (
	"log"
	"net/http"

	"slf/internal/websocket"
)

func main() {
	hub := websocket.NewHub()
	go hub.Run()

	http.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		websocket.ServeWS(hub, w, r)
	})

	log.Println("Server läuft auf :8080")
	err := http.ListenAndServe(":8080", nil)
	if err != nil {
		log.Fatal(err)
	}
}
