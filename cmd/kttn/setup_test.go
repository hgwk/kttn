package main

import (
	"bytes"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/hgwk/kttn/internal/autostart"
	"github.com/hgwk/kttn/internal/claudehooks"
	"github.com/hgwk/kttn/internal/config"
)

// fakeMachine runs setup against temp folders only: no real LaunchAgent,
// systemd, settings.json or browser is touched.
func fakeMachine(t *testing.T) (machine, *[]string, *[]string) {
	t.Helper()
	dir := t.TempDir()
	t.Setenv("KTTN_CONFIG", filepath.Join(dir, "kttn", "config.json"))
	t.Setenv("CLAUDE_CONFIG_DIR", filepath.Join(dir, "claude"))
	npx := filepath.Join(dir, "npm", "_npx", "abc", "node_modules", "@hgwk", "kttn", "bin", "native", "kttn")
	os.MkdirAll(filepath.Dir(npx), 0o755)
	os.WriteFile(npx, []byte("binary"), 0o755)
	var calls, opened []string
	m := machine{
		exe:  npx,
		home: filepath.Join(dir, "home"),
		service: autostart.Service{GOOS: "darwin", Home: filepath.Join(dir, "home"), UID: 501, Run: func(name string, args ...string) (string, error) {
			calls = append(calls, name+" "+strings.Join(args, " "))
			return "", nil
		}},
		onPath: func() (string, bool) { return "", false },
		open:   func(url string) { opened = append(opened, url) },
		ready:  func(string) bool { return true },
	}
	return m, &calls, &opened
}

func TestSetupDoesEverythingOnceAndAgainWithoutAsking(t *testing.T) {
	m, calls, opened := fakeMachine(t)
	var out bytes.Buffer
	if err := runSetup(strings.NewReader("우리 팀\nja\n"), &out, m); err != nil {
		t.Fatal(err)
	}
	cfg, found, _ := config.Load(config.Path())
	if !found || cfg.OfficeName != "우리 팀" || cfg.Lang != "ja" || cfg.Preview || cfg.Token == "" {
		t.Fatalf("config %+v", cfg)
	}
	stable := filepath.Join(m.home, ".local", "bin", "kttn")
	if raw, err := os.ReadFile(stable); err != nil || string(raw) != "binary" {
		t.Fatalf("npx binary not copied out: %v", err)
	}
	settings, _ := os.ReadFile(claudehooks.SettingsPath())
	if !strings.Contains(string(settings), claudehooks.CommandFor(stable)) {
		t.Fatalf("hooks do not run the stable binary:\n%s", settings)
	}
	plist, _ := os.ReadFile(m.service.Path())
	if !strings.Contains(string(plist), "<string>"+stable+"</string>") {
		t.Fatalf("service does not run the stable binary:\n%s", plist)
	}
	if len(*opened) != 1 || !strings.HasPrefix((*opened)[0], "http://127.0.0.1:") || !strings.Contains((*opened)[0], "/#k="+cfg.ScreenKey) || cfg.ScreenKey == "" {
		t.Fatalf("opened %v (key %q)", *opened, cfg.ScreenKey)
	}

	// A second run asks nothing, keeps the token and still has one service.
	if err := runSetup(strings.NewReader(""), &out, m); err != nil {
		t.Fatal(err)
	}
	again, _, _ := config.Load(config.Path())
	if again.Token != cfg.Token || again.OfficeName != cfg.OfficeName {
		t.Fatalf("config changed: %+v", again)
	}
	if entries, _ := os.ReadDir(filepath.Dir(m.service.Path())); len(entries) != 1 {
		t.Fatalf("LaunchAgents %v", entries)
	}
	if n := strings.Count(strings.Join(*calls, "\n"), "bootstrap"); n != 2 {
		t.Fatalf("bootstrap %d times: %v", n, *calls)
	}

	if err := runRemove(&out, m); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(m.service.Path()); !os.IsNotExist(err) {
		t.Fatal("service left behind")
	}
	if settings, _ := os.ReadFile(claudehooks.SettingsPath()); strings.Contains(string(settings), "kttn") {
		t.Fatalf("hooks left behind:\n%s", settings)
	}
}

func TestSetupUsesThePlainCommandWhenKttnIsOnThePath(t *testing.T) {
	m, _, _ := fakeMachine(t)
	m.exe = filepath.Join(t.TempDir(), "kttn")
	m.onPath = func() (string, bool) { return m.exe, true }
	var out bytes.Buffer
	if err := runSetup(strings.NewReader("Lab\n\n"), &out, m); err != nil {
		t.Fatal(err)
	}
	settings, _ := os.ReadFile(claudehooks.SettingsPath())
	if !strings.Contains(string(settings), `"command": "kttn hook"`) {
		t.Fatalf("settings:\n%s", settings)
	}
	if _, err := os.Stat(filepath.Join(m.home, ".local", "bin", "kttn")); err == nil {
		t.Fatal("copied a binary that was already stable")
	}
}

func TestAGlobalNpmInstallAlsoMovesToAStablePath(t *testing.T) {
	m, _, _ := fakeMachine(t)
	global := filepath.Join(t.TempDir(), "lib", "node_modules", "@hgwk", "kttn", "bin", "native", "kttn")
	os.MkdirAll(filepath.Dir(global), 0o755)
	os.WriteFile(global, []byte("binary"), 0o755)
	m.exe = global
	var out bytes.Buffer
	if err := runSetup(strings.NewReader("Lab\n\n"), &out, m); err != nil {
		t.Fatal(err)
	}
	stable := filepath.Join(m.home, ".local", "bin", "kttn")
	plist, _ := os.ReadFile(m.service.Path())
	settings, _ := os.ReadFile(claudehooks.SettingsPath())
	if !strings.Contains(string(plist), stable) || strings.Contains(string(plist), "node_modules") {
		t.Fatalf("service points into npm's tree:\n%s", plist)
	}
	if strings.Contains(string(settings), "node_modules") {
		t.Fatalf("hooks point into npm's tree:\n%s", settings)
	}
}

// The login service gets none of this shell's variables, so it must be told
// where setup found the config, XDG folders included.
func TestTheServiceIsPinnedToTheConfigAndStateSetupUsed(t *testing.T) {
	dir := t.TempDir()
	t.Setenv("KTTN_CONFIG", "")
	t.Setenv("KTTN_STATE", "")
	t.Setenv("XDG_CONFIG_HOME", filepath.Join(dir, "xc"))
	t.Setenv("XDG_STATE_HOME", filepath.Join(dir, "xs"))
	env := kttnEnv()
	if env["KTTN_CONFIG"] != filepath.Join(dir, "xc", "kttn", "config.json") || env["KTTN_STATE"] != filepath.Join(dir, "xs", "kttn", "sessions.json") {
		t.Fatalf("env %v", env)
	}
}
