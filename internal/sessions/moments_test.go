package sessions

import (
	"reflect"
	"strconv"
	"testing"
	"time"
)

func TestShortHappeningsLeaveAMomentAndChangeStateOnlyWhereItMatters(t *testing.T) {
	store, c := clockedStore(nil)
	store.Apply(ev(t, "UserPromptSubmit", nil))
	store.Apply(ev(t, "PreToolUse", m{"tool": "Bash", "detail": "go"}))
	failed := store.Apply(ev(t, "PostToolUseFailure", m{"tool": "Bash", "detail": "go"}))
	if failed.State != "thinking" || !reflect.DeepEqual(failed.Moment, &Moment{"PostToolUseFailure", "go", "2026-11-19T09:00:00.000Z"}) {
		t.Fatalf("got %s %+v", failed.State, failed.Moment)
	}
	if !store.Apply(ev(t, "PreCompact", m{"detail": "auto"})).Compacting {
		t.Fatal("PreCompact")
	}
	if store.Apply(ev(t, "PostCompact", m{"detail": "auto"})).Compacting {
		t.Fatal("PostCompact")
	}
	if got := store.Apply(ev(t, "Elicitation", m{"detail": "github"})).State; got != "needs_you" {
		t.Fatalf("Elicitation %s", got)
	}
	if got := store.Apply(ev(t, "ElicitationResult", m{"detail": "accept"})).State; got != "thinking" {
		t.Fatalf("ElicitationResult %s", got)
	}
	if got := store.Apply(ev(t, "PostModelSwitch", m{"detail": "opus"})).Model; got != "opus" {
		t.Fatalf("model %s", got)
	}
	c.now = c.now.Add(time.Second)
	broke := store.Apply(ev(t, "StopFailure", m{"detail": "rate_limit"}))
	if broke.State != "done" || broke.Trouble != "rate_limit" {
		t.Fatalf("got %s %s", broke.State, broke.Trouble)
	}
	if got := store.Apply(ev(t, "UserPromptSubmit", nil)).Trouble; got != "" {
		t.Fatalf("trouble kept %q", got)
	}
	// An event without a moment keeps the last one.
	if store.Snapshot()[0].Moment.Kind != "StopFailure" {
		t.Fatal("moment cleared")
	}
	// A failure inside a subagent leaves the parent alone.
	store.Apply(ev(t, "Stop", nil))
	sub := store.Apply(ev(t, "PostToolUseFailure", m{"tool": "Read", "subagent": "a1"}))
	if sub.State != "done" || sub.Moment.Kind != "StopFailure" {
		t.Fatalf("got %s %s", sub.State, sub.Moment.Kind)
	}
}

func TestTasksFillAChecklistThatKeepsItsNewestEntries(t *testing.T) {
	store, _ := clockedStore(nil)
	store.Apply(ev(t, "TaskCreated", m{"tool_use_id": "t1", "detail": "로그인"}))
	store.Apply(ev(t, "TaskCompleted", m{"tool_use_id": "t1", "detail": "로그인"}))
	store.Apply(ev(t, "TaskCompleted", m{"tool_use_id": "t2", "detail": "가입"}))
	store.Apply(ev(t, "TaskCreated", m{"detail": "ID 없음"}))
	want := []Task{{"t1", "로그인", true}, {"t2", "가입", true}}
	if got := store.Snapshot()[0].Tasks; !reflect.DeepEqual(got, want) {
		t.Fatalf("got %+v", got)
	}
	for i := 0; i < 20; i++ {
		store.Apply(ev(t, "TaskCreated", m{"tool_use_id": "n" + strconv.Itoa(i), "detail": strconv.Itoa(i)}))
	}
	tasks := store.Snapshot()[0].Tasks
	if len(tasks) != MaxTasks || tasks[len(tasks)-1].ID != "n19" {
		t.Fatalf("got %+v", tasks)
	}
	for _, task := range tasks {
		if task.Done {
			t.Fatal("finished tasks should leave first")
		}
	}
}

func TestSavedMomentsTasksAndTroubleComeBackAfterARestart(t *testing.T) {
	store, c := clockedStore(nil)
	store.Apply(ev(t, "TaskCreated", m{"tool_use_id": "t1", "detail": "a"}))
	store.Apply(ev(t, "StopFailure", m{"detail": "server_error"}))
	good := saved(t, store)
	next := NewStore(c.read, func(int) bool { return false })
	next.Restore(good)
	if !reflect.DeepEqual(saved(t, next), good) {
		t.Fatalf("got %s", saved(t, next))
	}
	legacy := NewStore(c.read, func(int) bool { return false })
	legacy.Restore([]byte(`[{"key":"claude|s1","session":"s1","updated_at":"2026-11-19T09:00:00.000Z"}]`))
	back := legacy.Snapshot()[0]
	if back.Moment != nil || len(back.Tasks) != 0 || back.Trouble != "" {
		t.Fatalf("got %+v", back)
	}
}

func TestASessionRestartedAfterCompactionKeepsWorking(t *testing.T) {
	store, _ := clockedStore(nil)
	store.Apply(ev(t, "PreToolUse", m{"tool": "Read"}))
	store.Apply(ev(t, "PreCompact", m{"detail": "auto"}))
	after := store.Apply(ev(t, "SessionStart", m{"detail": "compact"}))
	if after.State != "reading" || after.Compacting {
		t.Fatalf("got %s %v", after.State, after.Compacting)
	}
	resumed := store.Apply(ev(t, "SessionStart", m{"detail": "resume"}))
	if resumed.State != "idle" || resumed.StartedAs != "resume" {
		t.Fatalf("got %s %s", resumed.State, resumed.StartedAs)
	}
	store.Apply(ev(t, "InstructionsLoaded", m{"detail": "CLAUDE.md"}))
	if got := store.Snapshot()[0]; got.StartedAs != "resume" || got.Moment.Kind != "InstructionsLoaded" {
		t.Fatalf("got %s %s", got.StartedAs, got.Moment.Kind)
	}
}

func TestTheModelStaysUntilASwitchOrAStartOrStopThatNamesAnother(t *testing.T) {
	store, _ := clockedStore(nil)
	model := func() string { return store.Snapshot()[0].Model }
	store.Apply(ev(t, "SessionStart", m{"detail": "startup"}))
	if model() != "" {
		t.Fatal("no model yet")
	}
	store.Apply(ev(t, "SessionStart", m{"detail": "startup", "model": "claude-opus-5-5"}))
	store.Apply(ev(t, "SessionStart", m{"detail": "resume"}))
	if model() != "claude-opus-5-5" {
		t.Fatalf("got %s", model())
	}
	store.Apply(ev(t, "PostModelSwitch", m{"detail": "claude-sonnet-5-5"}))
	if model() != "claude-sonnet-5-5" {
		t.Fatalf("got %s", model())
	}
	store.Apply(ev(t, "Stop", m{"model": "claude-haiku-5-5"}))
	store.Apply(ev(t, "Stop", nil))
	if model() != "claude-haiku-5-5" {
		t.Fatalf("got %s", model())
	}
}
