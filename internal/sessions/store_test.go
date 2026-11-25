package sessions

import (
	"reflect"
	"strings"
	"testing"
	"time"
)

func TestHookEventsMoveTheCharacterThroughItsStates(t *testing.T) {
	store, _ := clockedStore(nil)
	steps := []struct {
		event Event
		want  string
	}{
		{ev(t, "SessionStart", nil), "idle"},
		{ev(t, "UserPromptSubmit", nil), "thinking"},
		{ev(t, "PreToolUse", m{"tool": "Read", "detail": "main.go"}), "reading"},
		{ev(t, "PreToolUse", m{"tool": "Edit"}), "editing"},
		{ev(t, "PreToolUse", m{"tool": "Bash", "detail": "go"}), "running"},
		{ev(t, "PreToolUse", m{"tool": "WebFetch"}), "browsing"},
		{ev(t, "PreToolUse", m{"tool": "mcp__github__get_issue"}), "working"},
		{ev(t, "PermissionRequest", nil), "needs_you"},
		{ev(t, "PostToolUse", m{"tool": "Bash"}), "thinking"},
		{ev(t, "Stop", nil), "done"},
		{ev(t, "SessionEnd", nil), "ended"},
	}
	for _, step := range steps {
		if got := store.Apply(step.event).State; got != step.want {
			t.Errorf("%s: want %s, got %s", step.event.Event, step.want, got)
		}
	}
	if got := store.Snapshot()[0].ToolCount; got != 5 {
		t.Fatalf("tool_count %d", got)
	}
}

func TestSubagentsComeGoCapAndLeaveWithTheSession(t *testing.T) {
	store, _ := clockedStore(nil)
	store.Apply(ev(t, "PreToolUse", m{"tool": "Agent", "detail": "Explore", "tool_use_id": "t1"}))
	if store.Snapshot()[0].State != "delegating" {
		t.Fatal("want delegating")
	}
	store.Apply(ev(t, "SubagentStart", m{"detail": "Explore", "tool_use_id": "a"}))
	store.Apply(ev(t, "SubagentStart", m{"detail": "Plan", "tool_use_id": "b"}))
	store.Apply(ev(t, "SubagentStart", m{"detail": "Plan", "tool_use_id": "b"}))
	// A background subagent stays even when PostToolUse comes first.
	store.Apply(ev(t, "PostToolUse", m{"tool": "Agent", "tool_use_id": "t1"}))
	if n := len(store.Snapshot()[0].Minions); n != 2 {
		t.Fatalf("minions %d", n)
	}
	store.Apply(ev(t, "SubagentStop", m{"tool_use_id": "a"}))
	if got := store.Snapshot()[0].Minions; !reflect.DeepEqual(got, []Minion{{ID: "b", Label: "Plan"}}) {
		t.Fatalf("minions %+v", got)
	}
	for i := 0; i < 20; i++ {
		store.Apply(ev(t, "SubagentStart", m{"tool_use_id": "x" + string(rune('a'+i))}))
	}
	if n := len(store.Snapshot()[0].Minions); n != MaxMinions {
		t.Fatalf("cap %d", n)
	}
	store.Apply(ev(t, "SessionEnd", nil))
	if n := len(store.Snapshot()[0].Minions); n != 0 {
		t.Fatalf("after end %d", n)
	}
}

func TestStatusSinceMovesOnlyWhenTheStateChanges(t *testing.T) {
	store, c := clockedStore(nil)
	first := store.Apply(ev(t, "PreToolUse", m{"tool": "Read"})).StatusSince
	c.now = c.now.Add(time.Minute)
	if got := store.Apply(ev(t, "PreToolUse", m{"tool": "Grep"})).StatusSince; got != first {
		t.Fatalf("moved to %s", got)
	}
	c.now = c.now.Add(time.Minute)
	if got := store.Apply(ev(t, "Stop", nil)).StatusSince; got == first {
		t.Fatal("did not move")
	}
}

func TestSessionsInTheSameFolderStaySeparate(t *testing.T) {
	store, _ := clockedStore(nil)
	store.Apply(ev(t, "SessionStart", nil))
	store.Apply(ev(t, "SessionStart", m{"session": "s2"}))
	if n := len(store.Snapshot()); n != 2 {
		t.Fatalf("got %d", n)
	}
}

