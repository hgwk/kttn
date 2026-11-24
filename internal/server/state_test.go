package server

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/hgwk/kttn/internal/office"
)

// A stopping server writes the last second of events instead of losing it
// with the save timer.
func TestSaveNowWritesWhatTheTimerWasWaitingFor(t *testing.T) {
	path := filepath.Join(t.TempDir(), "state.json")
	h := New(Options{Store: office.NewStore(time.Now, nil), StatePath: path})
	h.SaveNow()
	if _, err := os.Stat(path); err == nil {
		t.Fatal("nothing was waiting, yet a file was written")
	}
	post(h, "127.0.0.1:5886", jsonType, `{"source":"claude","session":"last","event":"Stop"}`)
	h.SaveNow()
	if data, _ := os.ReadFile(path); !strings.Contains(string(data), `"last"`) {
		t.Fatalf("state %s", data)
	}
}
