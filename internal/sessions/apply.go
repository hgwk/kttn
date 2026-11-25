package sessions

// needsYouNotices are notifications that stop until a person answers. The
// rest (idle_prompt after an answer, auth_success) leave the state alone. An
// empty type comes from an older hook and counts as waiting.
var needsYouNotices = map[string]bool{
	"": true, "permission_prompt": true, "worker_permission_prompt": true,
	"elicitation_dialog": true, "elicitation_url_dialog": true,
	"agent_needs_input": true,
}

// Apply records one event and returns a copy of the session after it.
func (s *Store) Apply(event Event) Agent {
	s.mu.Lock()
	defer s.mu.Unlock()
	now := stamp(s.now())
	key := event.Source + "|" + event.Session
	agent, ok := s.agents[key]
	if !ok {
		agent = &Agent{
			Key: key, Source: event.Source, Session: event.Session,
			State: "idle", Headless: event.Headless,
			Minions: []Minion{}, Tasks: []Task{},
			StatusSince: now,
		}
		s.agents[key] = agent
	}
	agent.Project = event.Project
	agent.Folder = event.Folder
	agent.Root = event.Root
	agent.Headless = agent.Headless || event.Headless
	if event.PID != 0 {
		agent.PID = event.PID
	}
	if event.Name != "" {
		agent.Name = event.Name
	}
	agent.UpdatedAt = now

	// A subagent's tools are the subagent's work. The parent may have
	// finished or be waiting, so its state does not move. A permission
	// request from a subagent still needs a person and goes through.
	if event.Subagent != "" {
		switch event.Event {
		case "PreToolUse", "PostToolUse", "PostToolUseFailure":
			setWaiting(agent, event.Subagent, false)
			return agent.clone()
		case "Elicitation", "PermissionRequest":
			setWaiting(agent, event.Subagent, true)
		case "Notification":
			if needsYouNotices[event.Detail] {
				setWaiting(agent, event.Subagent, true)
			}
		}
	}

	next := transition(agent, event, now)
	if event.Model != "" {
		agent.Model = event.Model
	}
	if moment := momentFor(event, now); moment != nil {
		agent.Moment = moment
	}
	agent.Tasks = nextTasks(agent.Tasks, event)
	if next != agent.State {
		agent.State = next
		agent.StatusSince = now
	}
	return agent.clone()
}

// transition applies the event's side effects and returns the next state.
func transition(agent *Agent, event Event, now string) string {
	next := agent.State
	switch event.Event {
	case "SessionStart":
		// After compaction the session carries on with what it was doing.
		if event.Detail != "compact" {
			next = "idle"
		}
		agent.StartedAs = event.Detail
		agent.Trouble = ""
		agent.Compacting = false
	case "UserPromptSubmit":
		next = "thinking"
		agent.Trouble, agent.Tool, agent.Detail = "", "", ""
	case "PreToolUse":
		next = ToolState(event.Tool)
		agent.Tool, agent.Detail = event.Tool, event.Detail
		agent.ToolCount++
		// A message to another session names that session as the detail.
		if event.Tool == "SendMessage" && event.Detail != "" {
			agent.VisitTo, agent.VisitAt = event.Detail, now
		}
	case "PostToolUse", "PostToolUseFailure", "ElicitationResult":
		next = "thinking"
	case "Elicitation", "PermissionRequest":
		next = "needs_you"
	case "Notification":
		if needsYouNotices[event.Detail] {
			next = "needs_you"
		}
	case "PreCompact":
		agent.Compacting = true
	case "PostCompact":
		agent.Compacting = false
	case "PostModelSwitch":
		if event.Detail != "" {
			agent.Model = event.Detail
		}
	case "StopFailure":
		// The turn ended on a rate limit or server error; show it until the
		// next prompt.
		next = "done"
		agent.Trouble = event.Detail
		if agent.Trouble == "" {
			agent.Trouble = "unknown"
		}
		agent.Compacting = false
	case "SubagentStart":
		// Counted by start and stop hooks: a background subagent's
		// PostToolUse arrives at once and says nothing about its end.
		if event.ToolUseID != "" && len(agent.Minions) < MaxMinions && !hasMinion(agent, event.ToolUseID) {
			agent.Minions = append(agent.Minions, Minion{ID: event.ToolUseID, Label: event.Detail})
		}
	case "SubagentStop":
		for i, minion := range agent.Minions {
			if minion.ID == event.ToolUseID {
				agent.Minions = append(agent.Minions[:i:i], agent.Minions[i+1:]...)
				break
			}
		}
	case "Stop":
		next = "done"
		agent.Trouble, agent.Tool, agent.Detail = "", "", ""
		agent.Compacting = false
		if event.Result != "" {
			agent.Result, agent.ResultAt = event.Result, now
		}
	case "SessionEnd":
		next = "ended"
		agent.Minions = []Minion{}
		agent.Compacting = false
	}
	return next
}

// setWaiting marks the subagent id, if it stands beside the desk, as waiting
// on a person or not.
func setWaiting(agent *Agent, id string, waiting bool) {
	// A minion started without an ID must not match an event without one.
	if id == "" {
		return
	}
	for i := range agent.Minions {
		if agent.Minions[i].ID == id {
			agent.Minions[i].Waiting = waiting
		}
	}
}

func hasMinion(agent *Agent, id string) bool {
	for _, minion := range agent.Minions {
		if minion.ID == id {
			return true
		}
	}
	return false
}
