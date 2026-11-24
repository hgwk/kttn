package terminal

import (
	"errors"
	"regexp"
	"strconv"
	"strings"
	"time"
)

// MaxMessage is the longest message the screen may send, in characters.
const MaxMessage = 2000

var (
	ErrEmpty    = errors.New("empty message")
	ErrTooLong  = errors.New("message too long")
	ErrNotReady = errors.New("session is waiting on a prompt or has ended")
)

// controlChars are dropped from a message: an ESC could close bracketed
// paste and slip in keystrokes. Only newline and tab stay.
var controlChars = regexp.MustCompile(`[\x00-\x08\x0b-\x1f\x7f-\x{9f}]`)

// CleanMessage folds CRLF to LF, drops control characters and trims.
func CleanMessage(raw string) string {
	text := strings.ReplaceAll(strings.ReplaceAll(raw, "\r\n", "\n"), "\r", "\n")
	return strings.TrimSpace(controlChars.ReplaceAllString(text, ""))
}

// submitDelay lets pasted text land in the input before Enter.
var submitDelay = 150 * time.Millisecond

// Send types a message into the session's input and presses Enter. A session
// waiting on a permission prompt is refused: the text would answer the prompt.
// A busy session queues it as its next turn.
func Send(run Run, pid int, state, raw string) error {
	text := CleanMessage(raw)
	switch {
	case text == "":
		return ErrEmpty
	case len([]rune(text)) > MaxMessage:
		return ErrTooLong
	case state == "needs_you" || state == "ended":
		return ErrNotReady
	}
	tty, err := TTY(run, pid)
	if err != nil {
		return err
	}
	for _, send := range senders {
		found, err := send(run, tty, text)
		if err != nil {
			return err
		}
		if found {
			return nil
		}
	}
	return ErrNoTab
}

type sender func(run Run, tty, text string) (bool, error)

// Terminal.app is left out: typing into it needs accessibility permission.
var senders = []sender{tmuxSend, kakuSend, weztermSend, itermSend}

func tmuxSend(run Run, tty, text string) (bool, error) {
	pane, ok := tmuxPane(run, tty)
	if !ok {
		return false, nil
	}
	if _, err := run("tmux", "send-keys", "-t", pane, "-l", "--", text); err != nil {
		return true, err
	}
	time.Sleep(submitDelay)
	_, err := run("tmux", "send-keys", "-t", pane, "Enter")
	return true, err
}

func weztermLikeSend(run Run, tty, text, cli string) (bool, error) {
	out, err := run(cli, "cli", "list", "--format", "json")
	if err != nil {
		return false, nil
	}
	pane, ok := paneForTTY(out, tty)
	if !ok {
		return false, nil
	}
	id := strconv.Itoa(pane)
	// "--" keeps a message starting with "-" from being read as an option;
	// otherwise only the Enter would go and send whatever was in the input.
	if _, err := run(cli, "cli", "send-text", "--pane-id", id, "--", text); err != nil {
		return true, err
	}
	time.Sleep(submitDelay)
	_, err = run(cli, "cli", "send-text", "--pane-id", id, "--no-paste", "\r")
	return true, err
}

func kakuSend(run Run, tty, text string) (bool, error) {
	return weztermLikeSend(run, tty, text, "/Applications/Kaku.app/Contents/MacOS/kaku")
}

func weztermSend(run Run, tty, text string) (bool, error) {
	return weztermLikeSend(run, tty, text, "/Applications/WezTerm.app/Contents/MacOS/wezterm")
}

const itermWriteScript = `on run argv
	if application "iTerm2" is not running then return "none"
	tell application "iTerm2"
		repeat with w in windows
			repeat with t in tabs of w
				repeat with s in sessions of t
					if tty of s is item 1 of argv then
						tell s to write text (item 2 of argv)
						return "ok"
					end if
				end repeat
			end repeat
		end repeat
	end tell
	return "none"
end run`

// itermSend uses `write text`, which types the text and a newline.
func itermSend(run Run, tty, text string) (bool, error) {
	return osascriptFocus(run, itermWriteScript, tty, text)
}
