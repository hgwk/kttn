package config

import (
	"net"
	"net/http"
	"net/http/httptest"
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
	want := Config{OfficeName: "우리 팀", Lang: "ja", Port: 5999, Token: "t", Preview: true}
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
	if got := PickPort(taken, true); got == taken || got == 0 {
		t.Fatalf("picked %d for taken %d", got, taken)
	}
	ln.Close()
	if got := PickPort(taken, true); got != taken {
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

func TestEmbedOriginsDefaultToNoneAndDropOddValues(t *testing.T) {
	if got := (Config{}).Embedders(); len(got) != 0 {
		t.Fatalf("default must embed nowhere but itself, got %v", got)
	}
	none := []string{}
	if got := (Config{EmbedOrigins: &none}).Embedders(); len(got) != 0 {
		t.Fatalf("empty list %v", got)
	}
	odd := []string{"https://dash.local:8443", "http://x; script-src *", "*", "javascript:alert(1)", "http://ok.test"}
	got := (Config{EmbedOrigins: &odd}).Embedders()
	if len(got) != 2 || got[0] != "https://dash.local:8443" || got[1] != "http://ok.test" {
		t.Fatalf("filtered %v", got)
	}
}

func TestAFirstSetupDoesNotTakeAnotherConfigsKttn(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte(`{"agents":[]}`))
	}))
	defer srv.Close()
	port := srv.Listener.Addr().(*net.TCPAddr).Port
	if got := PickPort(port, true); got != port {
		t.Fatalf("rerun should keep its own kttn's port %d, got %d", port, got)
	}
	if got := PickPort(port, false); got == port || got == 0 {
		t.Fatalf("first setup took another kttn's port %d", got)
	}
}
