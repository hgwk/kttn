package server

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/hgwk/kttn/internal/sessions"
)

func TestOnlyTheListedPagesMayEmbedKttn(t *testing.T) {
	store := sessions.NewStore(time.Now, func(int) bool { return true })
	h := New(Options{Store: store, EmbedOrigins: []string{"http://127.0.0.1:3000", "http://localhost:3000"}})
	for _, path := range []string{"/", "/api/snapshot", "/manifest.webmanifest"} {
		got := get(h, "127.0.0.1:5886", path).Header().Get("Content-Security-Policy")
		if got != "frame-ancestors 'self' http://127.0.0.1:3000 http://localhost:3000" {
			t.Fatalf("%s: %q", path, got)
		}
	}
	none := New(Options{Store: store})
	if got := get(none, "127.0.0.1:5886", "/").Header().Get("Content-Security-Policy"); got != "frame-ancestors 'self'" {
		t.Fatalf("no embedders: %q", got)
	}
}

// Inside the iframe kttn page calls its own server, so the click has
// kttn's Origin and passes; the embedding page calling directly does not.
func TestScreenActionsFromTheEmbeddedKttnPassButNotFromItsParent(t *testing.T) {
	store := sessions.NewStore(time.Now, func(int) bool { return true })
	focused := 0
	h := New(Options{Store: store, EmbedOrigins: []string{"http://127.0.0.1:3000"}, Focus: func(int) error {
		focused++
		return nil
	}})
	post(h, "127.0.0.1:5886", jsonType, `{"source":"claude","session":"s1","event":"UserPromptSubmit","pid":4242}`)
	click := func(origin string) int {
		req := httptest.NewRequest(http.MethodPost, "http://127.0.0.1:5886/api/focus", strings.NewReader(`{"key":"claude|s1"}`))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Origin", origin)
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)
		return rec.Code
	}
	if code := click("http://127.0.0.1:5886"); code != 200 {
		t.Fatalf("from the embedded kttn: %d", code)
	}
	if code := click("http://127.0.0.1:3000"); code != 403 {
		t.Fatalf("from the embedding page: %d", code)
	}
	if focused != 1 {
		t.Fatalf("focused %d times", focused)
	}
}
