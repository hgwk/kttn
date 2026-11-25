package server

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/hgwk/kttn/internal/sessions"
)

func TestDraggedPropsAreSavedAndServedBack(t *testing.T) {
	path := filepath.Join(t.TempDir(), "kttn", "props.json")
	h := New(Options{Store: sessions.NewStore(time.Now, func(int) bool { return true }), PropsPath: path})
	if body := get(h, "127.0.0.1:5886", "/api/props").Body.String(); strings.TrimSpace(body) != `{"rooms":{}}` {
		t.Fatalf("empty: %s", body)
	}
	put := func(origin, body string) int {
		req := httptest.NewRequest(http.MethodPut, "http://127.0.0.1:5886/api/props", strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Origin", origin)
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)
		return rec.Code
	}
	same := "http://127.0.0.1:5886"
	if code := put(same, `{"rooms":{"room-a":{"floor:2:sofa":{"x":120,"y":59.6}},"wall":{"decor:0:clock":{"x":-8,"y":0}}}}`); code != 204 {
		t.Fatalf("put: %d", code)
	}
	body := get(h, "127.0.0.1:5886", "/api/props").Body.String()
	if !strings.Contains(body, `"floor:2:sofa":{"x":120,"y":60}`) || !strings.Contains(body, `"decor:0:clock":{"x":-8,"y":0}`) {
		t.Fatalf("got %s", body)
	}
	if info, _ := os.Stat(path); info.Mode().Perm() != 0o600 {
		t.Fatalf("mode %v", info.Mode().Perm())
	}
	for name, c := range map[string][2]string{
		"other site":   {"http://evil.example", `{"rooms":{}}`},
		"no rooms":     {same, `{}`},
		"far away":     {same, `{"rooms":{"r":{"k":{"x":5000,"y":0}}}}`},
		"missing y":    {same, `{"rooms":{"r":{"k":{"x":1}}}}`},
		"not a number": {same, `{"rooms":{"r":{"k":{"x":"1","y":0}}}}`},
		"too large":    {same, `{"rooms":{"r":{"` + strings.Repeat("k", 70<<10) + `":{"x":1,"y":0}}}}`},
	} {
		if code := put(c[0], c[1]); code < 400 {
			t.Errorf("%s accepted: %d", name, code)
		}
	}
	if body2 := get(h, "127.0.0.1:5886", "/api/props").Body.String(); body2 != body {
		t.Fatalf("a refused PUT changed the layout: %s", body2)
	}
	if code := put(same, `{"rooms":{"wall":{"decor:0:clock":{"x":0,"y":0,"hidden":true},"decor:1:poster":{"x":4,"y":0,"hidden":false}}}}`); code != 204 {
		t.Fatalf("hidden put: %d", code)
	}
	hidden := get(h, "127.0.0.1:5886", "/api/props").Body.String()
	if !strings.Contains(hidden, `"decor:0:clock":{"x":0,"y":0,"hidden":true}`) || !strings.Contains(hidden, `"decor:1:poster":{"x":4,"y":0}`) {
		t.Fatalf("hidden round trip: %s", hidden)
	}
	if code := put(same, `{"rooms":{"r":{"k":{"x":0,"y":0,"hidden":"yes"}}}}`); code != 400 {
		t.Fatalf("non-bool hidden accepted: %d", code)
	}
	os.WriteFile(path, []byte("broken"), 0o600)
	if body := get(h, "127.0.0.1:5886", "/api/props").Body.String(); strings.TrimSpace(body) != `{"rooms":{}}` {
		t.Fatalf("broken file: %s", body)
	}
}
