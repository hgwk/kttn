package main

import (
	"net"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"

	"github.com/hgwk/kttn/internal/config"
)

// A session started outside the shell has none of its XDG_* or KTTN_*
// variables; the pinned --config still finds the office and its token.
func TestThePinnedConfigFindsTheOfficeWithoutTheShellsVariables(t *testing.T) {
	var auth string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		auth = r.Header.Get("Authorization")
	}))
	defer srv.Close()
	pinned := filepath.Join(t.TempDir(), "xdg", "kttn", "config.json")
	cfg := config.Config{Port: srv.Listener.Addr().(*net.TCPAddr).Port, Token: "pinned-token"}
	if err := config.Save(pinned, cfg); err != nil {
		t.Fatal(err)
	}
	t.Setenv("KTTN_CONFIG", "")
	t.Setenv("KTTN_URL", "")
	t.Setenv("KTTN_TOKEN", "")
	t.Setenv("XDG_CONFIG_HOME", t.TempDir())
	runHook([]string{"--config", pinned}, strings.NewReader(`{"session_id":"s","hook_event_name":"Stop","cwd":"/tmp"}`))
	if auth != "Bearer pinned-token" {
		t.Fatalf("authorization %q", auth)
	}
}
