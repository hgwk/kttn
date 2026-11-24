package server

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/hgwk/kttn/internal/office"
)

const stopBody = `{"source":"claude","session":"s1","project":"myrepo","event":"Stop"}`

func newServer(t *testing.T, token, statePath string) (http.Handler, *office.Store) {
	t.Helper()
	store := office.NewStore(time.Now, func(int) bool { return true })
	return New(Options{Store: store, Token: token, StatePath: statePath}), store
}

func post(h http.Handler, host string, headers map[string]string, body string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodPost, "http://"+host+"/api/events", strings.NewReader(body))
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

var jsonType = map[string]string{"Content-Type": "application/json"}

func TestEventsAcceptOnlyHookShapedRequests(t *testing.T) {
	h, store := newServer(t, "", "")
	cases := []struct {
		name    string
		host    string
		headers map[string]string
		body    string
		want    int
	}{
		{"hook", "127.0.0.1:5886", jsonType, stopBody, 200},
		{"localhost", "localhost:5886", jsonType, stopBody, 200},
		{"rebound host", "evil.example:5886", jsonType, stopBody, 403},
		{"browser origin", "127.0.0.1:5886", map[string]string{"Content-Type": "application/json", "Origin": "http://127.0.0.1:5886"}, stopBody, 403},
		{"text/plain form post", "127.0.0.1:5886", map[string]string{"Content-Type": "text/plain"}, stopBody, 403},
		{"junk", "127.0.0.1:5886", jsonType, "nope", 400},
		{"unknown event", "127.0.0.1:5886", jsonType, `{"source":"claude","session":"s","event":"Dance"}`, 400},
		{"too large", "127.0.0.1:5886", jsonType, `{"x":"` + strings.Repeat("a", maxEventBytes) + `"}`, 413},
	}
	for _, c := range cases {
		if got := post(h, c.host, c.headers, c.body).Code; got != c.want {
			t.Errorf("%s: want %d, got %d", c.name, c.want, got)
		}
	}
	if n := len(store.Snapshot()); n != 1 {
		t.Fatalf("want one session, got %d", n)
	}
}

func TestEventsRequireTheTokenWhenSet(t *testing.T) {
	h, _ := newServer(t, "secret", "")
	if got := post(h, "127.0.0.1", jsonType, stopBody).Code; got != 401 {
		t.Fatalf("missing token: %d", got)
	}
	wrong := map[string]string{"Content-Type": "application/json", "Authorization": "Bearer nope"}
	if got := post(h, "127.0.0.1", wrong, stopBody).Code; got != 401 {
		t.Fatalf("wrong token: %d", got)
	}
	right := map[string]string{"Content-Type": "application/json", "Authorization": "Bearer secret"}
	if got := post(h, "127.0.0.1", right, stopBody).Code; got != 200 {
		t.Fatalf("right token: %d", got)
	}
}

func TestSnapshotServesSessionsToThisComputerOnly(t *testing.T) {
	h, _ := newServer(t, "", "")
	post(h, "127.0.0.1", jsonType, stopBody)
	get := func(host string) *httptest.ResponseRecorder {
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "http://"+host+"/api/snapshot", nil))
		return rec
	}
	if got := get("evil.example").Code; got != 403 {
		t.Fatalf("rebound host read the snapshot: %d", got)
	}
	rec := get("127.0.0.1:5886")
	var snap Snapshot
	if err := json.Unmarshal(rec.Body.Bytes(), &snap); err != nil || len(snap.Agents) != 1 || snap.Agents[0].State != "done" {
		t.Fatalf("snapshot %s", rec.Body.String())
	}
	if rec.Header().Get("Cache-Control") != "no-store" {
		t.Fatal("snapshot must not be cached")
	}
}

func TestSessionsSurviveARestartThroughTheStateFile(t *testing.T) {
	path := filepath.Join(t.TempDir(), "kttn", "sessions.json")
	h, _ := newServer(t, "", path)
	post(h, "127.0.0.1", jsonType, stopBody)
	deadline := time.Now().Add(3 * time.Second)
	for {
		if _, err := os.Stat(path); err == nil {
			break
		}
		if time.Now().After(deadline) {
			t.Fatal("state file was never written")
		}
		time.Sleep(50 * time.Millisecond)
	}
	if info, _ := os.Stat(path); info.Mode().Perm() != 0o600 {
		t.Fatalf("state file mode %v", info.Mode().Perm())
	}
	_, store := newServer(t, "", path)
	if n := len(store.Snapshot()); n != 1 {
		t.Fatalf("restored %d sessions", n)
	}
}
