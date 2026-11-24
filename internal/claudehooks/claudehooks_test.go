package claudehooks

import (
	"encoding/json"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
)

const existing = `{
  "model": "opus",
  "hooks": {
    "Stop": [{"hooks": [{"type": "command", "command": "say done"}]}],
    "PreToolUse": [{"matcher": "Bash", "hooks": [{"type": "command", "command": "guard.sh"}]}]
  },
  "statusLine": {"type": "command", "command": "line.sh"}
}`

func hooksOf(t *testing.T, path string) map[string][]entry {
	t.Helper()
	raw, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	var doc struct {
		Hooks map[string][]entry `json:"hooks"`
	}
	if err := json.Unmarshal(raw, &doc); err != nil {
		t.Fatal(err)
	}
	return doc.Hooks
}

func TestInstallAddsKttnBesideOtherHooksAndKeepsTheRest(t *testing.T) {
	path := filepath.Join(t.TempDir(), "settings.json")
	os.WriteFile(path, []byte(existing), 0o600)
	if n, err := Install(path); err != nil || n != len(Events) {
		t.Fatalf("install: %d %v", n, err)
	}
	// Twice is the same as once.
	if _, err := Install(path); err != nil {
		t.Fatal(err)
	}
	hooks := hooksOf(t, path)
	if len(hooks) != len(Events) {
		t.Fatalf("events %d", len(hooks))
	}
	if got := hooks["Stop"]; len(got) != 2 || got[0].Hooks[0].Command != "say done" || got[1].Hooks[0].Command != Command {
		t.Fatalf("Stop %+v", got)
	}
	if got := hooks["PreToolUse"]; len(got) != 2 || got[0].Matcher != "Bash" || got[1].Matcher != "*" {
		t.Fatalf("PreToolUse %+v", got)
	}
	if _, ok := hooks["WorktreeCreate"]; ok {
		t.Fatal("WorktreeCreate hooked")
	}
	raw, _ := os.ReadFile(path)
	text := string(raw)
	if !(strings.Index(text, `"model"`) < strings.Index(text, `"hooks"`) && strings.Index(text, `"hooks"`) < strings.Index(text, `"statusLine"`)) {
		t.Fatalf("key order changed:\n%s", text)
	}
	if bak, _ := os.ReadFile(path + ".bak"); len(bak) == 0 {
		t.Fatal("no backup kept")
	}
}

func TestUninstallRemovesOnlyKttn(t *testing.T) {
	path := filepath.Join(t.TempDir(), "settings.json")
	os.WriteFile(path, []byte(existing), 0o600)
	Install(path)
	if n, err := Uninstall(path); err != nil || n != len(Events) {
		t.Fatalf("uninstall: %d %v", n, err)
	}
	var before, after map[string]any
	json.Unmarshal([]byte(existing), &before)
	raw, _ := os.ReadFile(path)
	json.Unmarshal(raw, &after)
	if !reflect.DeepEqual(before, after) {
		t.Fatalf("settings changed:\n%s", raw)
	}
}

func TestInstallCreatesSettingsAndRefusesBrokenOnes(t *testing.T) {
	dir := t.TempDir()
	fresh := filepath.Join(dir, "new", "settings.json")
	if _, err := Install(fresh); err != nil {
		t.Fatal(err)
	}
	if len(hooksOf(t, fresh)) != len(Events) {
		t.Fatal("fresh install incomplete")
	}
	Uninstall(fresh)
	if raw, _ := os.ReadFile(fresh); strings.TrimSpace(string(raw)) != "{}" {
		t.Fatalf("leftovers: %s", raw)
	}
	broken := filepath.Join(dir, "broken.json")
	os.WriteFile(broken, []byte(`{"hooks": [}`), 0o600)
	if _, err := Install(broken); err == nil {
		t.Fatal("broken settings accepted")
	}
	if raw, _ := os.ReadFile(broken); string(raw) != `{"hooks": [}` {
		t.Fatal("broken settings rewritten")
	}
	if n, err := Uninstall(filepath.Join(dir, "missing.json")); err != nil || n != 0 {
		t.Fatalf("missing: %d %v", n, err)
	}
}

// The plugin and `kttn install` must register the same events.
func TestThePluginRegistersTheSameEvents(t *testing.T) {
	raw, err := os.ReadFile("../../plugin/hooks/hooks.json")
	if err != nil {
		t.Fatal(err)
	}
	var doc struct {
		Hooks map[string][]entry `json:"hooks"`
	}
	json.Unmarshal(raw, &doc)
	if len(doc.Hooks) != len(Events) {
		t.Fatalf("plugin %d, install %d", len(doc.Hooks), len(Events))
	}
	for _, event := range Events {
		got := doc.Hooks[event]
		if len(got) != 1 || got[0].Hooks[0].Command != Command || (got[0].Matcher == "*") != toolEvents[event] {
			t.Errorf("%s: %+v", event, got)
		}
	}
}
