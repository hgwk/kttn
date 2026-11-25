package sessions

import (
	"reflect"
	"testing"
	"time"
)

func TestOnlyNoticesThatWaitOnAPersonRaiseNeedsYou(t *testing.T) {
	store, _ := clockedStore(nil)
	store.Apply(ev(t, "Stop", nil))
	for detail, want := range map[string]string{"idle_prompt": "done", "auth_success": "done"} {
		if got := store.Apply(ev(t, "Notification", m{"detail": detail})).State; got != want {
			t.Errorf("%s: %s", detail, got)
		}
	}
	if got := store.Apply(ev(t, "Notification", m{"detail": "permission_prompt"})).State; got != "needs_you" {
		t.Errorf("permission_prompt: %s", got)
	}
	store.Apply(ev(t, "Stop", nil))
	if got := store.Apply(ev(t, "Notification", nil)).State; got != "needs_you" {
		t.Errorf("empty type: %s", got)
	}
}

func TestAHeadlessRunLeavesAsSoonAsItEnds(t *testing.T) {
	store, _ := clockedStore(nil)
	store.Apply(ev(t, "SessionStart", m{"session": "p", "headless": true}))
	store.Apply(ev(t, "SessionStart", m{"session": "i"}))
	store.Apply(ev(t, "SessionEnd", m{"session": "p"}))
	store.Apply(ev(t, "SessionEnd", m{"session": "i"}))
	if got := sessions(store.Snapshot()); !reflect.DeepEqual(got, []string{"i"}) {
		t.Fatalf("got %v", got)
	}
	if ev(t, "Stop", m{"headless": "yes"}).Headless {
		t.Fatal("only true counts")
	}
}

func TestToolsInsideASubagentLeaveTheParentAlone(t *testing.T) {
	store, _ := clockedStore(nil)
	store.Apply(ev(t, "SubagentStart", m{"detail": "Explore", "tool_use_id": "ag1"}))
	store.Apply(ev(t, "Stop", nil))
	if got := store.Apply(ev(t, "PreToolUse", m{"tool": "Read", "subagent": "ag1"})).State; got != "done" {
		t.Fatalf("got %s", got)
	}
	if store.Snapshot()[0].ToolCount != 0 {
		t.Fatal("subagent tool counted")
	}
	if got := store.Apply(ev(t, "PermissionRequest", m{"subagent": "ag1"})).State; got != "needs_you" {
		t.Fatalf("got %s", got)
	}
}

func TestAFinishedToolClearsAGrantedPermission(t *testing.T) {
	store, _ := clockedStore(nil)
	store.Apply(ev(t, "PreToolUse", m{"tool": "Bash"}))
	store.Apply(ev(t, "PermissionRequest", m{"tool": "Bash"}))
	if got := store.Apply(ev(t, "PostToolUse", m{"tool": "Bash"})).State; got != "thinking" {
		t.Fatalf("got %s", got)
	}
}

func TestASessionWhoseProcessIsGoneIsEnded(t *testing.T) {
	living := map[int]bool{101: true}
	store, c := clockedStore(func(pid int) bool { return living[pid] })
	store.Apply(ev(t, "UserPromptSubmit", m{"session": "a", "pid": 101}))
	store.Apply(ev(t, "UserPromptSubmit", m{"session": "b", "pid": 102}))
	store.Apply(ev(t, "UserPromptSubmit", m{"session": "c"}))
	states := func() map[string]string {
		out := map[string]string{}
		for _, a := range store.Snapshot() {
			out[a.Session] = a.State
		}
		return out
	}
	if got := states(); !reflect.DeepEqual(got, map[string]string{"a": "thinking", "b": "ended", "c": "thinking"}) {
		t.Fatalf("got %v", got)
	}
	delete(living, 101)
	c.now = c.now.Add(EndKeep + time.Second)
	if got := states(); !reflect.DeepEqual(got, map[string]string{"a": "ended", "c": "thinking"}) {
		t.Fatalf("got %v", got)
	}
	if ev(t, "Stop", m{"pid": "7"}).PID != 0 || ev(t, "Stop", m{"pid": 1}).PID != 0 || ev(t, "Stop", m{"pid": 1.5}).PID != 0 {
		t.Fatal("bad pids must become 0")
	}
}

