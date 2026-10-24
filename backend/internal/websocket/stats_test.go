package websocket

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"slf/internal/stats"
)

func TestHandleTrack(t *testing.T) {
	path := filepath.Join(t.TempDir(), "events.jsonl")
	l, err := stats.Open(path)
	if err != nil {
		t.Fatal(err)
	}
	hub := NewHub()
	hub.Stats = l
	for _, p := range []string{
		`{"ev":"world","value":"candy"}`,
		`{"ev":"musicOff","scene":"play"}`,
		`{"ev":"hack","value":"x"}`,
		`{"ev":"world","value":"<script>"}`,
	} {
		handleTrack(hub, json.RawMessage(p))
	}
	b, _ := os.ReadFile(path)
	if n := strings.Count(string(b), "\n"); n != 2 {
		t.Fatalf("%d events: %s", n, b)
	}
}
