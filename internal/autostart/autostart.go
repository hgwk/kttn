// Package autostart starts `kttn serve` at login: a LaunchAgent on macOS, a
// systemd user unit on Linux. Registering again replaces the earlier entry
// and restarts it, so running setup twice leaves one service.
package autostart

import (
	"bytes"
	"encoding/xml"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"
)

// Label names the LaunchAgent; the systemd unit is kttn.service.
const Label = "io.github.hgwk.kttn"

// Run executes a program with arguments (no shell). Tests swap it.
type Run func(name string, args ...string) (string, error)

// Service describes where this computer keeps login services.
type Service struct {
	GOOS string
	Home string
	UID  int
	Run  Run
	// PathDirs go in front of ServicePath, for tools found elsewhere (a
	// tmux from MacPorts, nix or ~/.local/bin).
	PathDirs []string
	// Env is more environment for the service, such as a KTTN_CONFIG that
	// setup ran with, so the service reads the same config.
	Env map[string]string
}

// environment is PATH first, then Env by name.
func (s Service) environment() [][2]string {
	path := ServicePath
	for i := len(s.PathDirs) - 1; i >= 0; i-- {
		dir := s.PathDirs[i]
		if dir != "" && !strings.Contains(":"+path+":", ":"+dir+":") {
			path = dir + ":" + path
		}
	}
	env := [][2]string{{"PATH", path}}
	names := make([]string, 0, len(s.Env))
	for name := range s.Env {
		if name != "PATH" {
			names = append(names, name)
		}
	}
	sort.Strings(names)
	for _, name := range names {
		env = append(env, [2]string{name, s.Env[name]})
	}
	return env
}

// ServicePath is the PATH the login service runs with. launchd's default
// (/usr/bin:/bin:/usr/sbin:/sbin) has no Homebrew, so tmux would never be
// found and its sessions could not be focused or messaged.
const ServicePath = "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

// bootstrapTries and bootstrapWait cover launchd still tearing down the old
// agent right after bootout, when bootstrap fails with an I/O error.
var (
	bootstrapTries = 6
	bootstrapWait  = 500 * time.Millisecond
)

// ErrUnsupported means kttn cannot start at login on this system.
var ErrUnsupported = errors.New("starting at login is supported on macOS and Linux only")

// Path is the file Register writes.
func (s Service) Path() string {
	if s.GOOS == "darwin" {
		return filepath.Join(s.Home, "Library", "LaunchAgents", Label+".plist")
	}
	return filepath.Join(s.Home, ".config", "systemd", "user", "kttn.service")
}

// LogPath is where the service writes its output.
func (s Service) LogPath() string {
	return filepath.Join(s.Home, ".local", "state", "kttn", "serve.log")
}

// Register writes the service for `<exe> serve` and (re)starts it.
func (s Service) Register(exe string) error {
	switch s.GOOS {
	case "darwin":
		if err := s.write(s.plist(exe)); err != nil {
			return err
		}
		domain := "gui/" + strconv.Itoa(s.UID)
		// A loaded agent must be booted out before bootstrap takes the new file.
		_, _ = s.Run("launchctl", "bootout", domain+"/"+Label)
		var err error
		for try := 0; try < bootstrapTries; try++ {
			if try > 0 {
				time.Sleep(bootstrapWait)
			}
			if _, err = s.Run("launchctl", "bootstrap", domain, s.Path()); err == nil {
				return nil
			}
		}
		return fmt.Errorf("launchctl bootstrap: %w", err)
	case "linux":
		if err := s.write(s.unit(exe)); err != nil {
			return err
		}
		if _, err := s.Run("systemctl", "--user", "daemon-reload"); err != nil {
			return fmt.Errorf("systemctl daemon-reload: %w", err)
		}
		if _, err := s.Run("systemctl", "--user", "enable", "kttn.service"); err != nil {
			return fmt.Errorf("systemctl enable: %w", err)
		}
		if _, err := s.Run("systemctl", "--user", "restart", "kttn.service"); err != nil {
			return fmt.Errorf("systemctl restart: %w", err)
		}
		return nil
	}
	return ErrUnsupported
}

