package game

import (
	"fmt"
	"testing"
)

// BenchmarkScoreCategory measures the isolated scoring cost for one category
// with n answers (no network, no locks) — the hot path run once per category
// on every review recompute.
func BenchmarkScoreCategory(b *testing.B) {
	for _, n := range []int{5, 25, 100, 500} {
		b.Run(fmt.Sprintf("answers=%d", n), func(b *testing.B) {
			base := make(map[string]*Answer, n)
			for i := 0; i < n; i++ {
				// Mix of shared and unique values to exercise the union-find.
				v := fmt.Sprintf("Berlin%d", i%7)
				base[fmt.Sprintf("p%d", i)] = &Answer{Value: v, Valid: true}
			}
			b.ResetTimer()
			for i := 0; i < b.N; i++ {
				answers := make(map[string]*Answer, n)
				for k, a := range base {
					cp := *a
					answers[k] = &cp
				}
				ScoreCategory(answers)
			}
		})
	}
}

// BenchmarkComputeRanking measures ranking cost for p players.
func BenchmarkComputeRanking(b *testing.B) {
	for _, p := range []int{5, 50, 500} {
		b.Run(fmt.Sprintf("players=%d", p), func(b *testing.B) {
			players := make(map[string]*Player, p)
			for i := 0; i < p; i++ {
				id := fmt.Sprintf("p%d", i)
				players[id] = &Player{ID: id, Name: id, Score: i % 13}
			}
			b.ResetTimer()
			for i := 0; i < b.N; i++ {
				ComputeRanking(players)
			}
		})
	}
}
