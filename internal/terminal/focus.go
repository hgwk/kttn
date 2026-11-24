// Package terminal brings a session's terminal tab to the front. It finds the
// tab by the session's Claude Code process: process → tty → the terminal pane
// that owns that tty. Terminals are tried in a fixed order; one that is not
// installed or not running is skipped.
package terminal

import (
	"context"
	"errors"
	"os/exec"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"
)

// Run executes a program with arguments and returns its stdout. Nothing goes
// through a shell. Tests swap it.
type Run func(name string, args ...string) (string, error)

var (
	// ErrNoTab means no supported terminal owns the session's tty.
	ErrNoTab = errors.New("no terminal tab for this session")
	// ErrNoProcess means the session never reported its process.
	ErrNoProcess = errors.New("session has no process")
)

var ttyName = regexp.MustCompile(`^ttys?\d+$`)

// TTY returns the controlling terminal of a Claude Code process as
// /dev/ttysNNN. A pid that now belongs to another program (it was reused
// after the session ended) is refused, so nothing is typed into it.
func TTY(run Run, pid int) (string, error) {
	if pid <= 1 {
		return "", ErrNoProcess
	}
	out, err := run("/bin/ps", "-o", "tty=,comm=", "-p", strconv.Itoa(pid))
	if err != nil {
		return "", ErrNoProcess
	}
	fields := strings.Fields(out)
	if len(fields) < 2 || !strings.Contains(filepath.Base(strings.Join(fields[1:], " ")), "claude") {
		return "", ErrNoProcess
	}
	name := fields[0]
	if !ttyName.MatchString(name) {
		return "", ErrNoTab
	}
	return "/dev/" + name, nil
}

// adapter focuses the pane that owns tty. found=false means this terminal
// does not have it (or is not there at all), so the next one is tried.
type adapter func(run Run, tty string) (found bool, err error)

// adapters in the order they are tried. tmux comes first because a tmux pane
// runs inside another terminal whose own tab only shows the tmux client.
var adapters = []adapter{tmuxFocus, kakuFocus, weztermFocus, itermFocus, appleTerminalFocus}

// Focus brings the session's tab forward.
func Focus(run Run, pid int) error {
	tty, err := TTY(run, pid)
	if err != nil {
		return err
	}
	for _, focus := range adapters {
		found, err := focus(run, tty)
		if err != nil {
			return err
		}
		if found {
			return nil
		}
	}
	return ErrNoTab
}

// Exec runs a program directly (no shell) with a time limit and returns its
// stdout. It is the Run used outside tests.
func Exec(name string, args ...string) (string, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	out, err := exec.CommandContext(ctx, name, args...).Output()
	return string(out), err
}
