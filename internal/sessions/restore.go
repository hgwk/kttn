package sessions

import (
	"encoding/json"
	"time"
)

// Restore loads sessions saved before a restart. Rows that do not decode,
// lack a key or carry a bad time are dropped; old rows are cleared by the
// next Snapshot. Sessions already in the store win.
func (s *Store) Restore(data []byte) {
	var rows []json.RawMessage
	if json.Unmarshal(data, &rows) != nil {
		return
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, row := range rows {
		var agent Agent
		if json.Unmarshal(row, &agent) != nil || agent.Key == "" {
			continue
		}
		if _, err := time.Parse(time.RFC3339Nano, agent.UpdatedAt); err != nil {
			continue
		}
		if _, taken := s.agents[agent.Key]; taken {
			continue
		}
		if len(agent.Minions) > MaxMinions {
			agent.Minions = agent.Minions[:MaxMinions]
		}
		if len(agent.Tasks) > MaxTasks {
			agent.Tasks = agent.Tasks[len(agent.Tasks)-MaxTasks:]
		}
		if agent.Minions == nil {
			agent.Minions = []Minion{}
		}
		if agent.Tasks == nil {
			agent.Tasks = []Task{}
		}
		if agent.PID <= 1 {
			agent.PID = 0
		}
		s.agents[agent.Key] = &agent
	}
}
