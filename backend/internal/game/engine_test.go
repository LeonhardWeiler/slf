package game

import "testing"

func TestNormalize(t *testing.T) {
	cases := map[string]string{
		"  berlin ": "Berlin",
		"BERLIN":    "Berlin",
		"bAyErN":    "Bayern",
		"":          "",
		"   ":       "",
		"a":         "A",
	}
	for in, want := range cases {
		if got := Normalize(in); got != want {
			t.Errorf("Normalize(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestIsRuleValid(t *testing.T) {
	if !IsRuleValid("B", " berlin") {
		t.Error("'berlin' should be valid for letter B")
	}
	if IsRuleValid("B", "Aachen") {
		t.Error("'Aachen' should be invalid for letter B")
	}
	if IsRuleValid("B", "   ") {
		t.Error("empty should be invalid")
	}
}

func mkAnswers(m map[string]string, validAll bool) map[string]*Answer {
	out := map[string]*Answer{}
	for pid, v := range m {
		out[pid] = &Answer{Value: v, Normalized: Normalize(v), Valid: validAll}
	}
	return out
}

func TestScoreCategory(t *testing.T) {
	// Only one valid answer -> 20
	a := mkAnswers(map[string]string{"p1": "Berlin"}, true)
	ScoreCategory(a)
	if a["p1"].Points != 20 {
		t.Errorf("single valid: got %d want 20", a["p1"].Points)
	}

	// Two different valid answers -> 10 each
	b := mkAnswers(map[string]string{"p1": "Berlin", "p2": "Bremen"}, true)
	ScoreCategory(b)
	if b["p1"].Points != 10 || b["p2"].Points != 10 {
		t.Errorf("two unique: got %d/%d want 10/10", b["p1"].Points, b["p2"].Points)
	}

	// Two identical valid answers (auto-grouped) -> 5 each
	c := mkAnswers(map[string]string{"p1": "Berlin", "p2": "berlin"}, true)
	ScoreCategory(c)
	if c["p1"].Points != 5 || c["p2"].Points != 5 {
		t.Errorf("two identical: got %d/%d want 5/5", c["p1"].Points, c["p2"].Points)
	}

	// One valid + one invalid -> 20 and 0
	d := mkAnswers(map[string]string{"p1": "Berlin", "p2": "xyz"}, true)
	d["p2"].Valid = false
	ScoreCategory(d)
	if d["p1"].Points != 20 || d["p2"].Points != 0 {
		t.Errorf("valid+invalid: got %d/%d want 20/0", d["p1"].Points, d["p2"].Points)
	}

	// Three players: two same, one different -> 5,5,10
	e := mkAnswers(map[string]string{"p1": "Berlin", "p2": "Berlin", "p3": "Bremen"}, true)
	ScoreCategory(e)
	if e["p1"].Points != 5 || e["p2"].Points != 5 || e["p3"].Points != 10 {
		t.Errorf("mixed: got %d/%d/%d want 5/5/10", e["p1"].Points, e["p2"].Points, e["p3"].Points)
	}

	// Explicit merge of different spellings -> grouped as 5
	f := mkAnswers(map[string]string{"p1": "Muenchen", "p2": "München"}, true)
	f["p1"].MergedInto = "p2"
	ScoreCategory(f)
	if f["p1"].Points != 5 || f["p2"].Points != 5 {
		t.Errorf("merged spellings: got %d/%d want 5/5", f["p1"].Points, f["p2"].Points)
	}
}

func TestComputeRanking(t *testing.T) {
	players := map[string]*Player{
		"p1": {ID: "p1", Name: "Anna", Score: 30},
		"p2": {ID: "p2", Name: "Bob", Score: 30},
		"p3": {ID: "p3", Name: "Cara", Score: 10},
	}
	r := ComputeRanking(players)
	byID := map[string]RankEntry{}
	for _, e := range r {
		byID[e.PlayerID] = e
	}
	if byID["p1"].Rank != 1 || byID["p2"].Rank != 1 {
		t.Errorf("tie should share rank 1: got %d/%d", byID["p1"].Rank, byID["p2"].Rank)
	}
	if byID["p3"].Rank != 3 {
		t.Errorf("after tie, next rank should be 3: got %d", byID["p3"].Rank)
	}
	// Anna before Bob alphabetically
	if r[0].PlayerID != "p1" {
		t.Errorf("alphabetical tiebreak: expected Anna first, got %s", r[0].PlayerID)
	}
}
