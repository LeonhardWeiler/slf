// Package stats appends usage events to a JSON-lines file and renders them as
// a small dashboard.
package stats

import (
	"bufio"
	"encoding/json"
	"fmt"
	"html/template"
	"log"
	"net/http"
	"os"
	"sort"
	"sync"
	"time"
)

type Event struct {
	T           time.Time `json:"t"`
	Ev          string    `json:"ev"`
	Mode        string    `json:"mode,omitempty"`
	Players     int       `json:"players,omitempty"`
	Rounds      int       `json:"rounds,omitempty"`
	Seconds     int       `json:"seconds,omitempty"`
	Reason      string    `json:"reason,omitempty"`
	Limit       int       `json:"limit,omitempty"`
	Cats        int       `json:"cats,omitempty"`
	LastLetter  bool      `json:"lastLetter,omitempty"`
	Commentator bool      `json:"commentator,omitempty"`
	Value       string    `json:"value,omitempty"`
	Scene       string    `json:"scene,omitempty"`
}

// Log is nil when stats are off; Add is then a no-op.
type Log struct {
	mu   sync.Mutex
	path string
	f    *os.File
}

func Open(path string) (*Log, error) {
	f, err := os.OpenFile(path, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o600)
	if err != nil {
		return nil, err
	}
	return &Log{path: path, f: f}, nil
}

func (l *Log) Add(e Event) {
	if l == nil {
		return
	}
	e.T = time.Now().UTC()
	b, _ := json.Marshal(e)
	l.mu.Lock()
	defer l.mu.Unlock()
	if _, err := l.f.Write(append(b, '\n')); err != nil {
		log.Printf("stats: %v", err)
	}
}

func (l *Log) read() []Event {
	f, err := os.Open(l.path)
	if err != nil {
		return nil
	}
	defer f.Close()
	var out []Event
	sc := bufio.NewScanner(f)
	for sc.Scan() {
		var e Event
		if json.Unmarshal(sc.Bytes(), &e) == nil {
			out = append(out, e)
		}
	}
	return out
}

type row struct {
	Key   string
	N     int
	Extra string
}

type mode struct {
	Mode                     string
	Started, Ended, Finished int
	Minutes, Rounds, Players string
}

type page struct {
	Since              string
	Modes              []mode
	Days, Limits, Ends []row
	Worlds, Music      []row
	LastLetter, Comm   int
	Ended              int
}

func rows(m map[string]int, extra func(string) string) []row {
	var out []row
	for k, n := range m {
		r := row{Key: k, N: n}
		if extra != nil {
			r.Extra = extra(k)
		}
		out = append(out, r)
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].N != out[j].N {
			return out[i].N > out[j].N
		}
		return out[i].Key < out[j].Key
	})
	return out
}

func avg(sum, n int) string {
	if n == 0 {
		return "–"
	}
	return fmt.Sprintf("%.1f", float64(sum)/float64(n))
}

