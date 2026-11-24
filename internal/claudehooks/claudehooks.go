// Package claudehooks registers `kttn hook` in Claude Code's user settings
// for people who do not use the plugin, and takes it out again. Everything
// else in settings.json, including other tools' hooks and the order of keys,
// is left as it was.
package claudehooks

import (
	"bytes"
	"encoding/json"
	"errors"
	"io/fs"
	"os"
	"path/filepath"
)

// Command is what every registered hook runs.
const Command = "kttn hook"

// Events are the hook events the office understands, the same list the plugin
// registers. WorktreeCreate is never hooked: a hook there replaces Claude
// Code's own worktree creation.
var Events = []string{
	"SessionStart", "UserPromptSubmit", "PreToolUse", "PostToolUse",
	"PermissionRequest", "Notification", "Stop", "SubagentStart",
	"SubagentStop", "SessionEnd", "PostToolUseFailure", "StopFailure",
	"PreCompact", "PostCompact", "TaskCreated", "TaskCompleted",
	"TeammateIdle", "WorktreeRemove", "Elicitation", "ElicitationResult",
	"InstructionsLoaded", "ConfigChange", "Setup", "PostModelSwitch",
}

// toolEvents take a matcher; "*" covers every tool.
var toolEvents = map[string]bool{"PreToolUse": true, "PostToolUse": true, "PermissionRequest": true}

// SettingsPath is ~/.claude/settings.json, or settings.json in
// CLAUDE_CONFIG_DIR when Claude Code is pointed elsewhere.
func SettingsPath() string {
	if dir := os.Getenv("CLAUDE_CONFIG_DIR"); dir != "" {
		return filepath.Join(dir, "settings.json")
	}
	home, err := os.UserHomeDir()
	if err != nil {
		return ""
	}
	return filepath.Join(home, ".claude", "settings.json")
}

type command struct {
	Type    string `json:"type"`
	Command string `json:"command"`
	Timeout int    `json:"timeout,omitempty"`
}

type entry struct {
	Matcher string    `json:"matcher,omitempty"`
	Hooks   []command `json:"hooks"`
}

// Install adds one `kttn hook` entry per event, replacing any it added
// before. It reports how many events it wrote.
func Install(path string) (int, error) {
	return rewrite(path, true)
}

// Uninstall removes the entries Install added and reports how many events
// had one.
func Uninstall(path string) (int, error) {
	return rewrite(path, false)
}

func rewrite(path string, add bool) (int, error) {
	raw, err := os.ReadFile(path)
	if errors.Is(err, fs.ErrNotExist) {
		if !add {
			return 0, nil
		}
		raw = []byte("{}")
	} else if err != nil {
		return 0, err
	}
	settings, err := parseObject(raw)
	if err != nil {
		return 0, errors.New(path + " is not a JSON object; fix it or move it aside first")
	}
	hooks := object{}
	if value, ok := settings.get("hooks"); ok {
		if hooks, err = parseObject(value); err != nil {
			return 0, errors.New(`"hooks" in ` + path + " is not an object")
		}
	}
	touched := 0
	for _, event := range Events {
		var entries []json.RawMessage
		if value, ok := hooks.get(event); ok {
			if json.Unmarshal(value, &entries) != nil {
				return 0, errors.New(`hooks.` + event + ` in ` + path + " is not a list")
			}
		}
		kept := withoutOurs(entries)
		if len(kept) != len(entries) && !add {
			touched++
		}
		if add {
			ours := entry{Hooks: []command{{Type: "command", Command: Command, Timeout: 2}}}
			if toolEvents[event] {
				ours.Matcher = "*"
			}
			encoded, _ := json.Marshal(ours)
			kept = append(kept, encoded)
			touched++
		}
		if len(kept) == 0 {
			hooks.remove(event)
			continue
		}
		list, _ := json.Marshal(kept)
		hooks.set(event, list)
	}
	if len(hooks.keys) == 0 {
		settings.remove("hooks")
	} else {
		settings.set("hooks", hooks.encode())
	}
	return touched, write(path, settings.encode())
}

// withoutOurs drops entries whose only command is `kttn hook`.
func withoutOurs(entries []json.RawMessage) []json.RawMessage {
	kept := []json.RawMessage{}
	for _, raw := range entries {
		var e entry
		if json.Unmarshal(raw, &e) == nil && len(e.Hooks) == 1 && e.Hooks[0].Command == Command {
			continue
		}
		kept = append(kept, raw)
	}
	return kept
}

// write replaces the file atomically and keeps the previous one as .bak.
func write(path string, compact []byte) error {
	var pretty bytes.Buffer
	if err := json.Indent(&pretty, compact, "", "  "); err != nil {
		return err
	}
	pretty.WriteByte('\n')
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return err
	}
	if old, err := os.ReadFile(path); err == nil {
		if err := os.WriteFile(path+".bak", old, 0o600); err != nil {
			return err
		}
	}
	temp := path + ".kttn.tmp"
	if err := os.WriteFile(temp, pretty.Bytes(), 0o600); err != nil {
		return err
	}
	return os.Rename(temp, path)
}
