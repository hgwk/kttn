package main

import (
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"

	"github.com/hgwk/kttn/internal/server"
)

// openPrivately opens a URL that carries the screen key without putting it
// on a command line, where any user of this computer could read it (ps on
// macOS, /proc on Linux). macOS gets it through osascript's stdin; Linux
// gets a redirect page only this user can read.
func openPrivately(url string) error {
	if runtime.GOOS == "darwin" {
		cmd := exec.Command("osascript", "-")
		cmd.Stdin = strings.NewReader("open location " + appleScriptText(url) + "\n")
		return cmd.Run()
	}
	page := filepath.Join(filepath.Dir(server.StatePath()), "open.html")
	if err := os.MkdirAll(filepath.Dir(page), 0o700); err != nil {
		return err
	}
	if err := writePrivate(page, redirectPage(url)); err != nil {
		return err
	}
	return exec.Command("xdg-open", page).Start()
}

// writePrivate writes a 0600 file, fixing the mode of one already there.
func writePrivate(path string, content []byte) error {
	if err := os.WriteFile(path, content, 0o600); err != nil {
		return err
	}
	return os.Chmod(path, 0o600)
}

func appleScriptText(text string) string {
	return `"` + strings.NewReplacer(`\`, `\\`, `"`, `\"`).Replace(text) + `"`
}

func redirectPage(url string) []byte {
	quoted := strings.NewReplacer(`\`, `\\`, `"`, `\"`, "<", `\x3c`).Replace(url)
	return []byte("<!doctype html><meta charset=\"utf-8\"><title>kttn</title>\n<script>location.replace(\"" + quoted + "\")</script>\n")
}