func build(evs []Event) page {
	var p page
	if len(evs) > 0 {
		p.Since = evs[0].T.Format("2006-01-02")
	}
	type acc struct{ started, ended, finished, secs, rounds, players int }
	modes := map[string]*acc{}
	get := func(m string) *acc {
		if modes[m] == nil {
			modes[m] = &acc{}
		}
		return modes[m]
	}
	days, limits, ends := map[string]int{}, map[string]int{}, map[string]int{}
	worlds, worldEnds, music := map[string]int{}, map[string]int{}, map[string]int{}
	for _, e := range evs {
		switch e.Ev {
		case "start":
			get(e.Mode).started++
			days[e.T.Format("2006-01-02")]++
		case "end":
			a := get(e.Mode)
			a.ended++
			a.secs += e.Seconds
			a.rounds += e.Rounds
			a.players += e.Players
			if e.Reason == "AlphabetFinished" {
				a.finished++
			}
			p.Ended++
			ends[e.Reason]++
			if e.Limit == 0 {
				limits["ohne"]++
			} else {
				limits[fmt.Sprintf("%ds", e.Limit)]++
			}
			if e.LastLetter {
				p.LastLetter++
			}
			if e.Commentator {
				p.Comm++
			}
		case "world":
			worlds[e.Value]++
		case "leave":
			worldEnds[e.Value]++
			worlds[e.Value] += 0
		case "musicOff", "mute":
			music[e.Ev+" in "+e.Scene]++
		}
	}
	for _, k := range []string{"solo", "classic"} {
		a := get(k)
		p.Modes = append(p.Modes, mode{
			Mode: k, Started: a.started, Ended: a.ended, Finished: a.finished,
			Minutes: avg(a.secs, a.ended*60), Rounds: avg(a.rounds, a.ended),
			Players: avg(a.players, a.ended),
		})
	}
	p.Days = rows(days, nil)
	sort.Slice(p.Days, func(i, j int) bool { return p.Days[i].Key > p.Days[j].Key })
	if len(p.Days) > 30 {
		p.Days = p.Days[:30]
	}
	p.Limits = rows(limits, nil)
	p.Ends = rows(ends, nil)
	p.Worlds = rows(worlds, func(w string) string {
		return fmt.Sprintf("%d verlassen", worldEnds[w])
	})
	p.Music = rows(music, nil)
	return p
}

var tpl = template.Must(template.New("").Parse(`<!doctype html>
<meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>SLF Stats</title>
<style>
body{font:15px system-ui;max-width:760px;margin:24px auto;padding:0 12px;color:#333}
table{border-collapse:collapse;width:100%;margin-bottom:24px}
td,th{padding:6px 8px;border-bottom:1px solid #eee;text-align:left}
th{color:#888;font-weight:500}td.n{text-align:right;font-variant-numeric:tabular-nums}
</style>
<h1>Stadt Land Fluss</h1>
<p>Seit {{.Since}}. {{.Ended}} Spiele beendet, davon {{.LastLetter}} mit letztem Buchstaben, {{.Comm}} mit Kommentator.</p>
<h2>Modi</h2>
<table><tr><th>Modus<th>gestartet<th>beendet<th>durchgespielt<th>Ø Minuten<th>Ø Runden<th>Ø Spieler
{{range .Modes}}<tr><td>{{.Mode}}<td class=n>{{.Started}}<td class=n>{{.Ended}}<td class=n>{{.Finished}}<td class=n>{{.Minutes}}<td class=n>{{.Rounds}}<td class=n>{{.Players}}{{end}}</table>
<h2>Welten</h2><p>Runden pro Welt und wie oft jemand in dieser Welt das Spiel verlassen hat.</p>
<table>{{range .Worlds}}<tr><td>{{.Key}}<td class=n>{{.N}}<td>{{.Extra}}{{end}}</table>
<h2>Musik</h2><p>Wie oft Musik oder Ton in einer Szene ausgeschaltet wurde.</p>
<table>{{range .Music}}<tr><td>{{.Key}}<td class=n>{{.N}}{{end}}</table>
<h2>Zeitlimit</h2>
<table>{{range .Limits}}<tr><td>{{.Key}}<td class=n>{{.N}}{{end}}</table>
<h2>Spielende</h2>
<table>{{range .Ends}}<tr><td>{{.Key}}<td class=n>{{.N}}{{end}}</table>
<h2>Spiele pro Tag</h2>
<table>{{range .Days}}<tr><td>{{.Key}}<td class=n>{{.N}}{{end}}</table>
`))

func (l *Log) ServeHTTP(w http.ResponseWriter, _ *http.Request) {
	l.mu.Lock()
	evs := l.read()
	l.mu.Unlock()
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	if err := tpl.Execute(w, build(evs)); err != nil {
		log.Printf("stats: %v", err)
	}
}
