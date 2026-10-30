package stats

import (
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"
)

func TestDashboard(t *testing.T) {
	l, err := Open(filepath.Join(t.TempDir(), "events.jsonl"))
	if err != nil {
		t.Fatal(err)
	}
	l.Add(Event{Ev: "start", Mode: "solo"})
	l.Add(Event{Ev: "end", Mode: "solo", Seconds: 120, Rounds: 1, Players: 1, Reason: "AlphabetFinished", Limit: 90})
	l.Add(Event{Ev: "world", Value: "candy"})
	l.Add(Event{Ev: "leave", Value: "candy"})
	l.Add(Event{Ev: "leave", Value: "ink"})
	l.Add(Event{Ev: "musicOff", Scene: "play"})

	p := build(l.read())
	if m := p.Modes[0]; m.Started != 1 || m.Finished != 1 || m.Minutes != "2.0" {
		t.Fatalf("solo = %+v", m)
	}
	if w := p.Worlds; len(w) != 2 || w[0].Extra != "1 verlassen" || w[1].Key != "ink" || w[1].N != 0 {
		t.Fatalf("worlds = %+v", p.Worlds)
	}
	rec := httptest.NewRecorder()
	l.ServeHTTP(rec, httptest.NewRequest("GET", "/", nil))
	if !strings.Contains(rec.Body.String(), "musicOff in play") {
		t.Fatal(rec.Body.String())
	}
}

func TestNilLog(t *testing.T) {
	var l *Log
	l.Add(Event{Ev: "start"})
}

func TestAddStopsAtMaxSize(t *testing.T) {
	l, err := Open(filepath.Join(t.TempDir(), "events.jsonl"))
	if err != nil {
		t.Fatal(err)
	}
	l.size = maxSize - 10
	l.Add(Event{Ev: "start"})
	if l.size != maxSize-10 {
		t.Fatalf("size = %d", l.size)
	}
}
