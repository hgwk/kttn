package main

import (
	"fmt"
	"io"

	"github.com/hgwk/kttn/internal/config"
)

// helps is what `kttn <command> --help` prints. Asking for help never runs
// the command.
var helps = map[string]string{
	"init": `kttn init [--yes] [--office-name NAME] [--lang ko|en|ja] [--port N] [--preview]
  Ask for the office settings and save them with a fresh token.
  --yes takes the flags and saved values without asking.`,
	"serve": `kttn serve [--port N]
  Run the office on 127.0.0.1 (default port from the config).`,
	"hook": `kttn hook [--url URL] [--source claude] [--timeout 300ms]
  The Claude Code hook. Reads one hook payload on stdin and reports it.`,
	"install": `kttn install
  Add the kttn hook to Claude Code's user settings (~/.claude/settings.json,
  or $CLAUDE_CONFIG_DIR/settings.json). Keeps every other setting and hook and
  saves the previous file as settings.json.bak. Use this or the plugin, not both.`,
	"uninstall": `kttn uninstall
  Remove the kttn hook from Claude Code's user settings, leaving the rest.`,
	"version": `kttn version
  Print the version.`,
}

var commandOrder = []string{"init", "serve", "hook", "install", "uninstall", "version"}

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
