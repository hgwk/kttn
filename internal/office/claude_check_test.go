package office

import (
	"errors"
	"testing"
)

func TestOnlyThisUsersClaudeProcessesCountAsAlive(t *testing.T) {
	list := func() (string, error) {
		return "  101 claude\n  102 -zsh\n  103 /Users/me/.local/bin/claude\n  104 node\n    1 launchd\n", nil
	}
	alive := NewClaudeCheck(list)
	for pid, want := range map[int]bool{101: true, 102: false, 103: true, 104: false, 1: false, 999: false} {
		if alive(pid) != want {
			t.Errorf("pid %d: want %v", pid, want)
		}
	}
	broken := NewClaudeCheck(func() (string, error) { return "", errors.New("no ps") })
	if broken(101) {
		t.Fatal("a failed listing must not keep sessions alive")
	}
}
