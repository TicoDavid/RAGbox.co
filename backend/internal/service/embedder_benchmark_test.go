package service

import (
	"math/rand"
	"testing"
)

func BenchmarkL2Normalize(b *testing.B) {
	// 768-dimensional vector (text-embedding-004 dimension)
	vec := make([]float32, 768)
	rng := rand.New(rand.NewSource(42))
	for i := range vec {
		vec[i] = rng.Float32()*2 - 1 // [-1, 1]
	}
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = l2Normalize(vec)
	}
}
