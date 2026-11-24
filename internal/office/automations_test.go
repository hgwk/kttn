package office

import (
	"testing"
	"time"
)

func report(t *testing.T, c *clock, body map[string]any) Automation {
	t.Helper()
	run, err := ParseAutomation(body, c.read())
	if err != nil {
		t.Fatal(err)
	}
	return run
}

func TestAutomationRunsStayWhileRunningAndBrieflyAfterTheyEnd(t *testing.T) {
	c := newClock()
	runs := NewAutomations(c.read)
	runs.Record(report(t, c, m{"key": "a", "state": "running", "started_at": "2026-11-19T08:00:00Z"}))
	runs.Record(report(t, c, m{"key": "b", "state": "ok", "started_at": "2026-11-19T08:30:00Z", "ended_at": "2026-11-19T08:59:00Z"}))
	runs.Record(report(t, c, m{"key": "c", "state": "held", "held_count": 3.0, "started_at": "2026-11-19T08:40:00Z"}))
	got := runs.Snapshot()
	if len(got) != 3 || got[0].Key != "a" || got[1].Key != "c" || got[2].Key != "b" {
		t.Fatalf("order %+v", got)
	}
	if got[1].HeldCount != 3 || got[0].Label != "a" || got[2].EndedAt == nil {
		t.Fatalf("fields %+v", got)
	}
	c.now = c.now.Add(RecentAutomation + time.Second)
	if got := runs.Snapshot(); len(got) != 1 || got[0].Key != "a" {
		t.Fatalf("after window %+v", got)
	}
	c.now = c.now.Add(IdleLimit)
	if got := runs.Snapshot(); len(got) != 0 {
		t.Fatalf("a run that never ended should go, got %+v", got)
	}
}

func TestAutomationReportsAreChecked(t *testing.T) {
	c := newClock()
	for name, body := range map[string]any{
		"not an object": "x",
		"no key":        m{"state": "ok"},
		"bad state":     m{"key": "a", "state": "exploded"},
	} {
		if _, err := ParseAutomation(body, c.read()); err == nil {
			t.Errorf("%s should fail", name)
		}
	}
	run := report(t, c, m{"key": "a", "state": "ok", "held_count": 5.0})
	if run.HeldCount != 0 || run.StartedAt != "2026-11-19T09:00:00.000Z" {
		t.Fatalf("got %+v", run)
	}
	runs := NewAutomations(c.read)
	for i := 0; i < 12; i++ {
		runs.Record(report(t, c, m{"key": string(rune('a' + i)), "state": "running"}))
	}
	if n := len(runs.Snapshot()); n != MaxAutomations {
		t.Fatalf("cap %d", n)
	}
}
