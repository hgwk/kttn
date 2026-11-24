package server

import (
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/hgwk/kttn/internal/office"
)

// Origin and Host can be forged by any program on this computer, so the
// screen's reads and actions also need the key only this user can read.
func TestScreenRoutesNeedTheScreenKey(t *testing.T) {
	store := office.NewStore(time.Now, func(int) bool { return true })
	focused := 0
	h := New(Options{Store: store, ScreenKey: "screen-secret", PropsPath: filepath.Join(t.TempDir(), "props.json"),
		Focus: func(int) error { focused++; return nil }})
	post(h, "127.0.0.1:5886", jsonType, `{"source":"claude","session":"s1","event":"UserPromptSubmit","pid":4242}`)
	call := func(method, path, key, body string) int {
		req := httptest.NewRequest(method, "http://127.0.0.1:5886"+path, strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Origin", "http://127.0.0.1:5886")
		if key != "" {
			req.Header.Set("X-Kttn-Key", key)
		}
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)
		return rec.Code
	}
	routes := []struct{ method, path, body string }{
		{"GET", "/api/snapshot", ""},
		{"POST", "/api/focus", `{"key":"claude|s1"}`},
		{"POST", "/api/message", `{"key":"claude|s1","text":"!rm -rf ~"}`},
		{"GET", "/api/props", ""},
		{"PUT", "/api/props", `{"rooms":{}}`},
	}
	for _, r := range routes {
		for _, key := range []string{"", "wrong"} {
			if code := call(r.method, r.path, key, r.body); code != 401 {
				t.Errorf("%s %s with key %q: %d", r.method, r.path, key, code)
			}
		}
	}
	if focused != 0 {
		t.Fatal("a request without the key reached the terminal")
	}
	if code := call("GET", "/api/snapshot", "screen-secret", ""); code != 200 {
		t.Fatalf("snapshot with key: %d", code)
	}
	if code := call("POST", "/api/focus", "screen-secret", `{"key":"claude|s1"}`); code != 200 || focused != 1 {
		t.Fatalf("focus with key: %d %d", code, focused)
	}
	// The page itself and the hook's own route do not use the screen key.
	if code := get(h, "127.0.0.1:5886", "/manifest.webmanifest").Code; code == 401 {
		t.Fatal("static files must load without the key")
	}
}
