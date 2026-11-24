package terminal

import (
	"encoding/json"
	"strconv"
	"strings"
)

// tmuxPane finds the tmux pane on tty. No tmux or no server means none.
func tmuxPane(run Run, tty string) (string, bool) {
	out, err := run("tmux", "list-panes", "-a", "-F", "#{pane_tty} #{pane_id}")
	if err != nil {
		return "", false
	}
	for _, line := range strings.Split(out, "\n") {
		fields := strings.Fields(line)
		if len(fields) == 2 && fields[0] == tty && strings.HasPrefix(fields[1], "%") {
			return fields[1], true
		}
	}
	return "", false
}

// tmuxFocus selects the tmux window and pane on tty. The terminal that hosts
// the tmux client is not raised; tmux does not say which one it is.
func tmuxFocus(run Run, tty string) (bool, error) {
	pane, ok := tmuxPane(run, tty)
	if !ok {
		return false, nil
	}
	if _, err := run("tmux", "select-window", "-t", pane); err != nil {
		return true, err
	}
	_, err := run("tmux", "select-pane", "-t", pane)
	return true, err
}

// weztermLike covers WezTerm and Kaku, which share WezTerm's `cli`.
func weztermLike(run Run, tty, cli, app string) (bool, error) {
	out, err := run(cli, "cli", "list", "--format", "json")
	if err != nil {
		return false, nil
	}
	pane, ok := paneForTTY(out, tty)
	if !ok {
		return false, nil
	}
	if _, err := run(cli, "cli", "activate-pane", "--pane-id", strconv.Itoa(pane)); err != nil {
		return true, err
	}
	// The pane changes inside its window; the app itself may sit behind others.
	_, err = run("/usr/bin/open", "-a", app)
	return true, err
}

func kakuFocus(run Run, tty string) (bool, error) {
	return weztermLike(run, tty, "/Applications/Kaku.app/Contents/MacOS/kaku", "Kaku")
}

func weztermFocus(run Run, tty string) (bool, error) {
	return weztermLike(run, tty, "/Applications/WezTerm.app/Contents/MacOS/wezterm", "WezTerm")
}

// paneForTTY finds the pane on tty in `cli list --format json` output.
func paneForTTY(listJSON, tty string) (int, bool) {
	var panes []struct {
		PaneID  *int   `json:"pane_id"`
		TTYName string `json:"tty_name"`
	}
	if json.Unmarshal([]byte(listJSON), &panes) != nil {
		return 0, false
	}
	for _, pane := range panes {
		if pane.TTYName == tty && pane.PaneID != nil {
			return *pane.PaneID, true
		}
	}
	return 0, false
}

// AppleScript focusers. The tty comes in as an argument, never spliced into
// the script, and an app that is not running is left closed: `tell` would
// launch it.
const itermScript = `on run argv
	if application "iTerm2" is not running then return "none"
	tell application "iTerm2"
		repeat with w in windows
			repeat with t in tabs of w
				repeat with s in sessions of t
					if tty of s is item 1 of argv then
						select w
						select t
						select s
						activate
						return "ok"
					end if
				end repeat
			end repeat
		end repeat
	end tell
	return "none"
end run`

const appleTerminalScript = `on run argv
	if application "Terminal" is not running then return "none"
	tell application "Terminal"
		repeat with w in windows
			repeat with t in tabs of w
				if tty of t is item 1 of argv then
					set selected of t to true
					set index of w to 1
					activate
					return "ok"
				end if
			end repeat
		end repeat
	end tell
	return "none"
end run`

// osascriptFocus runs a script that answers "ok" when it found the tab. The
// tty and any text go in as arguments.
func osascriptFocus(run Run, script string, argv ...string) (bool, error) {
	out, err := run("/usr/bin/osascript", append([]string{"-e", script}, argv...)...)
	if err != nil {
		return false, nil // no permission or no such app: try the next one
	}
	return strings.TrimSpace(out) == "ok", nil
}

func itermFocus(run Run, tty string) (bool, error) {
	return osascriptFocus(run, itermScript, tty)
}

func appleTerminalFocus(run Run, tty string) (bool, error) {
	return osascriptFocus(run, appleTerminalScript, tty)
}
