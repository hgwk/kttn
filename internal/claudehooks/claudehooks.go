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
	"regexp"
	"strings"
)

// Command is what a registered hook runs when kttn is on the PATH.
const Command = "kttn hook"

// CommandFor is the hook command for a kttn binary outside the PATH.
func CommandFor(exe string) string {
	return shellQuote(exe) + " hook"
}

// WithConfig pins a hook command to one config file. Claude Code started
// from an IDE or the desktop app does not get the shell's XDG_* or KTTN_*
// variables, and without the pin its hook would read another config and be
// refused.
func WithConfig(command, configPath string) string {
	return command + " --config " + shellQuote(configPath)
}

// shellQuote quotes one word for the shell Claude Code runs hooks with.
func shellQuote(word string) string {
	return "'" + strings.ReplaceAll(word, "'", `'\''`) + "'"
}

// ourCommand matches what Install wrote: a kttn binary (bare, a path, or a
// quoted path) running `hook`, with or without a pinned config.
var ourCommand = regexp.MustCompile(`^(.+) hook( --config '([^']|'\\'')*')?$`)

// quotedWord is one word shellQuote wrote.
var quotedWord = regexp.MustCompile(`^'(([^']|'\\'')*)'$`)

// ours recognises a command Install wrote, in any form it ever wrote. The
// program must be one word, quoted the way shellQuote quotes or plain with
// nothing the shell would act on, so a user's own `x && kttn hook` line is
// never taken for ours.
func ours(command string) bool {
	match := ourCommand.FindStringSubmatch(command)
	if match == nil {
		return false
	}
	exe := match[1]
	if quoted := quotedWord.FindStringSubmatch(exe); quoted != nil {
		exe = strings.ReplaceAll(quoted[1], `'\''`, "'")
	} else if strings.ContainsAny(exe, " \t;&|$`<>()'\"\\*?") {
		return false
	}
	return filepath.Base(exe) == "kttn"
}

// Events are the hook events kttn understands, the same list the plugin
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

type hookCommand struct {
	Type    string `json:"type"`
	Command string `json:"command"`
	Timeout int    `json:"timeout,omitempty"`
}

type entry struct {
	Matcher string        `json:"matcher,omitempty"`
	Hooks   []hookCommand `json:"hooks"`
}

// Install adds one `kttn hook` entry per event, replacing any it added
// before. It reports how many events it wrote.
func Install(path string) (int, error) {
	return InstallCommand(path, Command)
}

// InstallCommand is Install with the command to register, for a kttn
// binary that is not on the PATH.
func InstallCommand(path, command string) (int, error) {
	return rewrite(path, command)
}

// Uninstall removes the entries Install added and reports how many events
// had one.
func Uninstall(path string) (int, error) {
	return rewrite(path, "")
}

// rewrite takes out every entry Install wrote and, when command is set,
// adds one running command per event.
func rewrite(path string, command string) (int, error) {
	add := command != ""
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
			hook := entry{Hooks: []hookCommand{{Type: "command", Command: command, Timeout: 2}}}
			if toolEvents[event] {
				hook.Matcher = "*"
			}
			encoded, _ := json.Marshal(hook)
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
		if json.Unmarshal(raw, &e) == nil && len(e.Hooks) == 1 && ours(e.Hooks[0].Command) {
			continue
		}
		kept = append(kept, raw)
	}
	return kept
}

// write replaces the settings atomically. A symlinked settings.json (say,
// from a dotfiles repo) is written through to its target, so the link stays.
// The first rewrite keeps the user's original as .bak beside the link, not
// in the dotfiles repo where it could be committed; later ones leave it
// alone. The original's indentation is kept.
func write(path string, compact []byte) error {
	backup := path + ".bak"
	if target, err := filepath.EvalSymlinks(path); err == nil {
		path = target
	}
	old, readErr := os.ReadFile(path)
	var pretty bytes.Buffer
	if err := json.Indent(&pretty, compact, "", indentOf(old)); err != nil {
		return err
	}
	pretty.WriteByte('\n')
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return err
	}
	if readErr == nil {
		if _, err := os.Lstat(backup); errors.Is(err, fs.ErrNotExist) {
			if err := os.WriteFile(backup, old, 0o600); err != nil {
				return err
			}
		}
	}
	temp := path + ".kttn.tmp"
	if err := os.WriteFile(temp, pretty.Bytes(), 0o600); err != nil {
		return err
	}
	return os.Rename(temp, path)
}

// indentOf finds the indentation of the first indented line: a tab, or a
// run of spaces. Two spaces when the file is new or on one line.
func indentOf(raw []byte) string {
	for _, line := range strings.Split(string(raw), "\n") {
		trimmed := strings.TrimLeft(line, " \t")
		if trimmed == "" || len(trimmed) == len(line) {
			continue
		}
		return line[:len(line)-len(trimmed)]
	}
	return "  "
}

// PluginEnabled reports whether the kttn plugin is turned on in these
// settings, which together with installed hooks reports every event twice.
func PluginEnabled(path string) bool {
	raw, err := os.ReadFile(path)
	if err != nil {
		return false
	}
	var doc struct {
		EnabledPlugins map[string]bool `json:"enabledPlugins"`
	}
	if json.Unmarshal(raw, &doc) != nil {
		return false
	}
	for name, on := range doc.EnabledPlugins {
		if on && strings.HasPrefix(name, "kttn@") {
			return true
		}
	}
	return false
}
