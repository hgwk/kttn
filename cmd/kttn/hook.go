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
	cfg, _, _ := config.Load(config.Path())
	endpoint := cfg.EventsURL()
	if env := os.Getenv("KTTN_URL"); env != "" {
		endpoint = env
	}
	token := cfg.Token
	if env := strings.TrimSpace(os.Getenv("KTTN_TOKEN")); env != "" {
		token = env
	}
	fs := flag.NewFlagSet("hook", flag.ContinueOnError)
	fs.SetOutput(os.Stderr)
	url := fs.String("url", endpoint, "event endpoint of kttn serve")
	source := fs.String("source", "claude", "agent family shown in the office")
	timeout := fs.Duration("timeout", 300*time.Millisecond, "give up after this long")
	if err := fs.Parse(args); err != nil {
		return
	}
	hook.Run(stdin, hook.Options{
		Endpoint: *url,
		Source:   *source,
		Token:    token,
		Timeout:  *timeout,
		Preview:  cfg.Preview,
	})
}
