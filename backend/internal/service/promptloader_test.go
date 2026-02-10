package service

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func setupPromptDir(t *testing.T) string {
	t.Helper()
	dir := t.TempDir()

	os.WriteFile(filepath.Join(dir, "rules_engine.txt"), []byte("GROUNDING: Only use context."), 0644)
	os.WriteFile(filepath.Join(dir, "mercury_identity.txt"), []byte("IDENTITY: You are Mercury."), 0644)
	os.WriteFile(filepath.Join(dir, "persona_cfo.txt"), []byte("PERSPECTIVE: CFO briefing."), 0644)
	os.WriteFile(filepath.Join(dir, "persona_legal.txt"), []byte("PERSPECTIVE: Legal briefing."), 0644)
	os.WriteFile(filepath.Join(dir, "compliance_strict.txt"), []byte("PERSPECTIVE: Strict compliance."), 0644)

	return dir
}

func TestNewPromptLoader_Success(t *testing.T) {
	dir := setupPromptDir(t)

	pl, err := NewPromptLoader(dir)
	if err != nil {
		t.Fatalf("NewPromptLoader() error: %v", err)
	}

	if pl.Rules() == "" {
		t.Error("rules should not be empty")
	}
	if pl.Identity() == "" {
		t.Error("identity should not be empty")
	}

	names := pl.PersonaNames()
	if len(names) < 3 {
		t.Errorf("expected at least 3 personas, got %d: %v", len(names), names)
	}
}

func TestNewPromptLoader_MissingRules(t *testing.T) {
	dir := t.TempDir()
	// Only create identity, no rules
	os.WriteFile(filepath.Join(dir, "mercury_identity.txt"), []byte("identity"), 0644)

	_, err := NewPromptLoader(dir)
	if err == nil {
		t.Fatal("expected fatal error when rules_engine.txt is missing")
	}
	if !strings.Contains(err.Error(), "FATAL") {
		t.Errorf("error should contain FATAL, got: %v", err)
	}
}

func TestNewPromptLoader_MissingIdentity(t *testing.T) {
	dir := t.TempDir()
	os.WriteFile(filepath.Join(dir, "rules_engine.txt"), []byte("rules"), 0644)

	_, err := NewPromptLoader(dir)
	if err == nil {
		t.Fatal("expected fatal error when mercury_identity.txt is missing")
	}
	if !strings.Contains(err.Error(), "FATAL") {
		t.Errorf("error should contain FATAL, got: %v", err)
	}
}

func TestNewPromptLoader_MissingPersonasIsNonFatal(t *testing.T) {
	dir := t.TempDir()
	os.WriteFile(filepath.Join(dir, "rules_engine.txt"), []byte("rules"), 0644)
	os.WriteFile(filepath.Join(dir, "mercury_identity.txt"), []byte("identity"), 0644)
	// No persona files

	pl, err := NewPromptLoader(dir)
	if err != nil {
		t.Fatalf("NewPromptLoader() should not fail without personas: %v", err)
	}

	if len(pl.PersonaNames()) != 0 {
		t.Errorf("expected 0 personas, got %d", len(pl.PersonaNames()))
	}
}

func TestBuildSystemPrompt_SandwichOrder(t *testing.T) {
	dir := setupPromptDir(t)
	pl, _ := NewPromptLoader(dir)

	prompt := pl.BuildSystemPrompt("persona_cfo", false)

	// Verify order: Rules → Identity → Persona
	rulesIdx := strings.Index(prompt, "RULES (NON-NEGOTIABLE)")
	identityIdx := strings.Index(prompt, "IDENTITY")
	personaIdx := strings.Index(prompt, "ACTIVE PERSONA")

	if rulesIdx < 0 {
		t.Fatal("prompt should contain rules section")
	}
	if identityIdx < 0 {
		t.Fatal("prompt should contain identity section")
	}
	if personaIdx < 0 {
		t.Fatal("prompt should contain persona section")
	}

	if rulesIdx >= identityIdx {
		t.Error("rules should come before identity")
	}
	if identityIdx >= personaIdx {
		t.Error("identity should come before persona")
	}
}

func TestBuildSystemPrompt_StrictMode(t *testing.T) {
	dir := setupPromptDir(t)
	pl, _ := NewPromptLoader(dir)

	prompt := pl.BuildSystemPrompt("persona_cfo", true)

	if !strings.Contains(prompt, "COMPLIANCE MODE") {
		t.Error("strict mode should include compliance section")
	}
	if !strings.Contains(prompt, "ACTIVE PERSONA") {
		t.Error("strict mode should still include persona")
	}
}

