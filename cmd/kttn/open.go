package main

import (
	"errors"
	"fmt"
	"io"
	"strconv"

	"github.com/hgwk/kttn/internal/config"
)

// runOpen opens kttn in the browser with this user's screen key, the
// only way a browser gets it.
func runOpen(out io.Writer, m machine) error {
	path := config.Path()
	cfg, found, err := config.Load(path)
	if err != nil {
		return fmt.Errorf("reading %s: %w", path, err)
	}
	if !found || cfg.ScreenKey == "" {
		return errors.New("no screen key yet; run `kttn` (or `kttn init`) first")
	}
	m.open(cfg.URL())
	fmt.Fprintf(out, "Opened http://127.0.0.1:%s/ with your screen key.\n", strconv.Itoa(cfg.Port))
	return nil
}
