package office

import (
	"errors"
	"sort"
	"sync"
	"time"
)

const (
	// MaxAutomations is how many runs the machine room shows.
	MaxAutomations = 8
	// RecentAutomation keeps a finished run on screen this long.
	RecentAutomation = 30 * time.Minute
)

// Automation is one run reported to POST /api/automation, in the shape the
// screen reads.
type Automation struct {
	Key       string  `json:"key"`
	Label     string  `json:"label"`
	State     string  `json:"state"`
	HeldCount int     `json:"heldCount"`
	StartedAt string  `json:"startedAt"`
	EndedAt   *string `json:"endedAt"`
	updated   time.Time
}

var automationStates = map[string]bool{"running": true, "ok": true, "failed": true, "held": true}

// ParseAutomation checks a decoded automation report. A run sends the same
// key at its start and its end; the end carries ended_at.
func ParseAutomation(raw any, now time.Time) (Automation, error) {
	body, ok := raw.(map[string]any)
	if !ok {
		return Automation{}, errors.New("invalid JSON body")
	}
	run := Automation{
		Key:       field(body["key"], MaxField),
		Label:     field(body["label"], MaxField),
		State:     field(body["state"], MaxField),
		StartedAt: field(body["started_at"], MaxField),
		updated:   now,
	}
	if held, ok := body["held_count"].(float64); ok && held > 0 && held == float64(int(held)) {
		run.HeldCount = int(held)
	}
	if ended := field(body["ended_at"], MaxField); ended != "" {
		run.EndedAt = &ended
	}
	switch {
	case run.Key == "":
		return Automation{}, errors.New("key is required")
	case !automationStates[run.State]:
		return Automation{}, errors.New("state must be running, ok, failed or held")
	}
	if run.Label == "" {
		run.Label = run.Key
	}
	if run.StartedAt == "" {
		run.StartedAt = stamp(now)
	}
	if run.State != "held" {
		run.HeldCount = 0
	}
	return run, nil
}

// Automations keeps the latest report of each run.
type Automations struct {
	mu   sync.Mutex
	runs map[string]Automation
	now  func() time.Time
}

func NewAutomations(now func() time.Time) *Automations {
	return &Automations{runs: map[string]Automation{}, now: now}
}

// Record stores a run report, replacing the earlier report of the same run.
func (a *Automations) Record(run Automation) {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.runs[run.Key] = run
}

// Snapshot drops finished runs older than RecentAutomation and returns the
// rest, running first, newest first, at most MaxAutomations.
func (a *Automations) Snapshot() []Automation {
	a.mu.Lock()
	defer a.mu.Unlock()
	now := a.now()
	out := []Automation{}
	for key, run := range a.runs {
		// A finished run stays for RecentAutomation; a run that never reports
		// its end goes after IdleLimit.
		age := now.Sub(run.updated)
		if (run.State != "running" && age > RecentAutomation) || age > IdleLimit {
			delete(a.runs, key)
			continue
		}
		out = append(out, run)
	}
	sort.Slice(out, func(i, j int) bool {
		ri, rj := out[i].State == "running", out[j].State == "running"
		if ri != rj {
			return ri
		}
		return out[i].StartedAt > out[j].StartedAt
	})
	if len(out) > MaxAutomations {
		out = out[:MaxAutomations]
	}
	return out
}
