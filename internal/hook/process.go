package hook

import (
	"encoding/json"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
)

// carriesPID names the events that look up the Claude Code process. Stop and
// Notification are there too: a session the server dropped comes back on
// whatever event it sends next, and without a PID the server would drop it
// again after six quiet hours even though its terminal is still open.
func carriesPID(event string) bool {
	switch event {
	case "SessionStart", "UserPromptSubmit", "Stop", "Notification":
		return true
	}
	return false
}

// sessionPID finds the claude process above the hook. Claude Code usually
// runs the hook directly; when a shell sits in between, the shell's parent is
// used. Anything else gives 0, and the server then keeps its timers.
func sessionPID(event string) int {
	if !carriesPID(event) {
		return 0
	}
	pid := os.Getppid()
	for hop := 0; hop < 2 && pid > 1; hop++ {
		out, err := exec.Command("ps", "-o", "ppid=,comm=", "-p", strconv.Itoa(pid)).Output()
		if err != nil {
			return 0
		}
		fields := strings.Fields(string(out))
		if len(fields) < 2 {
			return 0
		}
		if strings.Contains(filepath.Base(fields[1]), "claude") {
			return pid
		}
		if pid, err = strconv.Atoi(fields[0]); err != nil {
			return 0
		}
	}
	return 0
}

// sessionName reads the peer name Claude Code keeps for a running session in
// ~/.claude/sessions/<pid>.json. The file is not a documented interface, so
// any failure just leaves the name empty.
func sessionName(pid int) string {
	if pid <= 0 {
		return ""
	}
	home, err := os.UserHomeDir()
	if err != nil {
		return ""
	}
	raw, err := os.ReadFile(filepath.Join(home, ".claude", "sessions", strconv.Itoa(pid)+".json"))
	if err != nil {
		return ""
	}
	var entry struct {
		Name string `json:"name"`
	}
	if json.Unmarshal(raw, &entry) != nil {
		return ""
	}
	return entry.Name
}

// headless reports whether Claude Code runs without a person at the terminal:
// print mode sets the entrypoint to sdk-cli, the SDKs to sdk-ts or sdk-py.
func headless(entrypoint string) bool {
	return strings.HasPrefix(entrypoint, "sdk-")
}