func TestTheSessionNameSticksUntilANewOneArrives(t *testing.T) {
	store, _ := clockedStore(nil)
	store.Apply(ev(t, "UserPromptSubmit", m{"name": "work-eb"}))
	store.Apply(ev(t, "PreToolUse", m{"tool": "Read"}))
	if got := store.Snapshot()[0].Name; got != "work-eb" {
		t.Fatalf("got %q", got)
	}
	store.Apply(ev(t, "UserPromptSubmit", m{"name": "work-ec"}))
	if got := store.Snapshot()[0].Name; got != "work-ec" {
		t.Fatalf("got %q", got)
	}
}

func TestTheAreaRootKeepsHomeRelativeAndAbsolutePaths(t *testing.T) {
	for in, want := range map[string]string{
		"Project/myrepo":   "Project/myrepo",
		"/opt/../work/./x": "/opt/work/x",
		"../../etc":        "etc",
	} {
		if got := ev(t, "Stop", m{"root": in}).Root; got != want {
			t.Errorf("%q: got %q", in, got)
		}
	}
	if got := ev(t, "Stop", nil).Root; got != "" {
		t.Errorf("empty: got %q", got)
	}
}

func TestAMessageToAnotherSessionMarksAVisit(t *testing.T) {
	store, c := clockedStore(nil)
	store.Apply(ev(t, "PreToolUse", m{"tool": "SendMessage", "detail": "work-21"}))
	first := store.Snapshot()[0]
	if first.VisitTo != "work-21" || first.VisitAt != "2026-11-19T09:00:00.000Z" {
		t.Fatalf("got %q %q", first.VisitTo, first.VisitAt)
	}
	c.now = c.now.Add(time.Second)
	store.Apply(ev(t, "PostToolUse", m{"tool": "SendMessage"}))
	store.Apply(ev(t, "PreToolUse", m{"tool": "SendMessage"}))
	if got := store.Snapshot()[0].VisitAt; got != first.VisitAt {
		t.Fatalf("visit moved to %s", got)
	}
	store.Apply(ev(t, "PreToolUse", m{"tool": "SendMessage", "detail": "x", "subagent": "a1"}))
	if got := store.Snapshot()[0].VisitTo; got != "work-21" {
		t.Fatalf("subagent message moved the visit to %q", got)
	}
}

func TestAQuietSessionWhoseProcessRunsStaysPastTheIdleLimit(t *testing.T) {
	live := map[int]bool{4242: true}
	store, c := clockedStore(func(pid int) bool { return live[pid] })
	store.Apply(ev(t, "SessionStart", m{"session": "open", "pid": 4242}))
	store.Apply(ev(t, "SessionStart", m{"session": "nopid"}))
	c.now = c.now.Add(IdleLimit + time.Second)
	if got := sessions(store.Snapshot()); !reflect.DeepEqual(got, []string{"open"}) {
		t.Fatalf("got %v", got)
	}
	c.now = c.now.Add(LiveIdleLimit)
	if n := len(store.Snapshot()); n != 0 {
		t.Fatalf("got %d", n)
	}
}

func TestQuestionAndPlanDialogsCountAsWaitingForYou(t *testing.T) {
	store, _ := clockedStore(nil)
	for _, tool := range []string{"AskUserQuestion", "ExitPlanMode"} {
		if got := store.Apply(ev(t, "PreToolUse", m{"tool": tool})).State; got != "needs_you" {
			t.Errorf("%s: %s", tool, got)
		}
		if got := store.Apply(ev(t, "PostToolUse", m{"tool": tool})).State; got != "thinking" {
			t.Errorf("after %s: %s", tool, got)
		}
	}
}
