package main

import (
	"fmt"
	"io"

	"github.com/hgwk/kttn/internal/config"
)

// helps is what `kttn <command> --help` prints. Asking for help never runs
// the command.
var helps = map[string]string{
	"setup": `kttn setup   (or just: kttn)
  Set up everything in one go: ask for the kttn name and language (first run
  only), hook Claude Code, start kttn serve at login and open kttn.
  Running it again keeps the settings and refreshes the hooks and the service.`,
	"init": `kttn init [--yes] [--office-name NAME] [--lang ko|en|ja] [--port N] [--preview] [--messages]
  Ask for the kttn settings and save them with a fresh token.
  --yes takes the flags and saved values without asking.`,
	"serve": `kttn serve [--port N]
  Run kttn on 127.0.0.1 (default port from the config).`,
	"hook": `kttn hook [--config FILE] [--url URL] [--source claude] [--timeout 300ms]
  The Claude Code hook. Reads one hook payload on stdin and reports it.
  Setup pins --config to the config it wrote.`,
	"install": `kttn install
  Add the kttn hook to Claude Code's user settings (~/.claude/settings.json,
  or $CLAUDE_CONFIG_DIR/settings.json). Keeps every other setting and hook and
  saves the previous file as settings.json.bak. Use this or the plugin, not both.`,
	"uninstall": `kttn uninstall
  Remove the kttn hook from Claude Code's user settings, leaving the rest, and
  stop starting kttn serve at login. The config and session state stay.`,
	"open": `kttn open
  Open kttn in the browser with your screen key. The key is what lets a
  browser see your sessions and act on them; it lives only in your config.`,
	"version": `kttn version
  Print the version.`,
}

var commandOrder = []string{"setup", "init", "serve", "hook", "install", "uninstall", "open", "version"}

func usage(w io.Writer) {
	fmt.Fprintln(w, "usage:")
	for _, name := range commandOrder {
		fmt.Fprintln(w, "  "+helps[name])
	}
	fmt.Fprintf(w, `
config: %s (KTTN_CONFIG overrides)
env:    KTTN_URL, KTTN_TOKEN override the config for the hook; KTTN_STATE moves the session file
`, config.Path())
}

// wantsHelp reports whether any argument asks for help.
func wantsHelp(args []string) bool {
	for _, arg := range args {
		if arg == "-h" || arg == "--help" || arg == "-help" || arg == "help" {
			return true
		}
	}
	return false
}
