package main

import (
	"bufio"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"time"

	"github.com/hgwk/kttn/internal/autostart"
	"github.com/hgwk/kttn/internal/claudehooks"
	"github.com/hgwk/kttn/internal/config"
	"github.com/hgwk/kttn/internal/server"
	"github.com/hgwk/kttn/internal/terminal"
)

// machine is what setup touches outside kttn's own files. Tests replace it
// so they never reach the real LaunchAgents, systemd or browser.
type machine struct {
	exe     string // the running kttn binary
	home    string
	service autostart.Service
	onPath  func() (string, bool) // where `kttn` is on the PATH, links not followed
	open    func(url string)
	ready   func(url string) bool
}

func realMachine() (machine, error) {
	exe, err := os.Executable()
	if err != nil {
		return machine{}, err
	}
	if resolved, err := filepath.EvalSymlinks(exe); err == nil {
		exe = resolved
	}
	home, err := os.UserHomeDir()
	if err != nil {
		return machine{}, err
	}
	return machine{
		exe:  exe,
		home: home,
		service: autostart.Service{
			GOOS: runtime.GOOS, Home: home, UID: os.Getuid(),
			Run:      autostart.Run(terminal.Exec),
			PathDirs: toolDirs("tmux"),
			Env:      kttnEnv(),
		},
		onPath: func() (string, bool) {
			found, err := exec.LookPath("kttn")
			if err != nil {
				return "", false
			}
			abs, err := filepath.Abs(found)
			return abs, err == nil
		},
		open: func(url string) { _ = openPrivately(url) },
		ready: func(url string) bool {
			client := http.Client{Timeout: 300 * time.Millisecond}
			resp, err := client.Get(url + "api/snapshot")
			if err != nil {
				return false
			}
			resp.Body.Close()
			// The snapshot needs the screen key; a 401 still means it is up.
			return resp.StatusCode == http.StatusOK || resp.StatusCode == http.StatusUnauthorized
		},
	}, nil
}

// toolDirs is where this shell finds the tools, so the login service finds
// the same ones.
func toolDirs(tools ...string) []string {
	var dirs []string
	for _, tool := range tools {
		if found, err := exec.LookPath(tool); err == nil {
			if abs, err := filepath.Abs(found); err == nil {
				dirs = append(dirs, filepath.Dir(abs))
			}
		}
	}
	return dirs
}

func sameFile(a, b string) bool {
	if ra, err := filepath.EvalSymlinks(a); err == nil {
		a = ra
	}
	if rb, err := filepath.EvalSymlinks(b); err == nil {
		b = rb
	}
	return a == b
}

// absPath makes a config or state path absolute, for a hook or service that
// runs from another folder.
func absPath(path string) string {
	if abs, err := filepath.Abs(path); err == nil {
		return abs
	}
	return path
}

// kttnEnv pins the service to the config and state files setup used. The
// login service does not get this shell's KTTN_* or XDG_* variables, and
// without them it would look in ~/.config, find no config and refuse every
// event.
func kttnEnv() map[string]string {
	env := map[string]string{}
	for name, path := range map[string]string{"KTTN_CONFIG": config.Path(), "KTTN_STATE": server.StatePath()} {
		if abs, err := filepath.Abs(path); err == nil && path != "" {
			env[name] = abs
		}
	}
	return env
}

