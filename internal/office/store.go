package office

import (
	"sort"
	"sync"
	"time"
)

const (
	MaxMinions = 8
	// EndKeep is how long an ended session stays at its desk.
	EndKeep = 10 * time.Minute
	// IdleLimit drops a session that has been silent this long.
	IdleLimit = 6 * time.Hour
	// LiveIdleLimit applies while the session's process still runs. A pid can
	// be reused by another program, so there is still a limit.
	LiveIdleLimit = 3 * 24 * time.Hour
)

// Minion is a subagent standing beside its session's desk.
type Minion struct {
	ID    string `json:"id"`
	Label string `json:"label"`
}

// Agent is one session as the screen sees it.
type Agent struct {
	Key        string   `json:"key"`
	Source     string   `json:"source"`
	Session    string   `json:"session"`
	Project    string   `json:"project"`
	Folder     string   `json:"folder"`
	Root       string   `json:"root"`
	State      string   `json:"state"`
	Tool       string   `json:"tool"`
	Detail     string   `json:"detail"`
	Minions    []Minion `json:"minions"`
	ToolCount  int      `json:"tool_count"`
	Result     string   `json:"result"`
	ResultAt   string   `json:"result_at"`
	Headless   bool     `json:"headless"`
	PID        int      `json:"pid"`
	Name       string   `json:"name"`
	VisitTo    string   `json:"visit_to"`
	VisitAt    string   `json:"visit_at"`
	Moment     *Moment  `json:"moment"`
	Tasks      []Task   `json:"tasks"`
	Trouble    string   `json:"trouble"`
	Compacting bool     `json:"compacting"`
	Model      string   `json:"model"`
	// StartedAs is the last SessionStart source. InstructionsLoaded right
	// after it overwrites the moment, so it is kept apart.
	StartedAs   string `json:"started_as"`
	StatusSince string `json:"status_since"`
	UpdatedAt   string `json:"updated_at"`
}

func (a *Agent) clone() Agent {
	c := *a
	c.Minions = append([]Minion{}, a.Minions...)
	c.Tasks = append([]Task{}, a.Tasks...)
	if a.Moment != nil {
		m := *a.Moment
		c.Moment = &m
	}
	return c
}

// Store holds every session. It is safe for concurrent use.
type Store struct {
	mu     sync.Mutex
	agents map[string]*Agent
	now    func() time.Time
	alive  func(int) bool
}

// NewStore builds a store with a clock and a process check, both swappable
// in tests.
func NewStore(now func() time.Time, alive func(int) bool) *Store {
	return &Store{agents: map[string]*Agent{}, now: now, alive: alive}
}

func stamp(t time.Time) string {
	return t.UTC().Format("2006-01-02T15:04:05.000Z")
}

// Snapshot drops sessions past their limits and returns copies in key order.
func (s *Store) Snapshot() []Agent {
	s.mu.Lock()
	defer s.mu.Unlock()
	now := s.now()
	// A terminal closed without SessionEnd shows up as a vanished process.
	for _, agent := range s.agents {
		if agent.PID != 0 && agent.State != "ended" && !s.alive(agent.PID) {
			agent.State = "ended"
			agent.Minions = nil
			agent.StatusSince = stamp(now)
			agent.UpdatedAt = agent.StatusSince
		}
	}
	for key, agent := range s.agents {
		updated, _ := time.Parse(time.RFC3339Nano, agent.UpdatedAt)
		age := now.Sub(updated)
		limit := IdleLimit
		if agent.PID != 0 && agent.State != "ended" && s.alive(agent.PID) {
			limit = LiveIdleLimit
		}
		ended := agent.State == "ended" && (agent.Headless || age > EndKeep)
		if ended || age > limit {
			delete(s.agents, key)
		}
	}
	return s.sorted()
}

func (s *Store) sorted() []Agent {
	keys := make([]string, 0, len(s.agents))
	for key := range s.agents {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	out := make([]Agent, 0, len(keys))
	for _, key := range keys {
		out = append(out, s.agents[key].clone())
	}
	return out
}
