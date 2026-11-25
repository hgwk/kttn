package sessions

import (
	"encoding/json"
	"testing"
)

// delegating is a session that handed work to two subagents.
func delegating(t *testing.T) *Store {
	t.Helper()
	store, _ := clockedStore(nil)
	store.Apply(ev(t, "PreToolUse", m{"tool": "Agent", "detail": "Explore"}))
	store.Apply(ev(t, "SubagentStart", m{"detail": "Explore", "tool_use_id": "ag1"}))
	store.Apply(ev(t, "SubagentStart", m{"detail": "Plan", "tool_use_id": "ag2"}))
	return store
}

func TestASubagentsAnsweredRequestReleasesTheParent(t *testing.T) {
	store := delegating(t)
	before := store.Snapshot()[0].State
	if got := store.Apply(ev(t, "PermissionRequest", m{"tool": "Bash", "subagent": "ag1"})).State; got != "needs_you" {
		t.Fatalf("asked: %s", got)
	}
	// The notice after it carries no agent_id; it is still the subagent's.
	store.Apply(ev(t, "Notification", m{"detail": "permission_prompt"}))
	if got := store.Apply(ev(t, "PostToolUse", m{"tool": "Bash", "subagent": "ag1"})).State; got != before {
		t.Fatalf("answered: %s, want %s", got, before)
	}
}

func TestTheParentWaitsWhileAnySubagentStillWaits(t *testing.T) {
	store := delegating(t)
	store.Apply(ev(t, "PermissionRequest", m{"tool": "Bash", "subagent": "ag1"}))
	store.Apply(ev(t, "PermissionRequest", m{"tool": "Bash", "subagent": "ag2"}))
	if got := store.Apply(ev(t, "PostToolUse", m{"tool": "Bash", "subagent": "ag1"})).State; got != "needs_you" {
		t.Fatalf("one of two answered: %s", got)
	}
	// The other one stops instead of using a tool.
	if got := store.Apply(ev(t, "SubagentStop", m{"tool_use_id": "ag2"})).State; got == "needs_you" {
		t.Fatalf("both done: %s", got)
	}
}

func TestTheParentsOwnRequestOutlastsItsSubagents(t *testing.T) {
	store := delegating(t)
	store.Apply(ev(t, "PermissionRequest", m{"tool": "Bash", "subagent": "ag1"}))
	store.Apply(ev(t, "PermissionRequest", m{"tool": "Edit"}))
	store.Apply(ev(t, "PostToolUse", m{"tool": "Bash", "subagent": "ag1"}))
	if got := store.Apply(ev(t, "SubagentStop", m{"tool_use_id": "ag2"})).State; got != "needs_you" {
		t.Fatalf("own request released by subagents: %s", got)
	}
	// Its own answer still ends it as before.
	if got := store.Apply(ev(t, "PostToolUse", m{"tool": "Edit"})).State; got != "thinking" {
		t.Fatalf("own answer: %s", got)
	}
}

func TestAnUnrelatedEventKeepsASubagentsWaitReleasable(t *testing.T) {
	store := delegating(t)
	store.Apply(ev(t, "PermissionRequest", m{"tool": "Bash", "subagent": "ag1"}))
	store.Apply(ev(t, "PreCompact", nil))
	if got := store.Apply(ev(t, "PostToolUse", m{"tool": "Bash", "subagent": "ag1"})).State; got == "needs_you" {
		t.Fatalf("an unrelated parent event made the wait its own: %s", got)
	}
}

func TestAQuestionDuringAKittensWaitIsTheParentsOwn(t *testing.T) {
	store := delegating(t)
	store.Apply(ev(t, "PermissionRequest", m{"tool": "Bash", "subagent": "ag1"}))
	store.Apply(ev(t, "Notification", m{"detail": "elicitation_dialog"}))
	if got := store.Apply(ev(t, "PostToolUse", m{"tool": "Bash", "subagent": "ag1"})).State; got != "needs_you" {
		t.Fatalf("the parent's question was dropped: %s", got)
	}
}

func TestARestoredNeedsYouWithoutItsOriginIsTheSessionsOwn(t *testing.T) {
	store := delegating(t)
	store.Apply(ev(t, "PermissionRequest", m{"tool": "Edit"}))
	saved := store.Snapshot()
	saved[0].SelfWaiting, saved[0].WaitedFrom = false, "" // as 0.15.0 wrote it
	raw, _ := json.Marshal(saved)
	again, _ := clockedStore(nil)
	again.Restore(raw)
	if got := again.Apply(ev(t, "PostToolUse", m{"tool": "Bash", "subagent": "ag1"})).State; got != "needs_you" {
		t.Fatalf("an old file's open prompt was cleared: %s", got)
	}
}
