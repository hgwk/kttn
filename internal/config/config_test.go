package config

import (
	"net"
	"os"
	"path/filepath"
	"testing"
)

func TestConfigRoundTripsAndStaysPrivate(t *testing.T) {
	path := filepath.Join(t.TempDir(), "kttn", "config.json")
	cfg, found, err := Load(path)
	if err != nil || found || cfg.Port != DefaultPort {
		t.Fatalf("missing file: %+v %v %v", cfg, found, err)
	}
	want := Config{OfficeName: "우리 팀", HomeRepo: "myrepo", Lang: "ja", Port: 5999, Token: "t", Preview: true}
	if err := Save(path, want); err != nil {
		t.Fatal(err)
	}
	if info, _ := os.Stat(path); info.Mode().Perm() != 0o600 {
		t.Fatalf("mode %v", info.Mode().Perm())
	}
	got, found, err := Load(path)
	if err != nil || !found || got != want {
		t.Fatalf("got %+v %v %v", got, found, err)
	}
	if got.EventsURL() != "http://127.0.0.1:5999/api/events" {
		t.Fatalf("url %s", got.EventsURL())
	}
}

func TestABrokenOrOddConfigFallsBackToTheDefaultPort(t *testing.T) {
	path := filepath.Join(t.TempDir(), "config.json")
	os.WriteFile(path, []byte(`{"port": 99999}`), 0o600)
	if cfg, _, err := Load(path); err != nil || cfg.Port != DefaultPort {
		t.Fatalf("got %+v %v", cfg, err)
	}
	os.WriteFile(path, []byte(`not json`), 0o600)
	if cfg, _, err := Load(path); err == nil || cfg.Port != DefaultPort {
		t.Fatalf("got %+v %v", cfg, err)
	}
}

func TestPickPortSkipsAPortSomethingElseHolds(t *testing.T) {
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer ln.Close()
	taken := ln.Addr().(*net.TCPAddr).Port
	if got := PickPort(taken); got == taken || got == 0 {
		t.Fatalf("picked %d for taken %d", got, taken)
	}
	ln.Close()
	if got := PickPort(taken); got != taken {
		t.Fatalf("free port %d not kept, got %d", taken, got)
	}
}

func TestTokensAreRandom(t *testing.T) {
	a, _ := NewToken()
	b, _ := NewToken()
	if len(a) != 48 || a == b {
		t.Fatalf("tokens %q %q", a, b)
	}
}
