package hook

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestRunHookForwardsAndNeverBlocks(t *testing.T) {
	var got string
	relay := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		got = r.URL.Path + " " + string(body)
	}))
	defer relay.Close()
	Run(strings.NewReader(`{"session_id":"s","cwd":"/p/geektv","hook_event_name":"PreToolUse","tool_name":"Read","tool_input":{"file_path":"/p/a.go"}}`),
		Options{Endpoint: relay.URL + "/api/events", Source: "claude", Timeout: time.Second})
	if !strings.HasPrefix(got, "/api/events ") || !strings.Contains(got, `"detail":"a.go"`) {
		t.Fatalf("relay got %q", got)
	}

	slow := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(2 * time.Second)
	}))
	defer slow.Close()
	start := time.Now()
	Run(strings.NewReader(`{"session_id":"s","hook_event_name":"Stop"}`), Options{Endpoint: slow.URL, Source: "claude", Timeout: 100 * time.Millisecond})
	if elapsed := time.Since(start); elapsed > time.Second {
		t.Fatalf("hook must give up quickly, took %s", elapsed)
	}
	// A stopped relay must not panic or hang.
	Run(strings.NewReader(`{"session_id":"s","hook_event_name":"Stop"}`), Options{Endpoint: "http://127.0.0.1:1", Source: "claude", Timeout: 100 * time.Millisecond})
}
