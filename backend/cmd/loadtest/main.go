// Command loadtest measures the server's WebSocket roundtrip latency under
// concurrent load, as an isolated, reproducible check against the SRS
// performance targets (13.2 / 14.11: < 80 ms avg, < 150 ms max roundtrip,
// >= 500 gleichzeitige Spieler).
//
// It spins up -lobbies lobbies with -perLobby players each (a host + joiners),
// then repeatedly has every host trigger a state change (updateSettings) and
// measures, for every connected client, the time until the resulting broadcast
// (lobbyState) arrives. All lobbies fire concurrently, so with the defaults
// (20 x 25) 500 players are connected and synchronised at once.
//
// Run against a locally running server for the most isolated measurement:
//
//	go run ./cmd/server &                 # in one shell
//	go run ./cmd/loadtest -players 500    # in another
package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"math"
	"sort"
	"sync"
	"sync/atomic"
	"time"

	"github.com/coder/websocket"
)

type inbound struct {
	Type    string `json:"type"`
	Payload struct {
		SessionID string `json:"sessionId"`
		LobbyCode string `json:"lobbyCode"`
	} `json:"payload"`
}

type client struct {
	conn      *websocket.Conn
	sessionID string
	lobbyCode string
	isHost    bool
	armed     atomic.Bool
}

var (
	startNanos atomic.Int64
	results    chan time.Duration
)

func main() {
	addr := flag.String("addr", "ws://localhost:8080/ws", "server WebSocket URL")
	lobbies := flag.Int("lobbies", 20, "number of lobbies")
	perLobby := flag.Int("perLobby", 25, "players per lobby (incl. host)")
	players := flag.Int("players", 0, "total players (overrides -lobbies, distributed over -perLobby)")
	iters := flag.Int("iters", 20, "measured broadcast rounds")
	flag.Parse()

	if *players > 0 {
		*lobbies = (*players + *perLobby - 1) / *perLobby // ceil
	}

	total := *lobbies * *perLobby
	results = make(chan time.Duration, total)
	log.Printf("Verbinde %d Spieler (%d Lobbies × %d)…", total, *lobbies, *perLobby)

	ctx := context.Background()
	var clients []*client
	var hosts []*client
	var mu sync.Mutex

	// 1) Create all hosts (each creates a lobby).
	var wg sync.WaitGroup
	for i := 0; i < *lobbies; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			c := dial(ctx, *addr)
			c.isHost = true
			c.send(ctx, "createLobby", map[string]any{"playerName": fmt.Sprintf("host%d", i)})
			c.waitForSetup(ctx, true)
			go c.readLoop(ctx)
			mu.Lock()
			clients = append(clients, c)
			hosts = append(hosts, c)
			mu.Unlock()
		}(i)
	}
	wg.Wait()

	// 2) Join the remaining players into each lobby.
	for li, h := range hosts {
		for j := 1; j < *perLobby; j++ {
			wg.Add(1)
			go func(code string, li, j int) {
				defer wg.Done()
				c := dial(ctx, *addr)
				c.send(ctx, "joinLobby", map[string]any{
					"playerName": fmt.Sprintf("p%d_%d", li, j),
					"lobbyCode":  code,
				})
				c.waitForSetup(ctx, false)
				go c.readLoop(ctx)
				mu.Lock()
				clients = append(clients, c)
				mu.Unlock()
			}(h.lobbyCode, li, j)
		}
	}
	wg.Wait()
	log.Printf("%d Spieler verbunden. Messe %d Runden…", len(clients), *iters)

	// 3) Measurement rounds: every host toggles a setting simultaneously; every
	// client times the resulting lobbyState broadcast.
	var samples []time.Duration
	toggle := false
	for it := 0; it < *iters; it++ {
		toggle = !toggle
		for _, c := range clients {
			c.armed.Store(true)
		}
		startNanos.Store(time.Now().UnixNano())
		for _, h := range hosts {
			h.send(ctx, "updateSettings", map[string]any{
				"timeLimit":                 nil,
				"showLetterDuringCountdown": toggle,
				"excludedLetters":           []string{},
			})
		}
		deadline := time.After(3 * time.Second)
		got := 0
	collect:
		for got < len(clients) {
			select {
			case d := <-results:
				samples = append(samples, d)
				got++
			case <-deadline:
				log.Printf("Runde %d: nur %d/%d Antworten (Timeout)", it+1, got, len(clients))
				break collect
			}
		}
	}

	report(samples, total)
	for _, c := range clients {
		_ = c.conn.Close(websocket.StatusNormalClosure, "")
	}
}

