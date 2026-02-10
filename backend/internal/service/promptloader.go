package service

import (
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
	"sync"
)

// PromptLoader reads prompt layer files from disk and assembles system prompts.
// It caches files in memory and supports hot-reload without restarting.
type PromptLoader struct {
	promptsDir string

	mu       sync.RWMutex
	rules    string
	identity string
	personas map[string]string
}

// Compile-time check that PromptLoader implements SystemPromptBuilder.
var _ SystemPromptBuilder = (*PromptLoader)(nil)

// NewPromptLoader creates a PromptLoader, reading all prompt files from dir.
// Returns a fatal error if rules_engine.txt or mercury_identity.txt is missing.
func NewPromptLoader(promptsDir string) (*PromptLoader, error) {
	pl := &PromptLoader{promptsDir: promptsDir}

	if err := pl.load(); err != nil {
		return nil, err
	}

	return pl, nil
}

// load reads all prompt files from disk.
func (p *PromptLoader) load() error {
	rulesPath := filepath.Join(p.promptsDir, "rules_engine.txt")
	rulesBytes, err := os.ReadFile(rulesPath)
	if err != nil {
		return fmt.Errorf("FATAL: rules_engine.txt missing — server cannot start without safety rules: %w", err)
	}

	identityPath := filepath.Join(p.promptsDir, "mercury_identity.txt")
	identityBytes, err := os.ReadFile(identityPath)
	if err != nil {
		return fmt.Errorf("FATAL: mercury_identity.txt missing — server cannot start without identity: %w", err)
	}

	personas := make(map[string]string)

	// Load all persona_*.txt and compliance_*.txt files
	patterns := []string{"persona_*.txt", "compliance_*.txt"}
	for _, pattern := range patterns {
		matches, err := filepath.Glob(filepath.Join(p.promptsDir, pattern))
		if err != nil {
			log.Printf("WARNING: failed to glob %s: %v", pattern, err)
			continue
		}
		for _, path := range matches {
			name := strings.TrimSuffix(filepath.Base(path), ".txt")
			data, err := os.ReadFile(path)
			if err != nil {
				log.Printf("WARNING: failed to read persona file %s: %v", path, err)
				continue
			}
			personas[name] = string(data)
		}
	}

	p.mu.Lock()
	p.rules = string(rulesBytes)
	p.identity = string(identityBytes)
	p.personas = personas
	p.mu.Unlock()

	return nil
}

// BuildSystemPrompt constructs the layered "prompt sandwich":
//
//	Layer 1: Rules Engine (hard laws — always first, always present)
//	Layer 2: Mercury Identity (personality — always present)
//	Layer 3: Selected Persona (CFO, Legal, etc. — user-selected or default)
//	Layer 4: Compliance Perspective (optional, added in strict mode)
func (p *PromptLoader) BuildSystemPrompt(persona string, strictMode bool) string {
	p.mu.RLock()
	defer p.mu.RUnlock()

	var sb strings.Builder

	sb.WriteString("=== RULES (NON-NEGOTIABLE) ===\n")
	sb.WriteString(p.rules)

	sb.WriteString("\n\n=== IDENTITY ===\n")
	sb.WriteString(p.identity)

	if persona != "" {
		if personaText, ok := p.personas[persona]; ok {
			sb.WriteString("\n\n=== ACTIVE PERSONA ===\n")
			sb.WriteString(personaText)
		}
	}

	if strictMode {
		if compliance, ok := p.personas["compliance_strict"]; ok {
			sb.WriteString("\n\n=== COMPLIANCE MODE ===\n")
			sb.WriteString(compliance)
		}
	}

	return sb.String()
}

// HotReload re-reads all prompt files from disk without restarting the server.
func (p *PromptLoader) HotReload() error {
	return p.load()
}

// Rules returns the cached rules text (for testing/inspection).
func (p *PromptLoader) Rules() string {
	p.mu.RLock()
	defer p.mu.RUnlock()
	return p.rules
}

// Identity returns the cached identity text (for testing/inspection).
func (p *PromptLoader) Identity() string {
	p.mu.RLock()
	defer p.mu.RUnlock()
	return p.identity
}

// PersonaNames returns all loaded persona keys.
func (p *PromptLoader) PersonaNames() []string {
	p.mu.RLock()
	defer p.mu.RUnlock()
	names := make([]string, 0, len(p.personas))
	for k := range p.personas {
		names = append(names, k)
	}
	return names
}
