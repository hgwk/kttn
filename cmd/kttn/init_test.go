package main

import (
	"bytes"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/hgwk/kttn/internal/config"
)

func TestInitAsksSavesAndKeepsItsAnswersAsNextDefaults(t *testing.T) {
	path := filepath.Join(t.TempDir(), "config.json")
	t.Setenv("KTTN_CONFIG", path)
	var out bytes.Buffer
	answers := "우리 팀\nja\n\ny\n"
	if err := runInit(nil, strings.NewReader(answers), &out); err != nil {
		t.Fatal(err)
	}
	cfg, found, err := config.Load(path)
	if err != nil || !found {
		t.Fatalf("not saved: %v", err)
	}
	if cfg.OfficeName != "우리 팀" || cfg.Lang != "ja" || !cfg.Preview || cfg.Token == "" || cfg.Port == 0 {
		t.Fatalf("got %+v", cfg)
	}
	token := cfg.Token
	// A second run with blank answers keeps everything, the token included.
	if err := runInit(nil, strings.NewReader("\n\n\n\n"), &out); err != nil {
		t.Fatal(err)
	}
	again, _, _ := config.Load(path)
	if again != cfg || again.Token != token {
		t.Fatalf("defaults not kept: %+v vs %+v", again, cfg)
	}
}

func TestInitWithYesTakesFlagsAndKeepsPreviewOff(t *testing.T) {
	path := filepath.Join(t.TempDir(), "config.json")
	t.Setenv("KTTN_CONFIG", path)
	var out bytes.Buffer
	if err := runInit([]string{"--yes", "--office-name", "Lab"}, strings.NewReader(""), &out); err != nil {
		t.Fatal(err)
	}
	cfg, _, _ := config.Load(path)
	if cfg.OfficeName != "Lab" || cfg.Preview || cfg.Lang != "" {
		t.Fatalf("got %+v", cfg)
	}
	if info, _ := os.Stat(path); info.Mode().Perm() != 0o600 {
		t.Fatalf("mode %v", info.Mode().Perm())
	}
	if err := runInit([]string{"--yes", "--lang", "fr"}, strings.NewReader(""), &out); err == nil {
		t.Fatal("unknown language accepted")
	}
}
