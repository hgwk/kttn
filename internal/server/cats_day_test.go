package server

import (
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/hgwk/kttn/internal/sessions"
)

func dayBook(t *testing.T, path string) (*catBook, *catClock) {
	t.Helper()
	clock := &catClock{at: time.Date(2026, 11, 26, 10, 0, 0, 0, time.UTC)}
	return newCatBook(path, clock.now), clock
}

func (b *catBook) recordPre(a sessions.Agent, e sessions.Event) { b.record(a, e, 1) }

func pre(n int) (sessions.Agent, sessions.Event) {
	return sessions.Agent{Key: "claude|a", Source: "claude", State: "thinking", ToolCount: n}, sessions.Event{Event: "PreToolUse"}
}

// Events can be recorded in another order than the store applied them
// (parallel tools), and a session the store forgot counts from 0 again. The
// catalog counts each started tool once either way.
func TestEveryStartedToolCountsOnceWhateverTheOrderOrAResume(t *testing.T) {
	b, _ := dayBook(t, filepath.Join(t.TempDir(), "cats.json"))
	for _, n := range []int{1, 2, 3, 4, 6, 5, 7} {
		b.recordPre(pre(n))
	}
	late, _ := pre(3)
	b.record(late, sessions.Event{Event: "PostToolUse"}, 1)
	for _, n := range []int{1, 2} {
		b.recordPre(pre(n))
	}
	if got := b.list()[0]; got.Tools != 9 || got.Day == nil || got.Day.Tools != 9 {
		t.Fatalf("tools %d, day %+v", got.Tools, got.Day)
	}
	sub, event := pre(9)
	event.Subagent = "ag1"
	b.record(sub, event, 1)
	if got := b.list()[0]; got.Tools != 9 {
		t.Fatalf("a subagent's tool counted: %d", got.Tools)
	}
}

// A cat first met mid-session starts from the session's count; a file from
// 0.7.0 with last_count still loads and keeps counting by events.
func TestACatMetMidSessionAndA070FileStartWhereTheyAre(t *testing.T) {
	b, _ := dayBook(t, filepath.Join(t.TempDir(), "cats.json"))
	b.record(sessions.Agent{Key: "claude|m", Source: "claude", State: "thinking", ToolCount: 40}, sessions.Event{Event: "PostToolUse"}, 1)
	if got := b.list()[0]; got.Tools != 40 || got.Day != nil {
		t.Fatalf("mid-session %d %+v", got.Tools, got.Day)
	}
	path := filepath.Join(t.TempDir(), "cats.json")
	old := `{"cats":[{"key":"claude|a","source":"claude","first_seen":"2026-11-26T09:00:00.000Z","last_seen":"2026-11-26T09:00:00.000Z","tools":5,"last_count":5}]}`
	if err := os.WriteFile(path, []byte(old), 0o600); err != nil {
		t.Fatal(err)
	}
	b, _ = dayBook(t, path)
	b.recordPre(pre(6))
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