func dial(ctx context.Context, addr string) *client {
	conn, _, err := websocket.Dial(ctx, addr, nil)
	if err != nil {
		log.Fatalf("Dial fehlgeschlagen: %v", err)
	}
	conn.SetReadLimit(1 << 20)
	return &client{conn: conn}
}

func (c *client) send(ctx context.Context, typ string, payload any) {
	b, _ := json.Marshal(map[string]any{"type": typ, "payload": payload, "sessionId": c.sessionID})
	if err := c.conn.Write(ctx, websocket.MessageText, b); err != nil {
		log.Fatalf("Write fehlgeschlagen: %v", err)
	}
}

// waitForSetup reads until the session (and, for hosts, the lobby code) is known.
func (c *client) waitForSetup(ctx context.Context, host bool) {
	for c.sessionID == "" || (host && c.lobbyCode == "") {
		var m inbound
		if !c.read(ctx, &m) {
			log.Fatal("Verbindung während Setup verloren")
		}
		switch m.Type {
		case "sessionCreated":
			c.sessionID = m.Payload.SessionID
		case "lobbyState":
			if m.Payload.LobbyCode != "" {
				c.lobbyCode = m.Payload.LobbyCode
			}
		}
	}
}

func (c *client) read(ctx context.Context, m *inbound) bool {
	_, data, err := c.conn.Read(ctx)
	if err != nil {
		return false
	}
	return json.Unmarshal(data, m) == nil
}

// readLoop records a latency sample for the first lobbyState received after the
// measurement was armed.
func (c *client) readLoop(ctx context.Context) {
	for {
		var m inbound
		if !c.read(ctx, &m) {
			return
		}
		if m.Type == "lobbyState" && c.armed.CompareAndSwap(true, false) {
			d := time.Duration(time.Now().UnixNano() - startNanos.Load())
			results <- d
		}
	}
}

func report(samples []time.Duration, players int) {
	if len(samples) == 0 {
		log.Fatal("Keine Messwerte erfasst")
	}
	sort.Slice(samples, func(i, j int) bool { return samples[i] < samples[j] })
	var sum time.Duration
	for _, d := range samples {
		sum += d
	}
	avg := sum / time.Duration(len(samples))
	pct := func(p float64) time.Duration {
		idx := int(math.Ceil(p/100*float64(len(samples)))) - 1
		if idx < 0 {
			idx = 0
		}
		return samples[idx]
	}
	ms := func(d time.Duration) string { return fmt.Sprintf("%.2f ms", float64(d.Microseconds())/1000) }

	fmt.Println("\n===== Ergebnis =====")
	fmt.Printf("Spieler gleichzeitig: %d\n", players)
	fmt.Printf("Messwerte:            %d\n", len(samples))
	fmt.Printf("Ø (avg):             %s   (SRS-Ziel < 80 ms)\n", ms(avg))
	fmt.Printf("p50:                 %s\n", ms(pct(50)))
	fmt.Printf("p95:                 %s\n", ms(pct(95)))
	fmt.Printf("p99:                 %s\n", ms(pct(99)))
	fmt.Printf("max:                 %s   (SRS-Ziel < 150 ms)\n", ms(samples[len(samples)-1]))
	okAvg, okMax := avg < 80*time.Millisecond, samples[len(samples)-1] < 150*time.Millisecond
	fmt.Printf("Ziele erfüllt:        Ø %v · max %v\n", okAvg, okMax)
}
