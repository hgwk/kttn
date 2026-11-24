package main

import (
	"bytes"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// Asking any command for help prints it and changes nothing on disk.
func TestHelpNeverRunsTheCommand(t *testing.T) {
	dir := t.TempDir()
	t.Setenv("CLAUDE_CONFIG_DIR", filepath.Join(dir, "claude"))
	t.Setenv("KTTN_CONFIG", filepath.Join(dir, "kttn", "config.json"))
	for _, name := range commandOrder {
		for _, flag := range []string{"--help", "-h", "help"} {
			var out, errOut bytes.Buffer
			code := run([]string{name, flag}, strings.NewReader(""), &out, &errOut)
			if code != 0 || !strings.HasPrefix(out.String(), "kttn "+name) {
				t.Errorf("%s %s: code %d out %q err %q", name, flag, code, out.String(), errOut.String())
			}
		}
	}
	if entries, _ := os.ReadDir(dir); len(entries) != 0 {
		t.Fatalf("help wrote files: %v", entries)
	}
}

func TestInstallRefusesArgumentsItDoesNotKnow(t *testing.T) {
	dir := t.TempDir()
	t.Setenv("CLAUDE_CONFIG_DIR", dir)
	var out, errOut bytes.Buffer
	if code := run([]string{"install", "--dry-run"}, strings.NewReader(""), &out, &errOut); code != 1 {
		t.Fatalf("code %d", code)
	}
	if _, err := os.Stat(filepath.Join(dir, "settings.json")); err == nil {
		t.Fatal("install ran with an unknown argument")
	}
}

func TestTopLevelHelpAndVersion(t *testing.T) {
	var out bytes.Buffer
	if code := run([]string{"--help"}, nil, &out, &out); code != 0 || !strings.Contains(out.String(), "kttn install") {
		t.Fatalf("help: %d %q", code, out.String())
	}
	out.Reset()
	if code := run([]string{"version"}, nil, &out, &out); code != 0 || out.String() != "kttn "+version+"\n" {
		t.Fatalf("version: %q", out.String())
	}
}
