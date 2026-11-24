package main

import (
	"flag"
	"fmt"
	"net"
	"net/http"
	"os"
	"strconv"
	"time"

	"github.com/hgwk/kttn/internal/config"
	"github.com/hgwk/kttn/internal/office"
	"github.com/hgwk/kttn/internal/server"
	"github.com/hgwk/kttn/internal/terminal"
)

func runServe(args []string) error {
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
		fmt.Fprintln(os.Stderr, "kttn: no config yet; run `kttn init` to name the office and pair the hook")
	}
	handler := server.New(server.Options{
		Store:     office.NewStore(time.Now, office.ProcessAlive),
		Token:     cfg.Token,
		StatePath: server.StatePath(),
		Focus:     func(pid int) error { return terminal.Focus(terminal.Exec, pid) },
		Send: func(pid int, state, text string) error {
			return terminal.Send(terminal.Exec, pid, state, text)
		},
		Settings: server.Settings{
			OfficeName: cfg.OfficeName,
			HomeRepo:   cfg.HomeRepo,
			Lang:       cfg.Lang,
			Configured: found,
		},
	})
	addr := net.JoinHostPort("127.0.0.1", strconv.Itoa(*port))
	fmt.Fprintf(os.Stderr, "kttn: office at http://%s\n", addr)
	srv := &http.Server{Addr: addr, Handler: handler, ReadHeaderTimeout: 5 * time.Second}
	return srv.ListenAndServe()
}
