package server

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/hgwk/kttn/internal/office"
)

// saveDelay batches a burst of hook events into one write.
const saveDelay = time.Second

// StatePath is where sessions survive a restart: KTTN_STATE, else
// $XDG_STATE_HOME/kttn/sessions.json, else ~/.local/state/kttn/sessions.json.
func StatePath() string {
	if path := os.Getenv("KTTN_STATE"); path != "" {
		return path
	}
	base := os.Getenv("XDG_STATE_HOME")
	if base == "" {
		home, err := os.UserHomeDir()
		if err != nil {
			return ""
		}
		base = filepath.Join(home, ".local", "state")
	}
	return filepath.Join(base, "kttn", "sessions.json")
}

// stateFile writes the store's sessions a moment after they change. It is
// only a restart aid: a missing or broken file starts an empty office, and a
// failed write leaves the screen running from memory.
type stateFile struct {
	path  string
	store *office.Store
	mu    sync.Mutex
	timer *time.Timer
}

func (f *stateFile) load() {
	if f.path == "" {
		return
	}
	if data, err := os.ReadFile(f.path); err == nil {
		f.store.Restore(data)
	}
}

func (f *stateFile) schedule() {
	if f.path == "" {
		return
	}
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.timer == nil {
		f.timer = time.AfterFunc(saveDelay, f.save)
	}
}

func (f *stateFile) save() {
	f.mu.Lock()
	f.timer = nil
	f.mu.Unlock()
	data, err := json.Marshal(f.store.Snapshot())
	if err != nil {
		return
	}
	if os.MkdirAll(filepath.Dir(f.path), 0o700) != nil {
		return
	}
	temp := f.path + ".tmp"
	if os.WriteFile(temp, data, 0o600) == nil {
		_ = os.Rename(temp, f.path)
	}
}
