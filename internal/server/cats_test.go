package server

import (
	"encoding/json"
	"fmt"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/hgwk/kttn/internal/office"
)

type catClock struct{ at time.Time }

func (c *catClock) now() time.Time { return c.at }

func catServer(t *testing.T) (*Handler, string, *catClock) {
	t.Helper()
	clock := &catClock{at: time.Date(2026, 11, 25, 9, 0, 0, 0, time.UTC)}
	path := filepath.Join(t.TempDir(), "cats.json")
	store := office.NewStore(clock.now, func(int) bool { return true })
	h := New(Options{Store: store, Now: clock.now, ScreenKey: "k", CatsPath: path, Settings: Settings{Configured: true}})
	return h, path, clock
}

func catCall(h *Handler, method, path, key, body string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, "http://127.0.0.1:5886"+path, strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Origin", "http://127.0.0.1:5886")
	if key != "" {
		req.Header.Set("X-Kttn-Key", key)
	}
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

func catList(t *testing.T, h *Handler) []cat {
	t.Helper()
	var got struct{ Cats []cat }
	if err := json.Unmarshal(catCall(h, "GET", "/api/cats", "k", "").Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	return got.Cats
}

func hookEvent(h *Handler, session, event string, extra string) {
	post(h, "127.0.0.1:5886", jsonType, `{"source":"claude","session":"`+session+`","project":"repo","event":"`+event+`"`+extra+`}`)
}

func TestTheCatalogKeepsEverySessionItSawInTheOrderItMetThem(t *testing.T) {
	h, path, clock := catServer(t)
	hookEvent(h, "b", "UserPromptSubmit", `,"name":"work-eb","model":"opus"`)
	clock.at = clock.at.Add(time.Minute)
	hookEvent(h, "a", "PreToolUse", `,"tool":"Read"`)
	hookEvent(h, "b", "PreToolUse", `,"tool":"Read"`)
	hookEvent(h, "b", "PreToolUse", `,"tool":"Edit"`)
	hookEvent(h, "p", "SessionStart", `,"headless":true`)
	cats := catList(t, h)
	if len(cats) != 2 || cats[0].Key != "claude|b" || cats[1].Key != "claude|a" {
		t.Fatalf("cats %+v", cats)
	}
	b := cats[0]
	if b.SessionName != "work-eb" || b.Model != "opus" || b.Tools != 2 || b.FirstSeen != "2026-11-25T09:00:00.000Z" || b.LastSeen != "2026-11-25T09:01:00.000Z" {
		t.Fatalf("b %+v", b)
	}
	h.SaveNow()
	if info, err := os.Stat(path); err != nil || info.Mode().Perm() != 0o600 {
		t.Fatalf("saved %v %v", info, err)
	}
	again, _, _ := catServer(t)
	again.cats = newCatBook(path, clock.now)
	if got := again.cats.list(); len(got) != 2 {
		t.Fatalf("after a restart %+v", got)
	}
}

func TestTheScreensPickFillsANameAndAPersonsRenameReplacesIt(t *testing.T) {
	h, _, _ := catServer(t)
	hookEvent(h, "a", "Stop", "")
	for _, c := range []struct {
		key, body string
		want      int
	}{
		{"", `{"key":"claude|a","cat_name":"Nabi"}`, 401},
		{"wrong", `{"key":"claude|a","cat_name":"Nabi"}`, 401},
		{"k", `{"key":"claude|a","cat_name":"` + strings.Repeat("가", 33) + `"}`, 400},
		{"k", `{"key":"claude|a","cat_name":"Na\u0007bi"}`, 400},
		{"k", `{"key":"claude|a","cat_name":"   "}`, 400},
		{"k", `{"key":"claude|zz","cat_name":"Nabi"}`, 404},
		{"k", `{"key":"claude|a","cat_name":" Nabi "}`, 200},
		{"k", `{"key":"claude|a","cat_name":"Later"}`, 200},
	} {
		if rec := catCall(h, "PUT", "/api/cats/name", c.key, c.body); rec.Code != c.want {
			t.Errorf("%s %s: %d %s", c.key, c.body, rec.Code, rec.Body)
		}
	}
	if got := catList(t, h)[0].CatName; got != "Nabi" {
		t.Fatalf("the screen's pick renamed the cat: %q", got)
	}
	if rec := catCall(h, "PUT", "/api/cats/name", "k", `{"key":"claude|a","cat_name":"Navi","replace":true}`); rec.Code != 200 || !strings.Contains(rec.Body.String(), `"cat_name":"Navi"`) {
		t.Fatalf("rename %d %s", rec.Code, rec.Body)
	}
	req := httptest.NewRequest("PUT", "http://127.0.0.1:5886/api/cats/name", strings.NewReader(`{"key":"claude|a","cat_name":"x"}`))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Origin", "http://evil.example")
	req.Header.Set("X-Kttn-Key", "k")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != 403 {
		t.Fatalf("foreign origin: %d", rec.Code)
	}
	if code := catCall(h, "GET", "/api/cats", "", "").Code; code != 401 {
		t.Fatalf("list without the key: %d", code)
	}
}

func TestTheCatalogForgetsAfter90DaysBeyond1000AndOnClear(t *testing.T) {
	h, path, clock := catServer(t)
	hookEvent(h, "old", "Stop", "")
	clock.at = clock.at.Add(catKeep - time.Hour)
	hookEvent(h, "new", "Stop", "")
	clock.at = clock.at.Add(2 * time.Hour)
	if cats := catList(t, h); len(cats) != 1 || cats[0].Key != "claude|new" {
		t.Fatalf("after 90 days %+v", cats)
	}
	for i := 0; i < maxCats+5; i++ {
		clock.at = clock.at.Add(time.Second)
		hookEvent(h, fmt.Sprintf("s%04d", i), "Stop", "")
	}
	cats := catList(t, h)
	if len(cats) != maxCats || cats[0].Key != "claude|s0005" {
		t.Fatalf("kept %d, first %s", len(cats), cats[0].Key)
	}
	if code := catCall(h, "DELETE", "/api/cats", "", "").Code; code != 401 {
		t.Fatalf("clear without the key: %d", code)
	}
	if code := catCall(h, "DELETE", "/api/cats", "k", "").Code; code != 204 {
		t.Fatalf("clear: %d", code)
	}
	raw, _ := os.ReadFile(path)
	if len(catList(t, h)) != 0 || string(raw) != `{"cats":[]}` {
		t.Fatalf("after clear %s", raw)
	}
}
