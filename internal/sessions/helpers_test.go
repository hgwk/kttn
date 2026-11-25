package sessions

import (
	"encoding/json"
	"testing"
	"time"
)

type clock struct{ now time.Time }

func (c *clock) read() time.Time { return c.now }

func newClock() *clock {
	return &clock{now: time.Date(2026, 11, 19, 9, 0, 0, 0, time.UTC)}
}

func clockedStore(alive func(int) bool) (*Store, *clock) {
	c := newClock()
	if alive == nil {
		alive = func(int) bool { return false }
	}
	return NewStore(c.read, alive), c
}

// ev builds a checked event the way the server would from a JSON body.
func ev(t *testing.T, name string, extra map[string]any) Event {
	t.Helper()
	body := map[string]any{"source": "claude", "session": "s1", "project": "myrepo", "event": name}
	for k, v := range extra {
		body[k] = v
	}
	// Round-trip through JSON so numbers arrive as float64, as on the wire.
	raw, _ := json.Marshal(body)
	var decoded any
	_ = json.Unmarshal(raw, &decoded)
	event, err := ParseEvent(decoded)
	if err != nil {
		t.Fatalf("%s: %v", name, err)
	}
	return event
}

type m = map[string]any

func sessions(agents []Agent) []string {
	out := []string{}
	for _, a := range agents {
		out = append(out, a.Session)
	}
	return out
}

func saved(t *testing.T, store *Store) []byte {
	t.Helper()
	raw, err := json.Marshal(store.Snapshot())
	if err != nil {
		t.Fatal(err)
	}
	return raw
}
