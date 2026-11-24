package server

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sort"
	"sync"
	"time"

	"github.com/hgwk/kttn/internal/office"
)

const (
	// maxCats and catKeep bound the catalog: it is a log of which projects
	// were worked on and when, so it keeps the latest 1000 cats seen within
	// 90 days and nothing older.
	maxCats  = 1000
	catKeep  = 90 * 24 * time.Hour
	timeForm = "2006-01-02T15:04:05.000Z"
)

// cat is one session as the catalog remembers it after it has gone home.
type cat struct {
	Key         string `json:"key"`
	Source      string `json:"source"`
	Project     string `json:"project"`
	Folder      string `json:"folder"`
	Model       string `json:"model"`
	SessionName string `json:"session_name"`
	// CatName is the name the screen gave the cat. The screen's automatic
	// name only fills an empty one; a person's rename replaces it.
	CatName   string `json:"cat_name"`
	FirstSeen string `json:"first_seen"`
	LastSeen  string `json:"last_seen"`
	Tools     int    `json:"tools"`
	// NightOwl is set once the cat was seen at work between midnight and
	// 05:00 on this computer's clock, and stays set.
	NightOwl bool `json:"night_owl"`
}

// peak is the most cats at work at once, and when that was first reached.
type peak struct {
	Count int    `json:"count"`
	At    string `json:"at"`
}

// catalog is the catalog file and the GET /api/cats answer.
type catalog struct {
	Cats []cat `json:"cats"`
	Peak *peak `json:"peak,omitempty"`
}

// resting states are not work: night_owl counts only the others.
var resting = map[string]bool{"idle": true, "done": true, "ended": true}

// catBook is the catalog file: every session the office has seen, kept even
// while no screen is open. Writes are gathered like the session state's.
type catBook struct {
	path  string
	now   func() time.Time
	mu    sync.Mutex
	cats  map[string]*cat
	peak  *peak
	timer *time.Timer
	// saving lets one save run at a time: the timer's save and clear's
	// share one temp file, and an older list written last would bring a
	// cleared catalog back.
	saving sync.Mutex
}

func newCatBook(path string, now func() time.Time) *catBook {
	b := &catBook{path: path, now: now, cats: map[string]*cat{}}
	var saved catalog
	if raw, err := os.ReadFile(path); err == nil && json.Unmarshal(raw, &saved) == nil {
		for i := range saved.Cats {
			if c := saved.Cats[i]; c.Key != "" {
				b.cats[c.Key] = &c
			}
		}
		if saved.Peak != nil && saved.Peak.Count > 0 {
			b.peak = saved.Peak
		}
	}
	b.prune()
	return b
}

// record notes a session after an event, and live is how many sessions are
// at the office right now. Headless runs are skipped: they leave as soon as
// they end and would crowd everything else out.
func (b *catBook) record(a office.Agent, live int) {
	if a.Headless || a.Key == "" {
		return
	}
	clock := b.now()
	now := clock.UTC().Format(timeForm)
	b.mu.Lock()
	c, ok := b.cats[a.Key]
	if !ok {
		c = &cat{Key: a.Key, FirstSeen: now}
		b.cats[a.Key] = c
	}
	c.Source, c.Project, c.Folder, c.LastSeen = a.Source, a.Project, a.Folder, now
	if a.Model != "" {
		c.Model = a.Model
	}
	if a.Name != "" {
		c.SessionName = a.Name
	}
	c.Tools = max(c.Tools, a.ToolCount)
	if clock.Hour() < 5 && !resting[a.State] {
		c.NightOwl = true
	}
	b.expirePeakLocked()
	if b.peak == nil || live > b.peak.Count {
		b.peak = &peak{Count: live, At: now}
	}
	b.mu.Unlock()
	b.schedule()
}

// read is the whole catalog: the cats, the first seen first, and the peak.
func (b *catBook) read() catalog {
	cats := b.list()
	b.mu.Lock()
	var top *peak
	if b.peak != nil && b.peak.Count > 0 {
		p := *b.peak
		top = &p
	}
	b.mu.Unlock()
	return catalog{Cats: cats, Peak: top}
}

// list is every kept cat, the first seen first.
func (b *catBook) list() []cat {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.pruneLocked()
	out := make([]cat, 0, len(b.cats))
	for _, c := range b.cats {
		out = append(out, *c)
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].FirstSeen != out[j].FirstSeen {
			return out[i].FirstSeen < out[j].FirstSeen
		}
		return out[i].Key < out[j].Key
	})
	return out
}

// name names a known cat. Without replace it only fills an empty name: the
// screen sends the name it picked for whichever cats are on screen, and that
// pick must not rename a cat that already has one. A person's rename passes
// replace, and the last one wins.
func (b *catBook) name(key, name string, replace bool) (cat, bool) {
	b.mu.Lock()
	c, ok := b.cats[key]
	if ok && (replace || c.CatName == "") {
		c.CatName = name
	}
	var out cat
	if ok {
		out = *c
	}
	b.mu.Unlock()
	if ok {
		b.schedule()
	}
	return out, ok
}

// clear forgets every cat and the peak, and writes the empty catalog at once.
func (b *catBook) clear() error {
	b.mu.Lock()
	b.cats = map[string]*cat{}
	b.peak = nil
	b.mu.Unlock()
	return b.save()
}

func (b *catBook) prune() {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.pruneLocked()
}

// pruneLocked drops cats unseen for catKeep, then the least recently seen
// beyond maxCats. A peak older than catKeep goes too: the catalog keeps
// nothing older.
func (b *catBook) pruneLocked() {
	cutoff := b.now().Add(-catKeep).UTC().Format(timeForm)
	b.expirePeakLocked()
	var kept []*cat
	for key, c := range b.cats {
		if c.LastSeen < cutoff {
			delete(b.cats, key)
		} else {
			kept = append(kept, c)
		}
	}
	if len(kept) <= maxCats {
		return
	}
	sort.Slice(kept, func(i, j int) bool { return kept[i].LastSeen > kept[j].LastSeen })
	for _, c := range kept[maxCats:] {
		delete(b.cats, c.Key)
	}
}

// expirePeakLocked drops a peak older than catKeep, so a newer, lower one
// can take its place.
func (b *catBook) expirePeakLocked() {
	if b.peak != nil && b.peak.At < b.now().Add(-catKeep).UTC().Format(timeForm) {
		b.peak = nil
	}
}

func (b *catBook) schedule() {
	b.mu.Lock()
	defer b.mu.Unlock()
	if b.timer == nil {
		b.timer = time.AfterFunc(saveDelay, func() { _ = b.save() })
	}
}

// flush saves now when a save is waiting, and otherwise waits for a save
// already running.
func (b *catBook) flush() {
	b.mu.Lock()
	pending := b.timer != nil && b.timer.Stop()
	b.mu.Unlock()
	if pending {
		_ = b.save()
		return
	}
	b.saving.Lock()
	b.saving.Unlock()
}

func (b *catBook) save() error {
	b.saving.Lock()
	defer b.saving.Unlock()
	b.mu.Lock()
	if b.timer != nil {
		b.timer.Stop()
		b.timer = nil
	}
	b.mu.Unlock()
	raw, err := json.Marshal(b.read())
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(b.path), 0o700); err != nil {
		return err
	}
	temp := b.path + ".tmp"
	if err := os.WriteFile(temp, raw, 0o600); err != nil {
		return err
	}
	return os.Rename(temp, b.path)
}
