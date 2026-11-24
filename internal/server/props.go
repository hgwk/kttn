package server

import (
	"encoding/json"
	"io"
	"math"
	"net/http"
	"os"
	"path/filepath"
	"sync"
)

const (
	maxPropsBytes = 64 << 10
	maxPropOffset = 2000
	maxPropKey    = 128
)

// propOffset is how far a dragged prop sits from its default place, in px.
// Hidden marks a prop the user threw away; omitted when false.
type propOffset struct {
	X      int  `json:"x"`
	Y      int  `json:"y"`
	Hidden bool `json:"hidden,omitempty"`
}

// props is the layout people made by dragging lounge props and wall decor:
// room seed → item key → offset.
type props struct {
	Rooms map[string]map[string]propOffset `json:"rooms"`
}

// propsFile keeps the layout in its own file next to the config, so dragging
// never rewrites config.json.
type propsFile struct {
	path string
	mu   sync.Mutex
}

func (f *propsFile) load() props {
	out := props{Rooms: map[string]map[string]propOffset{}}
	raw, err := os.ReadFile(f.path)
	if err != nil {
		return out
	}
	if parsed, ok := parseProps(raw); ok {
		return parsed
	}
	return out
}

func (f *propsFile) save(p props) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	raw, err := json.Marshal(p)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(f.path), 0o700); err != nil {
		return err
	}
	temp := f.path + ".tmp"
	if err := os.WriteFile(temp, raw, 0o600); err != nil {
		return err
	}
	return os.Rename(temp, f.path)
}

// parseProps checks the shape and rounds offsets; the screen snaps to 4px but
// can send a fraction when it clamps to a room's edge.
func parseProps(raw []byte) (props, bool) {
	var body struct {
		Rooms map[string]map[string]struct {
			X      *float64 `json:"x"`
			Y      *float64 `json:"y"`
			Hidden bool     `json:"hidden"`
		} `json:"rooms"`
	}
	if json.Unmarshal(raw, &body) != nil || body.Rooms == nil {
		return props{}, false
	}
	out := props{Rooms: map[string]map[string]propOffset{}}
	for seed, items := range body.Rooms {
		if seed == "" || len(seed) > maxPropKey || items == nil {
			return props{}, false
		}
		room := map[string]propOffset{}
		for key, at := range items {
			if key == "" || len(key) > maxPropKey || at.X == nil || at.Y == nil {
				return props{}, false
			}
			x, y := math.Round(*at.X), math.Round(*at.Y)
			if math.Abs(x) > maxPropOffset || math.Abs(y) > maxPropOffset {
				return props{}, false
			}
			room[key] = propOffset{X: int(x), Y: int(y), Hidden: at.Hidden}
		}
		out.Rooms[seed] = room
	}
	return out, true
}

// propsHandlers serves GET and PUT /api/props to the office screen only.
func propsHandlers(f *propsFile) (get, put http.HandlerFunc) {
	get = func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		writeJSON(w, http.StatusOK, f.load())
	}
	put = func(w http.ResponseWriter, r *http.Request) {
		if !screenAction(r) {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "forbidden"})
			return
		}
		raw, err := io.ReadAll(io.LimitReader(r.Body, maxPropsBytes+1))
		if err != nil || len(raw) > maxPropsBytes {
			writeJSON(w, http.StatusRequestEntityTooLarge, map[string]string{"error": "body too large"})
			return
		}
		parsed, ok := parseProps(raw)
		if !ok {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "bad props"})
			return
		}
		if err := f.save(parsed); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not save"})
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
	return get, put
}