func TestBuildSystemPrompt_NoPersona(t *testing.T) {
	dir := setupPromptDir(t)
	pl, _ := NewPromptLoader(dir)

	prompt := pl.BuildSystemPrompt("", false)

	if strings.Contains(prompt, "ACTIVE PERSONA") {
		t.Error("empty persona should not include persona section")
	}
	if !strings.Contains(prompt, "RULES") {
		t.Error("prompt should always have rules")
	}
	if !strings.Contains(prompt, "IDENTITY") {
		t.Error("prompt should always have identity")
	}
}

func TestBuildSystemPrompt_UnknownPersona(t *testing.T) {
	dir := setupPromptDir(t)
	pl, _ := NewPromptLoader(dir)

	prompt := pl.BuildSystemPrompt("persona_unknown", false)

	if strings.Contains(prompt, "ACTIVE PERSONA") {
		t.Error("unknown persona should not include persona section")
	}
}

func TestHotReload(t *testing.T) {
	dir := setupPromptDir(t)
	pl, _ := NewPromptLoader(dir)

	originalRules := pl.Rules()

	// Modify the rules file
	os.WriteFile(filepath.Join(dir, "rules_engine.txt"), []byte("UPDATED RULES: new safety rules."), 0644)

	if err := pl.HotReload(); err != nil {
		t.Fatalf("HotReload() error: %v", err)
	}

	newRules := pl.Rules()
	if newRules == originalRules {
		t.Error("rules should change after hot reload")
	}
	if !strings.Contains(newRules, "UPDATED RULES") {
		t.Errorf("reloaded rules = %q, want to contain 'UPDATED RULES'", newRules)
	}
}

func TestHotReload_NewPersona(t *testing.T) {
	dir := setupPromptDir(t)
	pl, _ := NewPromptLoader(dir)

	initialCount := len(pl.PersonaNames())

	// Add a new persona file
	os.WriteFile(filepath.Join(dir, "persona_hr.txt"), []byte("PERSPECTIVE: HR briefing."), 0644)
	pl.HotReload()

	if len(pl.PersonaNames()) != initialCount+1 {
		t.Errorf("expected %d personas after adding one, got %d", initialCount+1, len(pl.PersonaNames()))
	}

	prompt := pl.BuildSystemPrompt("persona_hr", false)
	if !strings.Contains(prompt, "HR briefing") {
		t.Error("new persona should be usable after hot reload")
	}
}

func TestPromptLoader_ImplementsSystemPromptBuilder(t *testing.T) {
	dir := setupPromptDir(t)
	pl, _ := NewPromptLoader(dir)

	// Verify it can be used as a SystemPromptBuilder
	var builder SystemPromptBuilder = pl
	prompt := builder.BuildSystemPrompt("persona_cfo", false)
	if prompt == "" {
		t.Error("SystemPromptBuilder should return non-empty prompt")
	}
}

func TestPromptLoader_WithRealPromptFiles(t *testing.T) {
	// Test with the actual prompt files from the project
	dir := "prompts"
	if _, err := os.Stat(filepath.Join(dir, "rules_engine.txt")); os.IsNotExist(err) {
		t.Skip("actual prompt files not found in working directory")
	}

	pl, err := NewPromptLoader(dir)
	if err != nil {
		t.Fatalf("NewPromptLoader(real files) error: %v", err)
	}

	// Verify rules contain the 6 hard laws
	rules := pl.Rules()
	requiredLaws := []string{"GROUNDING", "NO PREAMBLE", "CITATION STYLE", "PRIVILEGE GATING", "CONFIDENCE REPORTING", "SILENCE PROTOCOL"}
	for _, law := range requiredLaws {
		if !strings.Contains(rules, law) {
			t.Errorf("rules should contain %q", law)
		}
	}

	// Verify identity contains key elements
	identity := pl.Identity()
	if !strings.Contains(identity, "Mercury") {
		t.Error("identity should mention Mercury")
	}

	// Verify personas loaded
	names := pl.PersonaNames()
	if len(names) < 3 {
		t.Errorf("expected at least 3 personas from real files, got %d", len(names))
	}
}
