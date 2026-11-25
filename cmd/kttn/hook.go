package main

import (
	"flag"
	"io"
	"os"
	"strings"
	"time"

	"github.com/hgwk/kttn/internal/config"
	"github.com/hgwk/kttn/internal/hook"
)

// runHook never fails: a broken flag or config just drops the signal, since a
// hook must not break the session.
func runHook(args []string, stdin io.Reader) {
	fs := flag.NewFlagSet("hook", flag.ContinueOnError)
	fs.SetOutput(os.Stderr)
	configPath := fs.String("config", "", "config file (setup pins it; default: the usual place)")
	url := fs.String("url", "", "event endpoint of kttn serve (default: from the config)")
	source := fs.String("source", "claude", "agent family shown in kttn")
	timeout := fs.Duration("timeout", 300*time.Millisecond, "give up after this long")
	if err := fs.Parse(args); err != nil {
		return
	}
	if *configPath == "" {
		*configPath = config.Path()
	}
	cfg, _, _ := config.Load(*configPath)
	endpoint := cfg.EventsURL()
	if env := os.Getenv("KTTN_URL"); env != "" {
		endpoint = env
	}
	if *url != "" {
		endpoint = *url
	}
	token := cfg.Token
	if env := strings.TrimSpace(os.Getenv("KTTN_TOKEN")); env != "" {
		token = env
	}
	hook.Run(stdin, hook.Options{
		Endpoint: endpoint,
		Source:   *source,
		Token:    token,
		Timeout:  *timeout,
		Preview:  cfg.Preview,
	})
}
