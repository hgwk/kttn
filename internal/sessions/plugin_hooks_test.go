package sessions

import (
	"encoding/json"
	"os"
	"sort"
	"testing"
)

// The plugin must register exactly the events kttn understands: a
// missing one leaves cats stuck, an extra one is rejected as unknown.
// WorktreeCreate would replace Claude Code's own worktree creation, so it
// must never be hooked.
func TestThePluginHooksEveryEventKttnKnows(t *testing.T) {
	raw, err := os.ReadFile("../../plugin/hooks/hooks.json")
	if err != nil {
		t.Fatal(err)
	}
	var doc struct {
		Hooks map[string][]struct {
			Matcher string `json:"matcher"`
			Hooks   []struct {
				Type    string `json:"type"`
				Command string `json:"command"`
				Timeout int    `json:"timeout"`
			} `json:"hooks"`
		} `json:"hooks"`
	}
	if err := json.Unmarshal(raw, &doc); err != nil {
		t.Fatal(err)
	}
	var hooked, known []string
	for name, entries := range doc.Hooks {
		hooked = append(hooked, name)
		if len(entries) != 1 || len(entries[0].Hooks) != 1 {
			t.Fatalf("%s: want one command", name)
		}
		cmd := entries[0].Hooks[0]
		if cmd.Type != "command" || cmd.Command != "kttn hook" || cmd.Timeout <= 0 || cmd.Timeout > 5 {
			t.Errorf("%s: %+v", name, cmd)
		}
		toolEvent := name == "PreToolUse" || name == "PostToolUse" || name == "PermissionRequest"
		if toolEvent != (entries[0].Matcher == "*") {
			t.Errorf("%s: matcher %q", name, entries[0].Matcher)
		}
	}
	for name := range knownEvents {
		known = append(known, name)
	}
	sort.Strings(hooked)
	sort.Strings(known)
	if len(hooked) != 24 || len(known) != 24 {
		t.Fatalf("hooked %d, known %d", len(hooked), len(known))
	}
	for i := range known {
		if hooked[i] != known[i] {
			t.Fatalf("hooked %v\nknown  %v", hooked, known)
		}
	}
	if _, ok := doc.Hooks["WorktreeCreate"]; ok {
		t.Fatal("WorktreeCreate must not be hooked")
	}
}
