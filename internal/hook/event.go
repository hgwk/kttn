// Package hook turns one Claude Code hook payload into the reduced event the
// kttn server receives. It forwards tool names and short labels, never
// prompts, file bodies, command arguments or error texts.
package hook

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
)

// Event is the reduced hook signal the server receives. The one piece of
// content it may carry is Result, the folded opening of the answer a session
// just gave on Stop, and only when the user opted into previews.
type Event struct {
	Source    string `json:"source"`
	Session   string `json:"session"`
	Project   string `json:"project"`
	Folder    string `json:"folder"`
	Root      string `json:"root"`
	Event     string `json:"event"`
	Tool      string `json:"tool"`
	Detail    string `json:"detail"`
	ToolUseID string `json:"tool_use_id"`
	Result    string `json:"result,omitempty"`
	// Headless marks `claude -p` and SDK runs, which come and go in seconds.
	Headless bool `json:"headless,omitempty"`
	// Subagent is set when a tool or notice comes from inside a subagent, so
	// the server does not move the parent session for it.
	Subagent string `json:"subagent,omitempty"`
	// PID is the Claude Code process, so the server can let go of a session
	// whose terminal closed without SessionEnd. Sent only on the events that
	// come once a turn or less (see carriesPID), to keep tool hooks free of
	// the ps lookup.
	PID int `json:"pid,omitempty"`
	// Name is the session's peer name, the label people use for it.
	Name string `json:"name,omitempty"`
	// Model comes on SessionStart (when Claude Code sends it) and on Stop
	// (read off the transcript's last real answer).
	Model string `json:"model,omitempty"`
}

// hookInput is the subset of the Claude Code hook payload the office needs.
type hookInput struct {
	SessionID            string         `json:"session_id"`
	Cwd                  string         `json:"cwd"`
	HookEventName        string         `json:"hook_event_name"`
	ToolName             string         `json:"tool_name"`
	ToolUseID            string         `json:"tool_use_id"`
	ToolInput            map[string]any `json:"tool_input"`
	LastAssistantMessage string         `json:"last_assistant_message"` // Stop
	NotificationType     string         `json:"notification_type"`      // Notification
	AgentID              string         `json:"agent_id"`               // Subagent*, tools inside one
	AgentType            string         `json:"agent_type"`             // Subagent*
	TranscriptPath       string         `json:"transcript_path"`
	// The rest each belong to one or two events and only give the office a
	// short label. Error texts, summaries and file contents stay behind.
	Source        string `json:"source"`          // SessionStart, ConfigChange
	Reason        string `json:"reason"`          // SessionEnd
	Trigger       string `json:"trigger"`         // PreCompact, PostCompact, Setup
	Error         string `json:"error"`           // StopFailure: rate_limit and the like
	IsInterrupt   bool   `json:"is_interrupt"`    // PostToolUseFailure
	TaskID        string `json:"task_id"`         // TaskCreated, TaskCompleted
	TaskSubject   string `json:"task_subject"`    // TaskCreated, TaskCompleted
	TeammateName  string `json:"teammate_name"`   // TeammateIdle
	WorktreePath  string `json:"worktree_path"`   // WorktreeRemove
	MCPServerName string `json:"mcp_server_name"` // Elicitation
	Action        string `json:"action"`          // ElicitationResult
	FilePath      string `json:"file_path"`       // InstructionsLoaded
	ToModel       string `json:"to_model"`        // PostModelSwitch
	Model         string `json:"model"`           // SessionStart, when present
}

// eventFromHook reduces a raw payload. preview decides whether Stop carries
// the opening of the answer; it is off unless the user opted in.
func eventFromHook(raw []byte, source string, preview bool) (Event, bool) {
	var input hookInput
	if err := json.Unmarshal(raw, &input); err != nil || input.SessionID == "" {
		return Event{}, false
	}
	project, folder, root := projectName(input.Cwd)
	pid := sessionPID(input.HookEventName)
	var tail []string
	if input.HookEventName == "Stop" {
		tail = transcriptLines(input.TranscriptPath)
	}
	event := Event{
		Source:    source,
		Session:   input.SessionID,
		Project:   project,
		Folder:    folder,
		Root:      root,
		Event:     input.HookEventName,
		Tool:      input.ToolName,
		Detail:    eventDetail(input),
		ToolUseID: eventID(input),
		Headless:  headless(os.Getenv("CLAUDE_CODE_ENTRYPOINT")),
		Subagent:  insideSubagent(input),
		PID:       pid,
		Name:      sessionName(pid),
		Model:     eventModel(input, tail),
	}
	if preview {
		event.Result = stopResult(input, tail)
	}
	return event, true
}

func eventModel(input hookInput, tail []string) string {
	switch input.HookEventName {
	case "SessionStart":
		return strings.TrimSpace(input.Model)
	case "Stop":
		return lastModel(tail)
	}
	return ""
}

// eventDetail is the short label for the event: one field the event names,
// otherwise the tool label.
func eventDetail(input hookInput) string {
	switch input.HookEventName {
	case "Notification":
		return input.NotificationType
	case "SubagentStart", "SubagentStop":
		if input.AgentType == "" {
			return "general-purpose"
		}
		return input.AgentType
	case "SessionStart", "ConfigChange":
		return input.Source
	case "SessionEnd":
		return input.Reason
	case "PreCompact", "PostCompact", "Setup":
		return input.Trigger
	case "StopFailure":
		return input.Error
	case "PostToolUseFailure":
		if input.IsInterrupt {
			return "interrupt"
		}
	case "TaskCreated", "TaskCompleted":
		return input.TaskSubject
	case "TeammateIdle":
		return input.TeammateName
	case "WorktreeRemove":
		return baseOrEmpty(input.WorktreePath)
	case "Elicitation":
		return input.MCPServerName
	case "ElicitationResult":
		return input.Action
	case "InstructionsLoaded":
		return baseOrEmpty(input.FilePath)
	case "PostModelSwitch":
		return input.ToModel
	}
	return toolDetail(input.ToolName, input.ToolInput)
}

func baseOrEmpty(path string) string {
	if path == "" {
		return ""
	}
	return filepath.Base(path)
}

// eventID pairs a subagent's start with its stop and a task's creation with
// its completion; tool events use the tool call ID.
func eventID(input hookInput) string {
	switch input.HookEventName {
	case "SubagentStart", "SubagentStop":
		return input.AgentID
	case "TaskCreated", "TaskCompleted":
		return input.TaskID
	}
	return input.ToolUseID
}

// insideSubagent names the subagent a tool event came from. Start and stop
// already carry the subagent as their ID.
func insideSubagent(input hookInput) string {
	if input.HookEventName == "SubagentStart" || input.HookEventName == "SubagentStop" {
		return ""
	}
	return input.AgentID
}