// runSetup is `kttn` with no arguments: set up kttn, hook Claude Code,
// start kttn at login and open it. Running it again keeps the saved
// settings and replaces the hooks and the login service with fresh ones.
func runSetup(in io.Reader, out io.Writer, m machine) error {
	path := config.Path()
	cfg, found, err := config.Load(path)
	if err != nil {
		return fmt.Errorf("reading %s: %w", path, err)
	}
	if !found {
		ask := prompter{in: bufio.NewReader(in), out: out}
		cfg.OfficeName = ask.text("kttn name (kttn 이름 / kttn の名前)", cfg.OfficeName)
		cfg.Lang = strings.ToLower(ask.text("Screen language ko/en/ja (blank: follow the browser)", ""))
		if cfg.Lang != "" && cfg.Lang != "ko" && cfg.Lang != "en" && cfg.Lang != "ja" {
			return fmt.Errorf("language %q is not ko, en or ja", cfg.Lang)
		}
		askMessages(&ask, &cfg)
		// The key is new, so no kttn already running can answer to it.
		if _, err = cfg.EnsureKeys(); err != nil {
			return err
		}
		if cfg.Port = config.PickPort(cfg.Port, cfg.ScreenKey); cfg.Port == 0 {
			return fmt.Errorf("no free port from %d upward", config.DefaultPort)
		}
		if err := config.Save(path, cfg); err != nil {
			return err
		}
		fmt.Fprintf(out, "Saved %s (answer preview off; `kttn init` changes it).\n", path)
	} else if err := refreshConfig(path, &cfg, out); err != nil {
		return err
	}

	exe, err := stableBinary(m)
	if err != nil {
		return err
	}
	// The hook runs this binary by its full path: a bare `kttn` would run
	// whichever kttn comes first on the PATH, maybe one too old for the
	// --config flag. When this binary is what the PATH finds, the PATH's own
	// entry (say a Homebrew link) is used, so an upgrade carries the hook.
	command := claudehooks.CommandFor(exe)
	if found, ok := m.onPath(); ok && sameFile(found, exe) {
		command = claudehooks.CommandFor(found)
	}
	command = claudehooks.WithConfig(command, absPath(path))
	settings := claudehooks.SettingsPath()
	if _, err := claudehooks.InstallCommand(settings, command); err != nil {
		return err
	}
	fmt.Fprintf(out, "Hooked Claude Code in %s.\n", settings)
	if claudehooks.PluginEnabled(settings) {
		fmt.Fprintln(out, "Note: the kttn plugin is enabled too, so every event would be reported twice; disable one of them (/plugin).")
	}

	if err := m.service.Register(exe); err != nil {
		return err
	}
	fmt.Fprintf(out, "kttn serve now starts at login (%s).\n", m.service.Path())

	url := "http://127.0.0.1:" + strconv.Itoa(cfg.Port) + "/"
	for tries := 0; tries < 25 && !m.ready(url); tries++ {
		time.Sleep(200 * time.Millisecond)
	}
	m.open(cfg.OfficeURL())
	fmt.Fprintf(out, "kttn is open at %s (`kttn open` opens it again). Sessions show up from their next prompt.\n", url)
	return nil
}

// refreshConfig brings a saved config up to date on a rerun: it adds a
// missing key, and moves off a port something else took meanwhile
// (kttn's own server still running there is fine).
func refreshConfig(path string, cfg *config.Config, out io.Writer) error {
	changed, err := cfg.EnsureKeys()
	if err != nil {
		return err
	}
	if port := config.PickPort(cfg.Port, cfg.ScreenKey); port != 0 && port != cfg.Port {
		fmt.Fprintf(out, "Port %d is taken by something else; using %d.\n", cfg.Port, port)
		cfg.Port, changed = port, true
	}
	if !changed {
		return nil
	}
	return config.Save(path, *cfg)
}

// stableBinary returns a path that outlives this run and npm. A binary
// run from npm's tree (the npx cache, or node_modules of a global install)
// is replaced or deleted by npm on update, cache cleanup or uninstall, and
// the hooks and the login service would then point at nothing; so that copy
// moves to ~/.local/bin/kttn first.
func stableBinary(m machine) (string, error) {
	path := filepath.ToSlash(m.exe)
	if !strings.Contains(path, "/_npx/") && !strings.Contains(path, "/node_modules/") {
		return m.exe, nil
	}
	target := filepath.Join(m.home, ".local", "bin", "kttn")
	raw, err := os.ReadFile(m.exe)
	if err != nil {
		return "", err
	}
	if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
		return "", err
	}
	temp := target + ".tmp"
	if err := os.WriteFile(temp, raw, 0o755); err != nil {
		return "", err
	}
	return target, os.Rename(temp, target)
}

// runRemove is `kttn uninstall`: take the hooks out and stop starting at
// login. The config, the session state and the binary stay.
func runRemove(out io.Writer, m machine) error {
	if err := runUninstall(out); err != nil {
		return err
	}
	removed, err := m.service.Remove()
	if err != nil && err != autostart.ErrUnsupported {
		return err
	}
	if removed {
		fmt.Fprintf(out, "kttn no longer starts at login (removed %s).\n", m.service.Path())
	}
	return nil
}
