package server

import "github.com/hgwk/kttn/internal/office"

// The catalog's tallies: each cat's day and the office's busiest moment.

// catDay is one day's work: tools started and tools that failed, outside
// subagents, as the session's tool count counts them.
type catDay struct {
	Date     string `json:"date"`
	Tools    int    `json:"tools"`
	Failures int    `json:"failures"`
}

// peak is the most cats at work at once, and when that was first reached.
type peak struct {
	Count int    `json:"count"`
	At    string `json:"at"`
}

// countDay adds an event to the cat's day, starting a new day when the
// date has moved on. newTools is 1 for a tool the session started.
func (b *catBook) countDay(c *cat, date string, newTools int, event office.Event) {
	// An interrupt is the person pressing Esc, not a tool failing.
	failed := event.Event == "PostToolUseFailure" && event.Subagent == "" && event.Detail != "interrupt"
	if newTools <= 0 && !failed {
		return
	}
	if c.Day == nil || c.Day.Date != date {
		c.Day = &catDay{Date: date}
	}
	c.Day.Tools += max(newTools, 0)
	if failed {
		c.Day.Failures++
	}
}

// expirePeakLocked drops a peak older than catKeep, so a newer, lower one
// can take its place.
func (b *catBook) expirePeakLocked() {
	if b.peak != nil && b.peak.At < b.now().Add(-catKeep).UTC().Format(timeForm) {
		b.peak = nil
	}
}
