package game

import (
	"math/rand"
	"sort"
	"strings"
)

// Alphabet without umlauts (SRS 5.4).
const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"

func NewAlphabet() []string {
	letters := make([]string, 0, len(alphabet))
	for _, r := range alphabet {
		letters = append(letters, string(r))
	}
	return letters
}

// AlphabetExcluding returns the alphabet without the given (host-disabled)
// letters, so those letters are never drawn in a game (SRS-extension).
func AlphabetExcluding(excluded []string) []string {
	skip := map[string]bool{}
	for _, e := range excluded {
		skip[strings.ToUpper(strings.TrimSpace(e))] = true
	}
	letters := make([]string, 0, len(alphabet))
	for _, r := range alphabet {
		s := string(r)
		if !skip[s] {
			letters = append(letters, s)
		}
	}
	return letters
}

// PickRandomLetter draws a random letter from remaining and returns it together
// with the reduced remaining slice.
func PickRandomLetter(remaining []string) (string, []string) {
	if len(remaining) == 0 {
		return "", remaining
	}
	i := rand.Intn(len(remaining))
	letter := remaining[i]
	next := make([]string, 0, len(remaining)-1)
	next = append(next, remaining[:i]...)
	next = append(next, remaining[i+1:]...)
	return letter, next
}

// Normalize trims, uppercases the first rune and lowercases the rest (SRS 5.5).
func Normalize(value string) string {
	v := strings.TrimSpace(value)
	if v == "" {
		return ""
	}
	r := []rune(v)
	return strings.ToUpper(string(r[0])) + strings.ToLower(string(r[1:]))
}

// IsRuleValid reports whether a raw value conforms to the formal rules for the
// given letter: non-empty, 1–30 chars, and starting with the letter — or, when
// lastLetter is set, ending with it (SRS 5.5 + last-letter spice).
func IsRuleValid(letter, value string, lastLetter bool) bool {
	n := Normalize(value)
	if n == "" {
		return false
	}
	runes := []rune(n)
	if rc := len(runes); rc < 1 || rc > 30 {
		return false
	}
	upperLetter := strings.ToUpper(letter)
	if lastLetter {
		last := strings.ToUpper(string(runes[len(runes)-1]))
		return last == upperLetter
	}
	return strings.HasPrefix(strings.ToUpper(n), upperLetter)
}

// ScoreCategory assigns points to every answer of one category in place
// (SRS 7): 0 invalid/empty, 5 valid-but-shared, 10 unique valid, 20 only valid
// answer in the category. Answers sharing a normalized value or linked via a
// host merge count as the same group.
//
// flamed lists players who bet that their answer is unique. A flamed answer that
// turns out unique earns +5 on top of its base points (10→15, 20→25); a flamed
// answer that is shared with someone earns 0 instead of 5.
func ScoreCategory(answers map[string]*Answer, flamed map[string]bool) {
	valid := make([]string, 0, len(answers))
	validSet := map[string]bool{}
	for pid, a := range answers {
		if a.Valid && Normalize(a.Value) != "" {
			valid = append(valid, pid)
			validSet[pid] = true
		}
	}

	parent := map[string]string{}
	var find func(string) string
	find = func(x string) string {
		if parent[x] == "" {
			parent[x] = x
		}
		if parent[x] != x {
			parent[x] = find(parent[x])
		}
		return parent[x]
	}
	union := func(a, b string) {
		ra, rb := find(a), find(b)
		if ra != rb {
			parent[ra] = rb
		}
	}
	for _, pid := range valid {
		find(pid)
	}

	// Auto-group answers with identical normalized values.
	byNorm := map[string][]string{}
	for _, pid := range valid {
		n := Normalize(answers[pid].Value)
		byNorm[n] = append(byNorm[n], pid)
	}
	for _, group := range byNorm {
		for i := 1; i < len(group); i++ {
			union(group[0], group[i])
		}
	}

	// Apply explicit host merges (only between valid answers).
	for _, pid := range valid {
		if m := answers[pid].MergedInto; m != "" && validSet[m] {
			union(pid, m)
		}
	}

	groupSize := map[string]int{}
	for _, pid := range valid {
		groupSize[find(pid)]++
	}
	numGroups := len(groupSize)

	for pid, a := range answers {
		if !validSet[pid] {
			a.Points = 0
			continue
		}
		size := groupSize[find(pid)]
		switch {
		case size > 1:
			a.Points = 5
		case numGroups == 1:
			a.Points = 20
		default:
			a.Points = 10
		}
		// Flame modifier: betting your answer is unique. If shared → 0; if
		// actually unique → +5 (10→15, 20→25).
		if flamed[pid] {
			if size > 1 {
				a.Points = 0
			} else {
				a.Points += 5
			}
		}
	}
}

// ComputeRanking sorts players by score (desc), then name (asc). Equal scores
// share the same rank (SRS 7.2).
func ComputeRanking(players map[string]*Player) []RankEntry {
	type entry struct {
		id    string
		score int
		name  string
	}
	list := make([]entry, 0, len(players))
	for _, p := range players {
		list = append(list, entry{p.ID, p.Score, p.Name})
	}
	sort.Slice(list, func(i, j int) bool {
		if list[i].score != list[j].score {
			return list[i].score > list[j].score
		}
		return strings.ToLower(list[i].name) < strings.ToLower(list[j].name)
	})

	ranking := make([]RankEntry, 0, len(list))
	rank, prevScore := 0, 0
	for i, e := range list {
		if i == 0 || e.score != prevScore {
			rank = i + 1
			prevScore = e.score
		}
		ranking = append(ranking, RankEntry{PlayerID: e.id, Rank: rank, Score: e.score})
	}
	return ranking
}
