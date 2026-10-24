package game

import (
	"slices"
	"testing"
)

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
	// Single-character answers are too short (min 2 chars), even in last-letter
	// mode.
	if IsRuleValid("A", "a", true) {
		t.Error("single-char 'a' should be too short to be valid")
	}
}

func TestIsRuleValidMinLength(t *testing.T) {
	// A single character is too short in both modes.
	if IsRuleValid("B", "b", false) {
		t.Error("single-char 'b' should be too short to be valid")
	}
	if IsRuleValid("N", "n", true) {
		t.Error("single-char 'n' should be too short in last-letter mode")
	}
	// Two characters are the minimum accepted length.
	if !IsRuleValid("B", "ba", false) {
		t.Error("two-char 'ba' should be valid for letter B")
	}
}

func mkAnswers(m map[string]string, validAll bool) map[string]*Answer {
	out := map[string]*Answer{}
	for pid, v := range m {
		out[pid] = &Answer{Value: v, Valid: validAll}
	}
	return out
}

func TestWordValue(t *testing.T) {
	for v, want := range map[string]int{"Berlin": 50 + 5*(3+1+1+2+1+1), " qy-z ": 50 + 5*(10+10+3), "Öß": 50 + 5*(8+1)} {
		if got := WordValue(v); got != want {
			t.Errorf("WordValue(%q) = %d, want %d", v, got, want)
		}
	}
}

func TestScoreCategory(t *testing.T) {
	ber, bre := WordValue("Berlin"), WordValue("Bremen")
	pts := func(m map[string]*Answer, ids ...string) []int {
		out := []int{}
		for _, id := range ids {
			out = append(out, m[id].Points)
		}
		return out
	}
	invalid := mkAnswers(map[string]string{"p1": "Berlin", "p2": "xyz"}, true)
	invalid["p2"].Valid = false
	merged := mkAnswers(map[string]string{"p1": "Muenchen", "p2": "München"}, true)
	merged["p1"].MergedInto = "p2"
	cases := []struct {
		name string
		in   map[string]*Answer
		want []int
	}{
		{"single valid x5", mkAnswers(map[string]string{"p1": "Berlin"}, true), []int{ber * 5}},
		{"two unique x2.5", mkAnswers(map[string]string{"p1": "Berlin", "p2": "Bremen"}, true), []int{ber * 5 / 2, bre * 5 / 2}},
		{"two identical x1.5", mkAnswers(map[string]string{"p1": "Berlin", "p2": "berlin"}, true), []int{ber * 3 / 2, ber * 3 / 2}},
		{"mixed", mkAnswers(map[string]string{"p1": "Berlin", "p2": "Berlin", "p3": "Bremen"}, true), []int{ber * 3 / 2, ber * 3 / 2, bre * 5 / 2}},
		{"valid+invalid", invalid, []int{ber * 5, 0}},
		{"merged spellings", merged, []int{WordValue("Muenchen") * 3 / 2, WordValue("München") * 3 / 2}},
	}

	for _, c := range cases {
		ScoreCategory(c.in)
		ids := []string{"p1", "p2", "p3"}[:len(c.want)]
		if got := pts(c.in, ids...); !slices.Equal(got, c.want) {
			t.Errorf("%s: got %v want %v", c.name, got, c.want)
		}
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

func TestAnswerCounts(t *testing.T) {
	for _, tc := range []struct {
		a    Answer
		want bool
	}{
		{Answer{Valid: true}, true},
		{Answer{Valid: false, Votes: map[string]bool{"b": true}}, false},
		{Answer{Valid: true, Votes: map[string]bool{"b": false}}, false},
		{Answer{Valid: true, Votes: map[string]bool{"b": false, "c": true}}, false},
		{Answer{Valid: true, Votes: map[string]bool{"b": false, "c": true, "d": true}}, true},
		{Answer{Valid: true, Ruled: true, Votes: map[string]bool{"b": false}}, true},
		{Answer{Valid: false, Ruled: true}, false},
	} {
		if got := tc.a.Counts(); got != tc.want {
			t.Errorf("%+v: got %v, want %v", tc.a, got, tc.want)
		}
	}
}