func TestRejectsMalformedEventsAndTrimsLongFields(t *testing.T) {
	for name, body := range map[string]any{
		"null":            nil,
		"string":          "nope",
		"missing source":  m{"session": "s", "event": "Stop"},
		"missing session": m{"source": "claude", "event": "Stop"},
		"unknown event":   m{"source": "claude", "session": "s", "event": "Dance"},
	} {
		if _, err := ParseEvent(body); err == nil {
			t.Errorf("%s should fail", name)
		}
	}
	long := ev(t, "Stop", m{"project": strings.Repeat("가", 100), "detail": "a\n  b"})
	if n := len([]rune(long.Project)); n != MaxField {
		t.Errorf("project %d runes", n)
	}
	if long.Detail != "a b" {
		t.Errorf("detail %q", long.Detail)
	}
	if got := ev(t, "Stop", m{"folder": "../a/./b//c"}).Folder; got != "a/b/c" {
		t.Errorf("folder %q", got)
	}
}

func TestEndedAndSilentSessionsAreDroppedAfterTheirLimits(t *testing.T) {
	store, c := clockedStore(nil)
	store.Apply(ev(t, "SessionEnd", nil))
	store.Apply(ev(t, "Stop", m{"session": "s2"}))
	c.now = c.now.Add(EndKeep + time.Second)
	if got := sessions(store.Snapshot()); !reflect.DeepEqual(got, []string{"s2"}) {
		t.Fatalf("got %v", got)
	}
	c.now = c.now.Add(IdleLimit)
	if n := len(store.Snapshot()); n != 0 {
		t.Fatalf("got %d", n)
	}
}

func TestSnapshotsAreCopies(t *testing.T) {
	store, _ := clockedStore(nil)
	store.Apply(ev(t, "SubagentStart", m{"tool_use_id": "a"}))
	snap := store.Snapshot()
	snap[0].Minions = append(snap[0].Minions, Minion{ID: "z", Label: "z"})
	if n := len(store.Snapshot()[0].Minions); n != 1 {
		t.Fatalf("got %d", n)
	}
}

func TestTheLastFinishedAnswerStaysUntilTheNextStopReplacesIt(t *testing.T) {
	store, c := clockedStore(nil)
	store.Apply(ev(t, "Stop", m{"result": "고쳤습니다.\n테스트 통과"}))
	first := store.Snapshot()[0]
	if first.Result != "고쳤습니다. 테스트 통과" || first.ResultAt != "2026-11-19T09:00:00.000Z" {
		t.Fatalf("got %q %q", first.Result, first.ResultAt)
	}
	c.now = c.now.Add(time.Minute)
	store.Apply(ev(t, "UserPromptSubmit", nil))
	store.Apply(ev(t, "PreToolUse", m{"tool": "Read", "result": "무시"}))
	store.Apply(ev(t, "Stop", nil))
	if got := store.Snapshot()[0].Result; got != "고쳤습니다. 테스트 통과" {
		t.Fatalf("got %q", got)
	}
	store.Apply(ev(t, "Stop", m{"result": "새 결과"}))
	if got := store.Snapshot()[0]; got.Result != "새 결과" || got.ResultAt != "2026-11-19T09:01:00.000Z" {
		t.Fatalf("got %q %q", got.Result, got.ResultAt)
	}
	if n := len([]rune(ev(t, "Stop", m{"result": strings.Repeat("가", 400)}).Result)); n != MaxResult {
		t.Fatalf("result %d runes", n)
	}
}

func TestARestartedStorePicksUpSavedSessionsAndDropsBadRows(t *testing.T) {
	store, c := clockedStore(nil)
	store.Apply(ev(t, "SubagentStart", m{"detail": "Plan", "tool_use_id": "a"}))
	store.Apply(ev(t, "Stop", m{"session": "s2", "result": "끝"}))
	good := saved(t, store)
	rows := strings.TrimSuffix(string(good), "]") +
		`,null,{"key":"x"},{"key":"y","updated_at":"nope"},{"key":"z","minions":"bad","updated_at":"2026-11-19T09:00:00.000Z"}]`
	next := NewStore(c.read, func(int) bool { return false })
	next.Restore([]byte(rows))
	next.Restore([]byte("junk"))
	if !reflect.DeepEqual(saved(t, next), good) {
		t.Fatalf("restored\n%s\nwant\n%s", saved(t, next), good)
	}
	c.now = c.now.Add(IdleLimit + time.Second)
	if n := len(next.Snapshot()); n != 0 {
		t.Fatalf("got %d", n)
	}
}