// Restart restarts a registered service so it reads the config again. It
// reports whether there was one.
func (s Service) Restart() (bool, error) {
	if _, err := os.Stat(s.Path()); err != nil {
		return false, nil
	}
	var err error
	if s.GOOS == "darwin" {
		_, err = s.Run("launchctl", "kickstart", "-k", "gui/"+strconv.Itoa(s.UID)+"/"+Label)
	} else {
		_, err = s.Run("systemctl", "--user", "restart", "kttn.service")
	}
	return err == nil, err
}

// Remove stops the service and deletes its file. It reports whether there
// was one.
func (s Service) Remove() (bool, error) {
	if s.GOOS != "darwin" && s.GOOS != "linux" {
		return false, ErrUnsupported
	}
	// Stop the service even when its file is already gone: a loaded agent
	// keeps running without it.
	if s.GOOS == "darwin" {
		_, _ = s.Run("launchctl", "bootout", "gui/"+strconv.Itoa(s.UID)+"/"+Label)
	} else {
		_, _ = s.Run("systemctl", "--user", "disable", "--now", "kttn.service")
	}
	if _, err := os.Stat(s.Path()); errors.Is(err, os.ErrNotExist) {
		return false, nil
	}
	if err := os.Remove(s.Path()); err != nil {
		return true, err
	}
	if s.GOOS == "linux" {
		_, _ = s.Run("systemctl", "--user", "daemon-reload")
	}
	return true, nil
}

func (s Service) write(content []byte) error {
	if err := os.MkdirAll(filepath.Dir(s.Path()), 0o755); err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(s.LogPath()), 0o700); err != nil {
		return err
	}
	return os.WriteFile(s.Path(), content, 0o644)
}

func xmlText(text string) string {
	var buf bytes.Buffer
	_ = xml.EscapeText(&buf, []byte(text))
	return buf.String()
}

func (s Service) plistEnv() string {
	var out strings.Builder
	for _, kv := range s.environment() {
		out.WriteString("\t\t<key>" + xmlText(kv[0]) + "</key>\n\t\t<string>" + xmlText(kv[1]) + "</string>\n")
	}
	return out.String()
}

func (s Service) plist(exe string) []byte {
	return []byte(`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>Label</key>
	<string>` + Label + `</string>
	<key>ProgramArguments</key>
	<array>
		<string>` + xmlText(exe) + `</string>
		<string>serve</string>
	</array>
	<key>RunAtLoad</key>
	<true/>
	<key>KeepAlive</key>
	<true/>
	<key>EnvironmentVariables</key>
	<dict>
` + s.plistEnv() + `	</dict>
	<key>StandardOutPath</key>
	<string>` + xmlText(s.LogPath()) + `</string>
	<key>StandardErrorPath</key>
	<string>` + xmlText(s.LogPath()) + `</string>
</dict>
</plist>
`)
}

// systemdQuote quotes one ExecStart word.
func systemdQuote(word string) string {
	return `"` + strings.NewReplacer(`\`, `\\`, `"`, `\"`, "%", "%%").Replace(word) + `"`
}

func (s Service) unitEnv() string {
	var out strings.Builder
	for _, kv := range s.environment() {
		out.WriteString("Environment=" + systemdQuote(kv[0]+"="+kv[1]) + "\n")
	}
	return out.String()
}

func (s Service) unit(exe string) []byte {
	return []byte(`[Unit]
Description=kttn office for Claude Code sessions

[Service]
` + s.unitEnv() + `ExecStart=` + systemdQuote(exe) + ` serve
Restart=always
StandardOutput=append:` + s.LogPath() + `
StandardError=append:` + s.LogPath() + `

[Install]
WantedBy=default.target
`)
}
