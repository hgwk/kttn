package server

import (
	"encoding/json"
	"strings"
	"testing"
	"time"
)

// night_owl marks a cat seen at work between midnight and 05:00 on the
// server's clock; resting there does not count, and the mark stays.
func TestACatAtWorkAfterMidnightIsANightOwlForGood(t *testing.T) {
	h, _, clock := catServer(t)
	clock.set(time.Date(2026, 11, 26, 2, 30, 0, 0, time.UTC))
	hookEvent(h, "rest", "SessionStart", "")
	hookEvent(h, "work", "UserPromptSubmit", "")
	clock.set(time.Date(2026, 11, 26, 5, 0, 0, 0, time.UTC))
	hookEvent(h, "dawn", "UserPromptSubmit", "")
	clock.set(time.Date(2026, 11, 26, 10, 0, 0, 0, time.UTC))
	hookEvent(h, "work", "Stop", "")
	owls := map[string]bool{}
	for _, c := range catList(t, h) {
		owls[c.Key] = c.NightOwl
	}
	if owls["claude|rest"] || !owls["claude|work"] || owls["claude|dawn"] {
		t.Fatalf("owls %v", owls)
	}
}

// peak is the most sessions at kttn at once; it stays when they go
// home and goes with a clear.
func TestThePeakIsTheBusiestKttnHasBeen(t *testing.T) {
	h, _, clock := catServer(t)
	hookEvent(h, "a", "UserPromptSubmit", "")
	clock.add(time.Minute)
	hookEvent(h, "b", "UserPromptSubmit", "")
	hookEvent(h, "p", "SessionStart", `,"headless":true`)
	clock.add(time.Minute)
	hookEvent(h, "a", "SessionEnd", "")
	var got catalog
	if err := json.Unmarshal(catCall(h, "GET", "/api/cats", "k", "").Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if got.Peak == nil || got.Peak.Count != 2 || got.Peak.At != "2026-11-25T09:01:00.000Z" {
		t.Fatalf("peak %+v", got.Peak)
	}
	clock.add(catKeep + time.Hour)
	if body := catCall(h, "GET", "/api/cats", "k", "").Body.String(); strings.Contains(body, `"peak"`) {
		t.Fatalf("a peak older than 90 days is still served: %s", body)
	}
	hookEvent(h, "b", "Stop", "")
	var later catalog
	if err := json.Unmarshal(catCall(h, "GET", "/api/cats", "k", "").Body.Bytes(), &later); err != nil || later.Peak == nil || later.Peak.Count != 1 {
		t.Fatalf("a peak older than 90 days must give way: %+v", later.Peak)
	}
	catCall(h, "DELETE", "/api/cats", "k", "")
	if body := catCall(h, "GET", "/api/cats", "k", "").Body.String(); body != "{\"cats\":[]}\n" {
		t.Fatalf("after clear %q", body)
	}
}

// day counts the tools a cat started and the tools that failed on this
// computer's date, outside subagents, and starts over on a new day.
func TestADayCountsTodaysToolsAndFailuresAndStartsOverTomorrow(t *testing.T) {
	h, _, clock := catServer(t)
	clock.set(time.Date(2026, 11, 26, 23, 0, 0, 0, time.UTC))
	hookEvent(h, "a", "SessionStart", "")
	for _, tool := range []string{"Read", "Edit", "Bash"} {
		hookEvent(h, "a", "PreToolUse", `,"tool":"`+tool+`"`)
	}
	hookEvent(h, "a", "PostToolUseFailure", `,"tool":"Bash"`)
	hookEvent(h, "a", "PreToolUse", `,"tool":"Read","subagent":"ag1"`)
	hookEvent(h, "a", "PostToolUseFailure", `,"tool":"Read","subagent":"ag1"`)
	day := catList(t, h)[0].Day
	if day == nil || *day != (catDay{Date: "2026-11-26", Tools: 3, Failures: 1}) {
		t.Fatalf("day %+v", day)
	}
	clock.set(time.Date(2026, 11, 27, 0, 30, 0, 0, time.UTC))
	hookEvent(h, "a", "PreToolUse", `,"tool":"Grep"`)
	if day := catList(t, h)[0].Day; day == nil || *day != (catDay{Date: "2026-11-27", Tools: 1}) {
		t.Fatalf("next day %+v", day)
	}
	hookEvent(h, "b", "SessionStart", "")
	for _, c := range catList(t, h) {
		if c.Key == "claude|b" && c.Day != nil {
			t.Fatalf("a cat that has not worked has a day: %+v", c.Day)
		}
	}
}
