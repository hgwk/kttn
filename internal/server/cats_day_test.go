package server

import (
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/hgwk/kttn/internal/office"
)

func dayBook(t *testing.T, path string) (*catBook, *catClock) {
	t.Helper()
	clock := &catClock{at: time.Date(2026, 11, 26, 10, 0, 0, 0, time.UTC)}
	return newCatBook(path, clock.now), clock
}

// A session the store forgot (idle, ended, restarted without state) comes
// back counting from 0; its new tools still count, today and in all.
func TestAResumedSessionKeepsCountingAfterItsCountStartsOver(t *testing.T) {
	b, _ := dayBook(t, filepath.Join(t.TempDir(), "cats.json"))
	cat := office.Agent{Key: "claude|a", Source: "claude", State: "thinking"}
	for _, n := range []int{1, 2, 3, 1, 2} {
		cat.ToolCount = n
		b.record(cat, office.Event{Event: "PreToolUse"}, 1)
	}
	got := b.list()[0]
	if got.Tools != 5 || got.Day == nil || got.Day.Tools != 5 || got.LastCount != 2 {
		t.Fatalf("tools %d, day %+v, last %d", got.Tools, got.Day, got.LastCount)
	}
}

// A catalog saved before last_count takes its tools as the last count, so
// the first event after the upgrade does not count them all again.
func TestACatalogFromBeforeLastCountDoesNotCountItsToolsTwice(t *testing.T) {
	path := filepath.Join(t.TempDir(), "cats.json")
	old := `{"cats":[{"key":"claude|a","source":"claude","first_seen":"2026-11-26T09:00:00.000Z","last_seen":"2026-11-26T09:00:00.000Z","tools":5}]}`
	if err := os.WriteFile(path, []byte(old), 0o600); err != nil {
		t.Fatal(err)
	}
	b, _ := dayBook(t, path)
	b.record(office.Agent{Key: "claude|a", Source: "claude", State: "thinking", ToolCount: 6}, office.Event{Event: "PreToolUse"}, 1)
	if got := b.list()[0]; got.Tools != 6 || got.Day == nil || got.Day.Tools != 1 {
		t.Fatalf("tools %d, day %+v", got.Tools, got.Day)
	}
}

// Pressing Esc ends a tool with an interrupt; that is not a failure.
func TestAnInterruptIsNotAFailedTool(t *testing.T) {
	h, _, _ := catServer(t)
	hookEvent(h, "a", "PreToolUse", `,"tool":"Bash"`)
	hookEvent(h, "a", "PostToolUseFailure", `,"tool":"Bash","detail":"interrupt"`)
	hookEvent(h, "a", "PreToolUse", `,"tool":"Bash"`)
	hookEvent(h, "a", "PostToolUseFailure", `,"tool":"Bash","detail":"Bash"`)
	if day := catList(t, h)[0].Day; day == nil || day.Failures != 1 {
		t.Fatalf("day %+v", day)
	}
}
