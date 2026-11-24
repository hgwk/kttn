package main

import (
	"bufio"
	"errors"
	"flag"
	"fmt"
	"io"
	"os"
	"strconv"
	"strings"

	"github.com/hgwk/kttn/internal/autostart"
	"github.com/hgwk/kttn/internal/config"
)

// runInit asks for the onboarding values, keeping what an earlier init saved
// as the defaults, picks a free port and writes the config with a token the
// hook and server share, then restarts the login service if there is one.
// --yes takes the defaults and flags without asking.
func runInit(args []string, in io.Reader, out io.Writer, service autostart.Service) error {
	path := config.Path()
	cfg, found, err := config.Load(path)
	if err != nil {
		return fmt.Errorf("reading %s: %w", path, err)
	}
	fs := flag.NewFlagSet("init", flag.ContinueOnError)
	yes := fs.Bool("yes", false, "do not ask; use flags and saved values")
	name := fs.String("office-name", cfg.OfficeName, "building and home office name")
	lang := fs.String("lang", cfg.Lang, "screen language: ko, en or ja (empty follows the browser)")
	port := fs.Int("port", cfg.Port, "port for kttn serve")
	preview := fs.Bool("preview", cfg.Preview, "show the opening of each finished answer")
	messages := fs.Bool("messages", cfg.Messages, "let the screen type into a session from its speech bubble")
	if err := fs.Parse(args); err != nil {
		return err
	}
	cfg.OfficeName, cfg.Lang, cfg.Port, cfg.Preview, cfg.Messages = *name, *lang, *port, *preview, *messages

	if !*yes {
		ask := prompter{in: bufio.NewReader(in), out: out}
		cfg.OfficeName = ask.text("Office name (사무실 이름)", cfg.OfficeName)
		cfg.Lang = ask.text("Screen language ko/en/ja (blank: follow the browser)", cfg.Lang)
		cfg.Port = ask.number("Port", cfg.Port)
		fmt.Fprintln(out, "Answer preview sends the first 300 characters of each finished answer to the")
		fmt.Fprintln(out, "office screen on this computer. Prompts and file contents are never sent.")
		cfg.Preview = ask.yesNo("Show answer previews?", cfg.Preview)
		askMessages(&ask, &cfg)
	}
	if cfg.Lang != "" && cfg.Lang != "ko" && cfg.Lang != "en" && cfg.Lang != "ja" {
		return fmt.Errorf("language %q is not ko, en or ja", cfg.Lang)
	}
	if _, err := cfg.EnsureKeys(); err != nil {
		return err
	}
	picked := config.PickPort(cfg.Port, cfg.ScreenKey)
	if picked == 0 {
		return fmt.Errorf("no free port from %d upward", cfg.Port)
	}
	if picked != cfg.Port {
		fmt.Fprintf(out, "Port %d is taken; using %d.\n", cfg.Port, picked)
		cfg.Port = picked
	}
	if err := config.Save(path, cfg); err != nil {
		return err
	}
	fmt.Fprintf(out, "Saved %s\n", path)
	// The running office read the old config at start; restart it so the
	// new port, token and message setting apply now.
	restarted, err := service.Restart()
	if err != nil {
		fmt.Fprintf(out, "Could not restart the office (%v); run `kttn` to apply the changes.\n", err)
	} else if restarted {
		fmt.Fprintln(out, "Restarted the office with the new settings.")
		// The service is pinned to the config setup wrote; one written
		// elsewhere (another XDG_CONFIG_HOME or KTTN_CONFIG) is not read.
		if raw, err := os.ReadFile(service.Path()); err == nil && !strings.Contains(string(raw), absPath(path)) {
			fmt.Fprintf(out, "The office at login reads another config than %s; run `kttn` to move it and the hooks here.\n", path)
		}
	} else if found {
		fmt.Fprintln(out, "Restart `kttn serve` to apply the changes.")
	} else {
		fmt.Fprintf(out, "Next: run `kttn serve` and open http://127.0.0.1:%d\n", cfg.Port)
	}
	return nil
}

type prompter struct {
	in  *bufio.Reader
	out io.Writer
}

// line asks once; an empty answer or end of input keeps the default.
func (p prompter) line(question, shown string) string {
	if shown != "" {
		fmt.Fprintf(p.out, "%s [%s]: ", question, shown)
	} else {
		fmt.Fprintf(p.out, "%s: ", question)
	}
	answer, err := p.in.ReadString('\n')
	if err != nil && !errors.Is(err, io.EOF) {
		return ""
	}
	return strings.TrimSpace(answer)
}

func (p prompter) text(question, current string) string {
	if answer := p.line(question, current); answer != "" {
		return answer
	}
	return current
}

func (p prompter) number(question string, current int) int {
	for tries := 0; tries < 3; tries++ {
		answer := p.line(question, strconv.Itoa(current))
		if answer == "" {
			return current
		}
		if n, err := strconv.Atoi(answer); err == nil && n > 0 && n <= 65535 {
			return n
		}
		fmt.Fprintln(p.out, "Enter a port number from 1 to 65535.")
	}
	return current
}

func (p prompter) yesNo(question string, current bool) bool {
	shown := "y/N"
	if current {
		shown = "Y/n"
	}
	switch strings.ToLower(p.line(question, shown)) {
	case "y", "yes":
		return true
	case "n", "no":
		return false
	}
	return current
}

// askMessages explains and asks for typing from the screen; off by default.
func askMessages(ask *prompter, cfg *config.Config) {
	fmt.Fprintln(ask.out, "Messages let you click a cat's speech bubble and type into that session's")
	fmt.Fprintln(ask.out, "input; Enter is pressed for you. Off by default.")
	cfg.Messages = ask.yesNo("Allow messages from the screen?", cfg.Messages)
}
