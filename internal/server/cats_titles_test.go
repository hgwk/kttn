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
	clock.at = time.Date(2026, 11, 26, 2, 30, 0, 0, time.UTC)
	hookEvent(h, "rest", "SessionStart", "")
	hookEvent(h, "work", "UserPromptSubmit", "")
	clock.at = time.Date(2026, 11, 26, 5, 0, 0, 0, time.UTC)
	hookEvent(h, "dawn", "UserPromptSubmit", "")
	clock.at = time.Date(2026, 11, 26, 10, 0, 0, 0, time.UTC)
	hookEvent(h, "work", "Stop", "")
	owls := map[string]bool{}
	for _, c := range catList(t, h) {
		owls[c.Key] = c.NightOwl
	}
	if owls["claude|rest"] || !owls["claude|work"] || owls["claude|dawn"] {
		t.Fatalf("owls %v", owls)
	}
}

// peak is the most sessions at the office at once; it stays when they go
// home and goes with a clear.
func TestThePeakIsTheBusiestTheOfficeHasBeen(t *testing.T) {
	h, _, clock := catServer(t)
	hookEvent(h, "a", "UserPromptSubmit", "")
	clock.at = clock.at.Add(time.Minute)
	hookEvent(h, "b", "UserPromptSubmit", "")
	hookEvent(h, "p", "SessionStart", `,"headless":true`)
	clock.at = clock.at.Add(time.Minute)
	hookEvent(h, "a", "SessionEnd", "")
	var got catalog
	if err := json.Unmarshal(catCall(h, "GET", "/api/cats", "k", "").Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if got.Peak == nil || got.Peak.Count != 2 || got.Peak.At != "2026-11-25T09:01:00.000Z" {
		t.Fatalf("peak %+v", got.Peak)
	}
	clock.at = clock.at.Add(catKeep + time.Hour)
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
