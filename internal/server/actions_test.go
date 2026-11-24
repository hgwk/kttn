package server

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/hgwk/kttn/internal/office"
	"github.com/hgwk/kttn/internal/terminal"
)

func TestFocusTakesOnlyScreenClicksAndReportsWhatHappened(t *testing.T) {
	store := office.NewStore(time.Now, func(int) bool { return true })
	var focused []int
	result := error(nil)
	h := New(Options{Store: store, Focus: func(pid int) error {
		focused = append(focused, pid)
		return result
	}})
	post(h, "127.0.0.1:5886", jsonType, `{"source":"claude","session":"s1","event":"UserPromptSubmit","pid":4242}`)
	click := func(host, origin, body string) int {
		req := httptest.NewRequest(http.MethodPost, "http://"+host+"/api/focus", strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		if origin != "" {
			req.Header.Set("Origin", origin)
		}
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)
		return rec.Code
	}
	const key = `{"key":"claude|s1"}`
	if code := click("127.0.0.1:5886", "http://127.0.0.1:5886", key); code != 200 || len(focused) != 1 || focused[0] != 4242 {
		t.Fatalf("click: %d %v", code, focused)
	}
	for name, c := range map[string][2]string{
		"no origin":    {"127.0.0.1:5886", ""},
		"other site":   {"127.0.0.1:5886", "http://evil.example"},
		"rebound host": {"evil.example:5886", "http://evil.example:5886"},
		"other port":   {"127.0.0.1:5886", "http://127.0.0.1:3000"},
	} {
		if code := click(c[0], c[1], key); code != 403 {
			t.Errorf("%s: %d", name, code)
		}
	}
	if len(focused) != 1 {
		t.Fatalf("refused clicks reached the terminal: %v", focused)
	}
	same := "http://127.0.0.1:5886"
	if code := click("127.0.0.1:5886", same, `{"key":"claude|nope"}`); code != 404 {
		t.Fatalf("unknown session: %d", code)
	}
	result = terminal.ErrNoTab
	if code := click("127.0.0.1:5886", same, key); code != 404 {
		t.Fatalf("no tab: %d", code)
	}
	result = terminal.ErrNoProcess
	if code := click("127.0.0.1:5886", same, key); code != 409 {
		t.Fatalf("no process: %d", code)
	}
}

func TestMessagesGoToTheSessionUnderTheSameGuard(t *testing.T) {
	store := office.NewStore(time.Now, func(int) bool { return true })
	var got []string
	h := New(Options{Store: store, Settings: Settings{Messages: true}, Send: func(pid int, state, text string) error {
		got = append(got, state+":"+text)
		if state == "needs_you" {
			return terminal.ErrNotReady
		}
		return nil
	}})
	post(h, "127.0.0.1", jsonType, `{"source":"claude","session":"s1","event":"Stop","pid":4242}`)
	send := func(origin, body string) int {
		req := httptest.NewRequest(http.MethodPost, "http://127.0.0.1:5886/api/message", strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Origin", origin)
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)
		return rec.Code
	}
	if code := send("http://127.0.0.1:5886", `{"key":"claude|s1","text":"다음 작업"}`); code != 200 || len(got) != 1 || got[0] != "done:다음 작업" {
		t.Fatalf("send: %d %v", code, got)
	}
	if code := send("http://evil.example", `{"key":"claude|s1","text":"rm -rf"}`); code != 403 || len(got) != 1 {
		t.Fatalf("cross-site message: %d %v", code, got)
	}
	post(h, "127.0.0.1", jsonType, `{"source":"claude","session":"s1","event":"PermissionRequest"}`)
	if code := send("http://127.0.0.1:5886", `{"key":"claude|s1","text":"yes"}`); code != 409 {
		t.Fatalf("waiting session: %d", code)
	}
}

func TestMessagesAreOffUnlessTurnedOn(t *testing.T) {
	store := office.NewStore(time.Now, func(int) bool { return true })
	sent := 0
	h := New(Options{Store: store, Send: func(int, string, string) error { sent++; return nil }})
	post(h, "127.0.0.1", jsonType, `{"source":"claude","session":"s1","event":"Stop","pid":4242}`)
	req := httptest.NewRequest(http.MethodPost, "http://127.0.0.1:5886/api/message", strings.NewReader(`{"key":"claude|s1","text":"hi"}`))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Origin", "http://127.0.0.1:5886")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != 403 || sent != 0 || !strings.Contains(rec.Body.String(), "kttn init") {
		t.Fatalf("messages off: %d %q sent %d", rec.Code, rec.Body.String(), sent)
	}
	if body := get(h, "127.0.0.1", "/api/snapshot").Body.String(); !strings.Contains(body, `"messages":false`) {
		t.Fatalf("snapshot does not tell the screen: %s", body)
	}
}
