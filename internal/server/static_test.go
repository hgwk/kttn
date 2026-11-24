package server

import (
	"io/fs"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/hgwk/kttn/internal/office"
)

func get(h http.Handler, host, path string) *httptest.ResponseRecorder {
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "http://"+host+path, nil))
	return rec
}

// These need the screen build in internal/server/web.
func TestTheInstallableAppIsServedToThisComputer(t *testing.T) {
	if _, err := fs.Stat(webFiles, "web/index.html"); err != nil {
		t.Skip("screen not built; run npm --prefix web run build")
	}
	h, _ := newServer(t, "", "")
	page := get(h, "127.0.0.1:5886", "/")
	if page.Code != 200 || !strings.Contains(page.Body.String(), `rel="manifest"`) {
		t.Fatalf("index: %d %.80s", page.Code, page.Body.String())
	}
	manifest := get(h, "localhost:5886", "/manifest.webmanifest")
	if manifest.Code != 200 || manifest.Header().Get("Content-Type") != "application/manifest+json" ||
		!strings.Contains(manifest.Body.String(), `"display": "standalone"`) {
		t.Fatalf("manifest: %d %s", manifest.Code, manifest.Header().Get("Content-Type"))
	}
	for _, icon := range []string{"/icons/office-icon-192.png", "/icons/office-icon-512.png", "/icons/office-icon-maskable-512.png"} {
		if rec := get(h, "127.0.0.1:5886", icon); rec.Code != 200 || rec.Header().Get("Content-Type") != "image/png" {
			t.Errorf("%s: %d %s", icon, rec.Code, rec.Header().Get("Content-Type"))
		}
	}
	if rec := get(h, "127.0.0.1:5886", "/some/room"); rec.Code != 200 || !strings.Contains(rec.Body.String(), "<div id=\"root\">") {
		t.Fatalf("fallback: %d", rec.Code)
	}
	if rec := get(h, "evil.example:5886", "/manifest.webmanifest"); rec.Code != 403 {
		t.Fatalf("rebound host got the app: %d", rec.Code)
	}
}

func TestAutomationReportsReachTheSnapshot(t *testing.T) {
	store := office.NewStore(time.Now, func(int) bool { return true })
	h := New(Options{Store: store, Settings: Settings{OfficeName: "우리 팀", HomeRepo: "myrepo", Lang: "ko"}})
	send := func(headers map[string]string, body string) int {
		req := httptest.NewRequest(http.MethodPost, "http://127.0.0.1/api/automation", strings.NewReader(body))
		for k, v := range headers {
			req.Header.Set(k, v)
		}
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)
		return rec.Code
	}
	if code := send(jsonType, `{"key":"nightly","label":"Nightly build","state":"running"}`); code != 200 {
		t.Fatalf("report: %d", code)
	}
	if code := send(jsonType, `{"key":"x","state":"exploded"}`); code != 400 {
		t.Fatalf("bad state: %d", code)
	}
	browser := map[string]string{"Content-Type": "application/json", "Origin": "http://evil.example"}
	if code := send(browser, `{"key":"y","state":"ok"}`); code != 403 {
		t.Fatalf("browser report: %d", code)
	}
	body := get(h, "127.0.0.1", "/api/snapshot").Body.String()
	for _, want := range []string{`"label":"Nightly build"`, `"state":"running"`, `"officeName":"우리 팀"`, `"homeRepo":"myrepo"`} {
		if !strings.Contains(body, want) {
			t.Errorf("snapshot lacks %s: %s", want, body)
		}
	}
	if strings.Contains(body, `"key":"y"`) {
		t.Fatal("refused report reached the snapshot")
	}
}
