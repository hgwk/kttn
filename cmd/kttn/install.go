package main

import (
	"fmt"
	"io"
	"os"
	"os/exec"

	"github.com/hgwk/kttn/internal/claudehooks"
	"github.com/hgwk/kttn/internal/config"
)

// version is the release version; the release workflow checks it against the
// tag and package.json.
const version = "0.14.0"

// runInstall registers `kttn hook` in Claude Code's user settings, for people
// who do not use the plugin. Using both would report every event twice.
func runInstall(out io.Writer) error {
	path := claudehooks.SettingsPath()
	_, statErr := os.Stat(path)
	// The kttn the PATH finds now, by its full path, so a different kttn
	// earlier on some later PATH is never run instead.
	command := claudehooks.Command
	found, lookErr := exec.LookPath("kttn")
	if lookErr == nil {
		command = claudehooks.CommandFor(absPath(found))
	}
	n, err := claudehooks.InstallCommand(path, claudehooks.WithConfig(command, absPath(config.Path())))
	if err != nil {
		return err
	}
	fmt.Fprintf(out, "Added `kttn hook` to %d events in %s.\n", n, path)
	if statErr == nil {
		fmt.Fprintln(out, "The previous file is kept as settings.json.bak.")
	}
	if lookErr != nil {
		fmt.Fprintln(out, "Note: `kttn` is not on your PATH, so the hook will not run. Install with `npm i -g @hgwk/kttn` or put the binary on your PATH.")
	}
	fmt.Fprintln(out, "If you also installed the kttn plugin, remove one of the two.")
	return nil
}

func runUninstall(out io.Writer) error {
	path := claudehooks.SettingsPath()
	n, err := claudehooks.Uninstall(path)
	if err != nil {
		return err
	}
	fmt.Fprintf(out, "Removed `kttn hook` from %d events in %s.\n", n, path)
	return nil
}
