package main

import (
	"testing"
)

func TestVersion(t *testing.T) {
	if Version == "" {
		t.Error("Version must not be empty")
	}
}

func TestVersionFormat(t *testing.T) {
	// Version should be a semver-like string
	if len(Version) < 5 {
		t.Errorf("Version %q looks too short for semver", Version)
	}
}
