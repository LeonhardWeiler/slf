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

	p := build(l.read())
	if m := p.Modes[0]; m.Started != 1 || m.Finished != 1 || m.Minutes != "2.0" {
		t.Fatalf("solo = %+v", m)
	}
	rec := httptest.NewRecorder()
	l.ServeHTTP(rec, httptest.NewRequest("GET", "/", nil))
	if !strings.Contains(rec.Body.String(), "AlphabetFinished") {
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
