package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestTheRedirectPageIsPrivateEvenOverAWiderOldFile(t *testing.T) {
	path := filepath.Join(t.TempDir(), "open.html")
	os.WriteFile(path, []byte("old"), 0o644)
	if err := writePrivate(path, redirectPage(`http://127.0.0.1:5886/#k=a"b<`)); err != nil {
		t.Fatal(err)
	}
	info, _ := os.Stat(path)
	raw, _ := os.ReadFile(path)
	if info.Mode().Perm() != 0o600 || !strings.Contains(string(raw), `location.replace("http://127.0.0.1:5886/#k=a\"b\x3c")`) {
		t.Fatalf("mode %v, page %s", info.Mode().Perm(), raw)
	}
	if left, _ := filepath.Glob(filepath.Join(filepath.Dir(path), ".open-*")); len(left) != 0 {
		t.Fatalf("temp files left: %v", left)
	}
}
