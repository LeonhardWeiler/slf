package game

import (
	"cmp"
	"math/rand"
	"slices"
	"strings"
	"unicode"
	"unicode/utf8"
)

const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"

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

func PickRandomLetter(remaining []string) string {
	if len(remaining) == 0 {
		return ""
	}
	return remaining[rand.Intn(len(remaining))]
}

// Normalize trims, uppercases the first rune and lowercases the rest.
func Normalize(value string) string {
	v := strings.TrimSpace(value)
	if v == "" {
		return ""
	}
	r := []rune(v)
	return strings.ToUpper(string(r[0])) + strings.ToLower(string(r[1:]))
}

var umlautBase = strings.NewReplacer("Ä", "A", "Ö", "O", "Ü", "U")

// IsRuleValid reports whether a raw value conforms to the formal rules for the
// given letter: at most 30 chars with at least 2 letters, and starting with the
// letter - or, when lastLetter is set, ending with it, ignoring non-letters at
// either edge; Ä/Ö/Ü count as A/O/U.
func IsRuleValid(letter, value string, lastLetter bool) bool {
	n := Normalize(value)
	letters := 0
	for _, r := range n {
		if unicode.IsLetter(r) {
			letters++
		}
	}
	if letters < 2 || utf8.RuneCountInString(n) > 30 {
		return false
	}
	w := []rune(umlautBase.Replace(strings.ToUpper(strings.TrimFunc(n, func(r rune) bool { return !unicode.IsLetter(r) }))))
	upperLetter := strings.ToUpper(letter)
	if lastLetter {
		return string(w[len(w)-1]) == upperLetter
	}
	return strings.HasPrefix(string(w), upperLetter)
}

// letterValues are the German Scrabble tile values; any other letter is 1.
var letterValues = map[rune]int{
	'G': 2, 'H': 2, 'L': 2, 'O': 2,
	'B': 3, 'M': 3, 'W': 3, 'Z': 3,
	'C': 4, 'F': 4, 'K': 4, 'P': 4,
	'Ä': 6, 'J': 6, 'Ü': 6, 'V': 6,
	'Ö': 8, 'X': 8,
	'Q': 10, 'Y': 10,
}

// WordValue is the base score of a finished answer: 5 times the Scrabble value
// of every letter, plus 50 for the word.
func WordValue(value string) int {
	v := 50
	for _, r := range strings.ToUpper(strings.TrimSpace(value)) {
		if !unicode.IsLetter(r) {
			continue
		}
		v += 5 * max(1, letterValues[r])
	}
	return v
}

// ScoreCategory assigns points to every answer of one category in place:
// 0 invalid/empty, else its WordValue times 1.5 when shared, 2.5 when unique
// and 5 when it is the only valid answer in the category. Answers sharing a
// normalized value or linked via a host merge count as the same group.
func ScoreCategory(answers map[string]*Answer) {
	valid := make([]string, 0, len(answers))
	validSet := map[string]bool{}
	for pid, a := range answers {
		if a.Counts() && Normalize(a.Value) != "" {
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
		w := WordValue(a.Value)
		switch {
		case groupSize[find(pid)] > 1:
			a.Points = w * 3 / 2
		case numGroups == 1:
			a.Points = w * 5
		default:
			a.Points = w * 5 / 2
		}
	}
}

// ComputeRanking sorts players by score (desc), then name (asc). Equal scores
// share the same rank.
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
	slices.SortFunc(list, func(a, b entry) int {
		if a.score != b.score {
			return cmp.Compare(b.score, a.score) // higher score first
		}
		return cmp.Or(cmp.Compare(strings.ToLower(a.name), strings.ToLower(b.name)), cmp.Compare(a.id, b.id))
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
