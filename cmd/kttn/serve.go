package main

import (
	"context"
	"flag"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strconv"
	"syscall"
	"time"

	"github.com/hgwk/kttn/internal/config"
	"github.com/hgwk/kttn/internal/office"
	"github.com/hgwk/kttn/internal/server"
	"github.com/hgwk/kttn/internal/terminal"
)

func runServe(args []string, stderr io.Writer) error {
	cfg, found, err := config.Load(config.Path())
	if err != nil {
		return fmt.Errorf("reading %s: %w", config.Path(), err)
	}
	fs := flag.NewFlagSet("serve", flag.ContinueOnError)
	port := fs.Int("port", cfg.Port, "port on 127.0.0.1")
	if err := fs.Parse(args); err != nil {
		return err
	}
	if !found {
		fmt.Fprintln(stderr, "kttn: no config yet; run `kttn init` to name the office and pair the hook")
		// Without a config nothing is paired: keys only this process knows
		// keep the events, the sessions and the actions closed, and the
		// screen shows how to set up.
		if _, err := cfg.EnsureKeys(); err != nil {
			return err
		}
	} else if changed, err := cfg.EnsureKeys(); err != nil {
		return err
	} else if changed {
		// A config from before the screen key: add it once, keep the rest.
		if err := config.Save(config.Path(), cfg); err != nil {
			return err
		}
		fmt.Fprintln(stderr, "kttn: added a screen key to the config; open the office with `kttn open`")
	}
	handler := server.New(server.Options{
		Store:        office.NewStore(time.Now, office.NewClaudeCheck(nil)),
		Token:        cfg.Token,
		ScreenKey:    cfg.ScreenKey,
		StatePath:    server.StatePath(),
		EmbedOrigins: cfg.Embedders(),
		PropsPath:    filepath.Join(filepath.Dir(config.Path()), "props.json"),
		Focus:        func(pid int) error { return terminal.Focus(terminal.Exec, pid) },
		Send: func(pid int, state, text string) error {
			return terminal.Send(terminal.Exec, pid, state, text)
		},
		Settings: server.Settings{
			OfficeName: cfg.OfficeName,
			Lang:       cfg.Lang,
			Messages:   cfg.Messages,
			Configured: found,
		},
	})
	addr := net.JoinHostPort("127.0.0.1", strconv.Itoa(*port))
	fmt.Fprintf(stderr, "kttn: office at http://%s\n", addr)
	srv := &http.Server{Addr: addr, Handler: handler, ReadHeaderTimeout: 5 * time.Second}
	// launchd, systemd and Ctrl-C stop the office with a signal; the last
	// second of events is still waiting on the save timer then.
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGTERM, os.Interrupt)
	served := make(chan error, 1)
	go func() { served <- srv.ListenAndServe() }()
	select {
	case err := <-served:
		return err
	case <-stop:
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()
		_ = srv.Shutdown(ctx)
		handler.SaveNow()
		return nil
	}
}
