package sessions

// Who a needs_you is for. A subagent's permission request makes its parent
// show needs_you too, but once that subagent moves on (its next tool or its
// stop) nobody is waiting, and the parent should not keep blinking until its
// own next tool, which may be minutes away behind a long Task.

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

func anyWaiting(agent *Agent) bool {
	for _, minion := range agent.Minions {
		if minion.Waiting {
			return true
		}
	}
	return false
}

// noteWait records whose wait a needs_you is, and on a SubagentStop lets go
// of a wait that only that subagent held. It returns the state to take.
func noteWait(agent *Agent, event Event, next string) string {
	if next != "needs_you" {
		agent.SelfWaiting, agent.WaitedFrom = false, ""
		return next
	}
	if agent.State != "needs_you" {
		agent.WaitedFrom = agent.State
	}
	if event.Subagent == "" && asksAPerson(agent, event) {
		agent.SelfWaiting = true
	}
	if event.Event == "SubagentStop" && !agent.SelfWaiting && !anyWaiting(agent) {
		return resumed(agent)
	}
	return next
}

// permissionNotices follow a permission request. The one after a subagent's
// request carries no agent_id.
var permissionNotices = map[string]bool{"permission_prompt": true, "worker_permission_prompt": true}

// asksAPerson tells whether the session's own event is a wait on a person.
// While a subagent waits, a bare permission notice is taken as its; other
// needs-you notices (a question for the person) stay the session's own.
func asksAPerson(agent *Agent, event Event) bool {
	switch event.Event {
	case "PermissionRequest", "Elicitation":
		return true
	case "Notification":
		if !needsYouNotices[event.Detail] {
			return false
		}
		return !(permissionNotices[event.Detail] && anyWaiting(agent))
	}
	return false
}

// releaseWait ends a needs_you that only waiting subagents held, once none
// of them waits any more.
func releaseWait(agent *Agent, now string) {
	if agent.State != "needs_you" || agent.SelfWaiting || anyWaiting(agent) {
		return
	}
	agent.State = resumed(agent)
	agent.StatusSince = now
}

func resumed(agent *Agent) string {
	from := agent.WaitedFrom
	agent.WaitedFrom = ""
	if from == "" || from == "needs_you" {
		from = "thinking"
	}
	return from
}
