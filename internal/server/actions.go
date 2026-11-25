package server

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"

	"github.com/hgwk/kttn/internal/sessions"
	"github.com/hgwk/kttn/internal/terminal"
)

// screenAction admits a button press from kttn screen only: addressed to
// this computer, sent by a page served from the same address, and JSON. A
// JSON POST from another site needs a CORS preflight that this server never
// grants, and its Origin would not match.
func screenAction(r *http.Request) bool {
	if !loopbackHost(r) || r.Header.Get("Origin") != "http://"+r.Host {
		return false
	}
	return strings.HasPrefix(r.Header.Get("Content-Type"), "application/json")
}

type actionBody struct {
	Key  string `json:"key"`
	Text string `json:"text"`
}

// readAction reads {"key", "text"} from a screen request of at most limit
// bytes.
func readAction(r *http.Request, limit int64) (actionBody, bool) {
	var body actionBody
	raw, err := io.ReadAll(io.LimitReader(r.Body, limit+1))
	if err != nil || int64(len(raw)) > limit {
		return body, false
	}
	if json.Unmarshal(raw, &body) != nil || body.Key == "" {
		return body, false
	}
	return body, true
}

// terminalStatus maps a terminal result to the status the screen explains.
func terminalStatus(w http.ResponseWriter, err error) {
	switch {
	case err == nil:
		writeJSON(w, http.StatusOK, map[string]any{"ok": true})
	case errors.Is(err, terminal.ErrEmpty):
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
	case errors.Is(err, terminal.ErrTooLong):
		writeJSON(w, http.StatusRequestEntityTooLarge, map[string]string{"error": err.Error()})
	case errors.Is(err, terminal.ErrNoProcess), errors.Is(err, terminal.ErrNotReady):
		writeJSON(w, http.StatusConflict, map[string]string{"error": err.Error()})
	case errors.Is(err, terminal.ErrNoTab):
		writeJSON(w, http.StatusNotFound, map[string]string{"error": err.Error()})
	default:
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "terminal unavailable"})
	}
}

// actionTarget admits a screen request and finds the session it names.
func actionTarget(w http.ResponseWriter, r *http.Request, store *sessions.Store, limit int64) (sessions.Agent, actionBody, bool) {
	if !screenAction(r) {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "forbidden"})
		return sessions.Agent{}, actionBody{}, false
	}
	body, ok := readAction(r, limit)
	if !ok {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "bad body"})
		return sessions.Agent{}, body, false
	}
	agent, ok := findAgent(store, body.Key)
	if !ok {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "unknown session"})
		return agent, body, false
	}
	return agent, body, true
}

func findAgent(store *sessions.Store, key string) (sessions.Agent, bool) {
	for _, agent := range store.Snapshot() {
		if agent.Key == key {
			return agent, true
		}
	}
	return sessions.Agent{}, false
}

// focusHandler brings the clicked cat's terminal tab forward.
func focusHandler(opts Options) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if agent, _, ok := actionTarget(w, r, opts.Store, 1024); ok {
			terminalStatus(w, opts.Focus(agent.PID))
		}
	}
}

// messageHandler types the speech-bubble message into the session's input.
// It is off unless the user turned messages on. The text is never logged.
func messageHandler(opts Options) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !opts.Settings.Messages {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "messages are off; turn them on with kttn init"})
			return
		}
		// A Hangul character is three bytes in UTF-8; Send counts characters.
		if agent, body, ok := actionTarget(w, r, opts.Store, terminal.MaxMessage*4+512); ok {
			terminalStatus(w, opts.Send(agent.PID, agent.State, body.Text))
		}
	}
}
