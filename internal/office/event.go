// Package office keeps the state of every Claude Code session the hook
// reports. It lives in the server's memory, with a small state file so a
// restart picks up where it left off.
package office

import (
	"errors"
	"strings"
)

const (
	MaxField  = 64
	MaxFolder = 160
	MaxResult = 300
)

// Event is one hook signal after checking. Field names follow the hook's JSON.
type Event struct {
	Source    string
	Session   string
	Project   string
	Folder    string
	Root      string
	Event     string
	Tool      string
	Detail    string
	ToolUseID string
	Result    string
	Headless  bool
	// Subagent is the subagent a tool or notice came from, if any.
	Subagent string
	// PID is the Claude Code process; 0 when unknown.
	PID int
	// Name is the session's peer name.
	Name  string
	Model string
}

var knownEvents = map[string]bool{
	"SessionStart": true, "UserPromptSubmit": true, "PreToolUse": true,
	"PostToolUse": true, "PermissionRequest": true, "Notification": true,
	"Stop": true, "SubagentStart": true, "SubagentStop": true, "SessionEnd": true,
}

func init() {
	for name := range momentEvents {
		knownEvents[name] = true
	}
}

// field folds whitespace to single spaces and cuts to max characters.
func field(value any, max int) string {
	text, ok := value.(string)
	if !ok {
		return ""
	}
	runes := []rune(strings.Join(strings.Fields(text), " "))
	if len(runes) > max {
		runes = runes[:max]
	}
	return string(runes)
}

// folderField is a folder inside the repository. Empty parts, "." and ".."
// are dropped so the path can never climb out.
func folderField(value any) string {
	var parts []string
	for _, part := range strings.Split(field(value, MaxFolder), "/") {
		if part != "" && part != "." && part != ".." {
			parts = append(parts, part)
		}
	}
	return strings.Join(parts, "/")
}

// rootField is where the office sits: home-relative, or absolute with a
// leading "/". Climbing parts are dropped.
func rootField(value any) string {
	text, _ := value.(string)
	path := folderField(value)
	if strings.HasPrefix(strings.TrimSpace(text), "/") {
		return "/" + path
	}
	return path
}

func pidField(value any) int {
	number, ok := value.(float64)
	if !ok || number != float64(int(number)) || number <= 1 || number > 1<<31 {
		return 0
	}
	return int(number)
}

// ParseEvent checks a decoded hook body and returns the cleaned event.
func ParseEvent(raw any) (Event, error) {
	body, ok := raw.(map[string]any)
	if !ok {
		return Event{}, errors.New("invalid JSON body")
	}
	event := Event{
		Source:    field(body["source"], MaxField),
		Session:   field(body["session"], MaxField),
		Project:   field(body["project"], MaxField),
		Folder:    folderField(body["folder"]),
		Root:      rootField(body["root"]),
		Event:     field(body["event"], MaxField),
		Tool:      field(body["tool"], MaxField),
		Detail:    field(body["detail"], MaxField),
		ToolUseID: field(body["tool_use_id"], MaxField),
		Result:    field(body["result"], MaxResult),
		Headless:  body["headless"] == true,
		Subagent:  field(body["subagent"], MaxField),
		PID:       pidField(body["pid"]),
		Name:      field(body["name"], MaxField),
		Model:     field(body["model"], MaxField),
	}
	if event.Project == "" {
		event.Project = "project"
	}
	switch {
	case event.Source == "":
		return Event{}, errors.New("source is required")
	case event.Session == "":
		return Event{}, errors.New("session is required")
	case !knownEvents[event.Event]:
		return Event{}, errors.New("unknown event")
	}
	return event, nil
}

// ToolState is what the character does at its desk for a tool.
func ToolState(tool string) string {
	switch tool {
	case "Read", "Grep", "Glob", "LS":
		return "reading"
	case "Edit", "Write", "MultiEdit", "NotebookEdit":
		return "editing"
	case "Bash", "BashOutput":
		return "running"
	case "WebFetch", "WebSearch":
		return "browsing"
	case "Agent", "Task":
		return "delegating"
	}
	return "working"
}
