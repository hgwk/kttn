// Package server is `kttn serve`: it receives hook events and serves the
// office's state and screen, on this computer only.
package server

import (
	"crypto/subtle"
	"encoding/json"
	"io"
	"net/http"
	"time"

	"github.com/hgwk/kttn/internal/office"
	"github.com/hgwk/kttn/internal/terminal"
)

// maxEventBytes bounds one hook body; the hook keeps labels short.
const maxEventBytes = 4096

// Settings are the onboarding values the screen shows.
type Settings struct {
	OfficeName string `json:"officeName"`
	Lang       string `json:"lang"`
	// Messages says whether typing into a session from the screen is on.
	Messages bool `json:"messages"`
	// Configured is false until `kttn init` has run; the screen then shows how.
	Configured bool `json:"configured"`
}

// Options configures a server.
type Options struct {
	Store    *office.Store
	Settings Settings
	// Token, when set, must arrive as "Authorization: Bearer <token>".
	Token string
	// ScreenKey, when set, must arrive as X-Kttn-Key on everything the
	// screen reads or does: the snapshot, focus, message and props.
	ScreenKey string
	// StatePath is the restart file; empty keeps state in memory only.
	StatePath string
	Now       func() time.Time
	// Focus brings a Claude Code process's terminal tab forward.
	Focus func(pid int) error
	// Send types a message into a session's input.
	Send func(pid int, state, text string) error
	// EmbedOrigins may show the office in an iframe; every other site may not.
	EmbedOrigins []string
	// PropsPath keeps where people dragged lounge props; empty keeps them
	// nowhere (GET answers an empty layout, PUT is refused).
	PropsPath string
	// CatsPath keeps the cat catalog; empty turns the catalog off.
	CatsPath string
}

// Snapshot is what the screen polls.
type Snapshot struct {
	Agents      []office.Agent `json:"agents"`
	Settings    Settings       `json:"settings"`
	GeneratedAt string         `json:"generatedAt"`
}

// Handler serves the office. SaveNow writes the sessions at once, for a
// server that is about to stop.
type Handler struct {
	http.Handler
	state *stateFile
	cats  *catBook
}

// SaveNow writes pending session state and catalog instead of waiting for
// their timers.
func (h *Handler) SaveNow() {
	h.state.flush()
	if h.cats != nil {
		h.cats.flush()
	}
}

// New builds the handler and loads saved sessions.
func New(opts Options) *Handler {
	if opts.Now == nil {
		opts.Now = time.Now
	}
	if opts.Focus == nil {
		opts.Focus = func(int) error { return terminal.ErrNoTab }
	}
	if opts.Send == nil {
		opts.Send = func(int, string, string) error { return terminal.ErrNoTab }
	}
	state := &stateFile{path: opts.StatePath, store: opts.Store}
	state.load()
	var cats *catBook
	if opts.CatsPath != "" {
		cats = newCatBook(opts.CatsPath, opts.Now)
	}
	mux := http.NewServeMux()
	mux.HandleFunc("POST /api/events", func(w http.ResponseWriter, r *http.Request) {
		body, ok := reportBody(w, r, opts.Token)
		if !ok {
			return
		}
		event, err := office.ParseEvent(body)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}
		agent := opts.Store.Apply(event)
		state.schedule()
		if cats != nil {
			cats.record(agent, event, liveSessions(opts.Store))
		}
		writeJSON(w, http.StatusOK, map[string]any{"ok": true, "state": agent.State})
	})
	mux.HandleFunc("GET /api/snapshot", func(w http.ResponseWriter, r *http.Request) {
		// An office not set up yet answers anyone with its onboarding
		// settings and no sessions, so the screen can say how to set up.
		agents := []office.Agent{}
		if opts.Settings.Configured {
			if !screenKeyOK(w, r, opts.ScreenKey) {
				return
			}
			agents = opts.Store.Snapshot()
		}
		w.Header().Set("Cache-Control", "no-store")
		writeJSON(w, http.StatusOK, Snapshot{
			Agents:      agents,
			Settings:    opts.Settings,
			GeneratedAt: opts.Now().UTC().Format("2006-01-02T15:04:05.000Z"),
		})
	})
	mux.HandleFunc("POST /api/focus", withScreenKey(opts.ScreenKey, focusHandler(opts)))
	mux.HandleFunc("POST /api/message", withScreenKey(opts.ScreenKey, messageHandler(opts)))
	if opts.PropsPath != "" {
		getProps, putProps := propsHandlers(&propsFile{path: opts.PropsPath})
		mux.HandleFunc("GET /api/props", withScreenKey(opts.ScreenKey, getProps))
		mux.HandleFunc("PUT /api/props", withScreenKey(opts.ScreenKey, putProps))
	}
	if cats != nil {
		list, name, clear := catsHandlers(cats)
		mux.HandleFunc("GET /api/cats", withScreenKey(opts.ScreenKey, list))
		mux.HandleFunc("PUT /api/cats/name", withScreenKey(opts.ScreenKey, name))
		mux.HandleFunc("DELETE /api/cats", withScreenKey(opts.ScreenKey, clear))
	}
	mux.Handle("GET /", staticHandler())
	return &Handler{Handler: withLoopback(withFrameAncestors(opts.EmbedOrigins, mux)), state: state, cats: cats}
}

// liveSessions counts the sessions at the office now: not gone home, not a
// headless run.
func liveSessions(store *office.Store) int {
	n := 0
	for _, a := range store.Snapshot() {
		if a.State != "ended" && !a.Headless {
			n++
		}
	}
	return n
}

// reportBody admits a report from a local program (the hook)
// and decodes it. It writes the refusal itself when it says no.
func reportBody(w http.ResponseWriter, r *http.Request, token string) (any, bool) {
	if !hookRequest(r) {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "forbidden"})
		return nil, false
	}
	if token != "" {
		want := []byte("Bearer " + token)
		if subtle.ConstantTimeCompare([]byte(r.Header.Get("Authorization")), want) != 1 {
			writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "bad token"})
			return nil, false
		}
	}
	raw, err := io.ReadAll(io.LimitReader(r.Body, maxEventBytes+1))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "unreadable body"})
		return nil, false
	}
	if len(raw) > maxEventBytes {
		writeJSON(w, http.StatusRequestEntityTooLarge, map[string]string{"error": "body too large"})
		return nil, false
	}
	var body any
	if json.Unmarshal(raw, &body) != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
		return nil, false
	}
	return body, true
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}
