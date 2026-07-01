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
	if !IsRuleValid("B", " berlin", false) {
		t.Error("'berlin' should be valid for letter B")
	}
	if IsRuleValid("B", "Aachen", false) {
		t.Error("'Aachen' should be invalid for letter B")
	}
	if IsRuleValid("B", "   ", false) {
		t.Error("empty should be invalid")
	}
}

func TestIsRuleValidLastLetter(t *testing.T) {
	// In last-letter mode the answer must END with the letter.
	if !IsRuleValid("N", "berlin", true) {
		t.Error("'berlin' ends with N and should be valid in last-letter mode")
	}
	if IsRuleValid("B", "berlin", true) {
		t.Error("'berlin' does not end with B and should be invalid in last-letter mode")
	}
	// Case-insensitive on the final rune.
	if !IsRuleValid("a", "Bamberga", true) {
		t.Error("'Bamberga' ends with a and should be valid for letter a")
	}
	// Single-character answer matching the letter.
	if !IsRuleValid("A", "a", true) {
		t.Error("single-char 'a' should be valid for last-letter A")
	}
}

func mkAnswers(m map[string]string, validAll bool) map[string]*Answer {
	out := map[string]*Answer{}
	for pid, v := range m {
		out[pid] = &Answer{Value: v, Valid: validAll}
	}
	return out
}

func TestScoreCategory(t *testing.T) {
	// Only one valid answer -> 20
	a := mkAnswers(map[string]string{"p1": "Berlin"}, true)
	ScoreCategory(a, nil)
	if a["p1"].Points != 20 {
		t.Errorf("single valid: got %d want 20", a["p1"].Points)
	}

	// Two different valid answers -> 10 each
	b := mkAnswers(map[string]string{"p1": "Berlin", "p2": "Bremen"}, true)
	ScoreCategory(b, nil)
	if b["p1"].Points != 10 || b["p2"].Points != 10 {
		t.Errorf("two unique: got %d/%d want 10/10", b["p1"].Points, b["p2"].Points)
	}

	// Two identical valid answers (auto-grouped) -> 5 each
	c := mkAnswers(map[string]string{"p1": "Berlin", "p2": "berlin"}, true)
	ScoreCategory(c, nil)
	if c["p1"].Points != 5 || c["p2"].Points != 5 {
		t.Errorf("two identical: got %d/%d want 5/5", c["p1"].Points, c["p2"].Points)
	}

	// One valid + one invalid -> 20 and 0
	d := mkAnswers(map[string]string{"p1": "Berlin", "p2": "xyz"}, true)
	d["p2"].Valid = false
	ScoreCategory(d, nil)
	if d["p1"].Points != 20 || d["p2"].Points != 0 {
		t.Errorf("valid+invalid: got %d/%d want 20/0", d["p1"].Points, d["p2"].Points)
	}

	// Three players: two same, one different -> 5,5,10
	e := mkAnswers(map[string]string{"p1": "Berlin", "p2": "Berlin", "p3": "Bremen"}, true)
	ScoreCategory(e, nil)
	if e["p1"].Points != 5 || e["p2"].Points != 5 || e["p3"].Points != 10 {
		t.Errorf("mixed: got %d/%d/%d want 5/5/10", e["p1"].Points, e["p2"].Points, e["p3"].Points)
	}

	// Explicit merge of different spellings -> grouped as 5
	f := mkAnswers(map[string]string{"p1": "Muenchen", "p2": "München"}, true)
	f["p1"].MergedInto = "p2"
	ScoreCategory(f, nil)
	if f["p1"].Points != 5 || f["p2"].Points != 5 {
		t.Errorf("merged spellings: got %d/%d want 5/5", f["p1"].Points, f["p2"].Points)
	}
}

func TestScoreCategoryFlames(t *testing.T) {
	// Flamed unique answer among several: 10 -> 15.
	a := mkAnswers(map[string]string{"p1": "Berlin", "p2": "Bremen"}, true)
	ScoreCategory(a, map[string]bool{"p1": true})
	if a["p1"].Points != 15 {
		t.Errorf("flamed unique: got %d want 15", a["p1"].Points)
	}
	if a["p2"].Points != 10 {
		t.Errorf("non-flamed unique: got %d want 10", a["p2"].Points)
	}

	// Flamed sole valid answer: 20 -> 25.
	b := mkAnswers(map[string]string{"p1": "Berlin"}, true)
	ScoreCategory(b, map[string]bool{"p1": true})
	if b["p1"].Points != 25 {
		t.Errorf("flamed sole: got %d want 25", b["p1"].Points)
	}

	// Flamed but shared: bet lost -> 0 (instead of 5).
	c := mkAnswers(map[string]string{"p1": "Berlin", "p2": "Berlin"}, true)
	ScoreCategory(c, map[string]bool{"p1": true})
	if c["p1"].Points != 0 {
		t.Errorf("flamed shared: got %d want 0", c["p1"].Points)
	}
	if c["p2"].Points != 5 {
		t.Errorf("non-flamed shared: got %d want 5", c["p2"].Points)
	}

	// Flamed but invalid: stays 0.
	d := mkAnswers(map[string]string{"p1": "Berlin", "p2": "xyz"}, true)
	d["p2"].Valid = false
	ScoreCategory(d, map[string]bool{"p2": true})
	if d["p2"].Points != 0 {
		t.Errorf("flamed invalid: got %d want 0", d["p2"].Points)
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

func TestAlphabetExcluding(t *testing.T) {
	got := AlphabetExcluding([]string{"A", "z", " q ", "A"})
	if len(got) != 23 {
		t.Fatalf("expected 23 letters, got %d (%v)", len(got), got)
	}
	for _, l := range got {
		if l == "A" || l == "Z" || l == "Q" {
			t.Errorf("excluded letter %q still present", l)
		}
	}
	// No exclusions yields the full alphabet.
	if len(AlphabetExcluding(nil)) != 26 {
		t.Errorf("AlphabetExcluding(nil) should be the full 26-letter alphabet")
	}
}
