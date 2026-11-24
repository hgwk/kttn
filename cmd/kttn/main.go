// kttn shows the Claude Code sessions running on this computer as pixel cats
// in an office. `kttn init` sets it up, `kttn serve` runs the office and
// `kttn hook` is the Claude Code hook that reports each session to it.
package main

import (
	"fmt"
	"os"

	"github.com/hgwk/kttn/internal/config"
)

func usage() {
	fmt.Fprintf(os.Stderr, `usage:
  kttn init  [--yes] [--office-name NAME] [--lang ko|en|ja] [--port %d] [--preview]
  kttn serve [--port PORT]
  kttn hook  [--url URL] [--source claude] [--timeout 300ms]

config: %s (KTTN_CONFIG overrides)
env:    KTTN_URL, KTTN_TOKEN override the config for the hook; KTTN_STATE moves the session file
`, config.DefaultPort, config.Path())
}

func main() {
	if len(os.Args) < 2 {
		usage()
		os.Exit(2)
	}
	switch os.Args[1] {
	case "hook":
		runHook(os.Args[2:])
	case "serve":
		exitOn("serve", runServe(os.Args[2:]))
	case "init":
		exitOn("init", runInit(os.Args[2:], os.Stdin, os.Stdout))
	case "-h", "--help", "help":
		usage()
	default:
		usage()
		os.Exit(2)
	}
}

func exitOn(command string, err error) {
	if err != nil {
		fmt.Fprintf(os.Stderr, "kttn %s: %v\n", command, err)
		os.Exit(1)
	}
}
