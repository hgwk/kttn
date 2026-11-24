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

func TestAnAbsoluteKttnPathReplacesThePlainCommandAndBack(t *testing.T) {
	path := filepath.Join(t.TempDir(), "settings.json")
	Install(path)
	cmd := CommandFor("/Users/me/.local/bin/kttn")
	if cmd != "'/Users/me/.local/bin/kttn' hook" {
		t.Fatalf("command %q", cmd)
	}
	InstallCommand(path, cmd)
	stop := hooksOf(t, path)["Stop"]
	if len(stop) != 1 || stop[0].Hooks[0].Command != cmd {
		t.Fatalf("Stop %+v", stop)
	}
	if n, _ := Uninstall(path); n != len(Events) {
		t.Fatalf("uninstall found %d", n)
	}
	for _, other := range []string{"kttn-helper hook", "/bin/notkttn hook", "kttn hooks"} {
		if ours(other) {
			t.Errorf("%q taken for ours", other)
		}
	}
}

func TestASymlinkedSettingsFileStaysALinkAndTheFirstBackupIsKept(t *testing.T) {
	dir := t.TempDir()
	real := filepath.Join(dir, "dotfiles", "claude-settings.json")
	os.MkdirAll(filepath.Dir(real), 0o700)
	original := "{\n\t\"model\": \"opus\"\n}\n"
	os.WriteFile(real, []byte(original), 0o600)
	link := filepath.Join(dir, "claude", "settings.json")
	os.MkdirAll(filepath.Dir(link), 0o700)
	if err := os.Symlink(real, link); err != nil {
		t.Fatal(err)
	}
	Install(link)
	Install(link)
	if info, err := os.Lstat(link); err != nil || info.Mode()&os.ModeSymlink == 0 {
		t.Fatal("settings.json is no longer a symlink")
	}
	written, _ := os.ReadFile(real)
	if !strings.Contains(string(written), "\n\t\"model\"") || !strings.Contains(string(written), Command) {
		t.Fatalf("target not updated with its tab indentation:\n%s", written)
	}
	if bak, _ := os.ReadFile(link + ".bak"); string(bak) != original {
		t.Fatalf("the second run replaced the original backup:\n%s", bak)
	}
	if _, err := os.Stat(real + ".bak"); err == nil {
		t.Fatal("a backup landed in the dotfiles repo")
	}
}

func TestPluginEnabledSpotsTheKttnPlugin(t *testing.T) {
	dir := t.TempDir()
	on := filepath.Join(dir, "on.json")
	os.WriteFile(on, []byte(`{"enabledPlugins":{"kttn@kttn":true,"other@x":true}}`), 0o600)
	off := filepath.Join(dir, "off.json")
	os.WriteFile(off, []byte(`{"enabledPlugins":{"kttn@kttn":false}}`), 0o600)
	if !PluginEnabled(on) || PluginEnabled(off) || PluginEnabled(filepath.Join(dir, "missing.json")) {
		t.Fatal("wrong plugin detection")
	}
}

func TestAPinnedConfigReplacesEveryEarlierFormAndOnlyThose(t *testing.T) {
	path := filepath.Join(t.TempDir(), "settings.json")
	pinned := WithConfig(CommandFor("/Users/me/.local/bin/kttn"), "/Users/me/xdg/it's/kttn/config.json")
	if pinned != `'/Users/me/.local/bin/kttn' hook --config '/Users/me/xdg/it'\''s/kttn/config.json'` {
		t.Fatalf("command %q", pinned)
	}
	for _, earlier := range []string{Command, CommandFor("/opt/kttn"), WithConfig(Command, "/a b/config.json")} {
		InstallCommand(path, earlier)
		InstallCommand(path, pinned)
		if stop := hooksOf(t, path)["Stop"]; len(stop) != 1 || stop[0].Hooks[0].Command != pinned {
			t.Fatalf("after %q: %+v", earlier, stop)
		}
	}
	for _, other := range []string{"kttn hook --config /x; rm -rf ~", "kttn hook --verbose", "kttn hook --config 'a' 'b'"} {
		if ours(other) {
			t.Errorf("%q taken for ours", other)
		}
	}
}
