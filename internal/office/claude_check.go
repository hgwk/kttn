package office

import (
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"
)

// claudeCacheFor is how long one process listing answers liveness questions;
// a snapshot asks about every session at once.
var claudeCacheFor = time.Second

// IsClaude reports whether a `ps` comm value names Claude Code.
func IsClaude(comm string) bool {
	return strings.Contains(filepath.Base(strings.TrimSpace(comm)), "claude")
}

// NewClaudeCheck returns a liveness check that counts a pid as alive only
// while it is a Claude Code process of this user. A bare "the pid exists"
// is not enough: after a restart or reboot the number can belong to any
// other program, even a shell the office would then type into.
func NewClaudeCheck(list func() (string, error)) func(int) bool {
	if list == nil {
		list = listOwnProcesses
	}
	var (
		mu    sync.Mutex
		at    time.Time
		alive map[int]bool
	)
	return func(pid int) bool {
		mu.Lock()
		defer mu.Unlock()
		if alive == nil || time.Since(at) > claudeCacheFor {
			// A failed listing keeps the last answer rather than ending
			// every session; the next question tries again.
			if fresh, ok := parseClaudePIDs(list); ok || alive == nil {
				alive = fresh
			}
			at = time.Now()
		}
		return alive[pid]
	}
}

func listOwnProcesses() (string, error) {
	// -ww: never cut a long executable path, or its name would be lost.
	out, err := exec.Command("ps", "-ww", "-U", strconv.Itoa(os.Getuid()), "-o", "pid=,comm=").Output()
	return string(out), err
}

// parseClaudePIDs reads `pid comm` lines. ok is false when the listing
// failed; nothing is known to be alive then.
func parseClaudePIDs(list func() (string, error)) (pids map[int]bool, ok bool) {
	pids = map[int]bool{}
	out, err := list()
	if err != nil {
		return pids, false
	}
	for _, line := range strings.Split(out, "\n") {
		fields := strings.Fields(line)
		if len(fields) < 2 {
			continue
		}
		pid, err := strconv.Atoi(fields[0])
		if err == nil && pid > 1 && IsClaude(strings.Join(fields[1:], " ")) {
			pids[pid] = true
		}
	}
	return pids, true
}
