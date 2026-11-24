package server

import (
	"os"
	"path/filepath"
	"sync"
	"testing"
	"time"

	"github.com/hgwk/kttn/internal/office"
)

// A clear racing the timer's save must leave the catalog empty on disk, and
// no save may fail on the other's temp file.
func TestAClearRacingASaveLeavesTheCatalogEmpty(t *testing.T) {
	for round := 0; round < 50; round++ {
		path := filepath.Join(t.TempDir(), "cats.json")
		b := newCatBook(path, time.Now)
		b.record(office.Agent{Key: "claude|a", Source: "claude"}, 1)
		var wg sync.WaitGroup
		errs := make(chan error, 8)
		for i := 0; i < 4; i++ {
			wg.Add(1)
			go func() { defer wg.Done(); errs <- b.save() }()
		}
		if err := b.clear(); err != nil {
			t.Fatal(err)
		}
		wg.Wait()
		close(errs)
		for err := range errs {
			if err != nil {
				t.Fatalf("round %d: %v", round, err)
			}
		}
		if raw, _ := os.ReadFile(path); string(raw) != `{"cats":[]}` {
			t.Fatalf("round %d: %s", round, raw)
		}
	}
}
