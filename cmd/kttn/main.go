// kttn shows the Claude Code sessions running on this computer as pixel cats
// in an office. `kttn init` sets it up, `kttn serve` runs the office and
// `kttn hook` is the Claude Code hook that reports each session to it.
package main

import (
	"fmt"
	"io"
	"os"
)

func main() {
	os.Exit(run(os.Args[1:], os.Stdin, os.Stdout, os.Stderr))
}

// run dispatches a command and returns the exit code. `--help` on any command
// prints that command's help and does nothing else.
func run(args []string, stdin io.Reader, stdout, stderr io.Writer) int {
	if len(args) == 0 {
		args = []string{"setup"}
	}
	name, rest := args[0], args[1:]
	if wantsHelp([]string{name}) {
		usage(stdout)
		return 0
	}
	if help, ok := helps[name]; ok && wantsHelp(rest) {
		fmt.Fprintln(stdout, help)
		return 0
	}
	switch name {
	case "hook":
		runHook(rest, stdin)
		return 0
	case "serve":
		return report(stderr, name, runServe(rest, stderr))
	case "setup", "install", "uninstall", "open", "init":
		if len(rest) > 0 && name != "init" {
			return report(stderr, name, fmt.Errorf("unexpected argument %q", rest[0]))
		}
		if name == "install" {
			return report(stderr, name, runInstall(stdout))
		}
		m, err := newMachine()
		if err != nil {
			return report(stderr, name, err)
		}
		switch name {
		case "init":
			return report(stderr, name, runInit(rest, stdin, stdout, m.service))
		case "setup":
			return report(stderr, name, runSetup(stdin, stdout, m))
		case "open":
			return report(stderr, name, runOpen(stdout, m))
		}
		return report(stderr, name, runRemove(stdout, m))
	case "version", "--version":
		fmt.Fprintln(stdout, "kttn", version)
		return 0
	}
	usage(stderr)
	return 2
}

// newMachine reaches the real computer; tests replace it.
var newMachine = realMachine

func report(stderr io.Writer, command string, err error) int {
	if err != nil {
		fmt.Fprintf(stderr, "kttn %s: %v\n", command, err)
		return 1
	}
	return 0
}
