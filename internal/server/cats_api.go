package server

import (
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"unicode"
	"unicode/utf8"
)

const (
	maxCatBody = 1024
	maxCatName = 32
)

// catName checks a name the screen gives a cat: 1 to 32 characters after
// trimming, none of them control or format characters (a right-to-left
// override would make the name read as something else).
func catName(raw string) (string, bool) {
	name := strings.TrimSpace(raw)
	if name == "" || utf8.RuneCountInString(name) > maxCatName || !utf8.ValidString(name) {
		return "", false
	}
	for _, r := range name {
		if unicode.IsControl(r) || unicode.Is(unicode.Cf, r) {
			return "", false
		}
	}
	return name, true
}

// catsHandlers serves the catalog to the office screen: the list, naming a
// cat, and clearing it all. Writes need the screen's own origin.
func catsHandlers(b *catBook) (list, name, clear http.HandlerFunc) {
	list = func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		writeJSON(w, http.StatusOK, map[string][]cat{"cats": b.list()})
	}
	name = func(w http.ResponseWriter, r *http.Request) {
		if !screenAction(r) {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "forbidden"})
			return
		}
		raw, err := io.ReadAll(io.LimitReader(r.Body, maxCatBody+1))
		if err != nil || len(raw) > maxCatBody {
			writeJSON(w, http.StatusRequestEntityTooLarge, map[string]string{"error": "body too large"})
			return
		}
		var body struct {
			Key     string `json:"key"`
			CatName string `json:"cat_name"`
			Replace bool   `json:"replace"`
		}
		if json.Unmarshal(raw, &body) != nil || body.Key == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "key and cat_name are required"})
			return
		}
		clean, ok := catName(body.CatName)
		if !ok {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "a name is 1 to 32 characters, no control characters"})
			return
		}
		saved, ok := b.name(body.Key, clean, body.Replace)
		if !ok {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "no such cat"})
			return
		}
		writeJSON(w, http.StatusOK, map[string]cat{"cat": saved})
	}
	clear = func(w http.ResponseWriter, r *http.Request) {
		if !screenAction(r) {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "forbidden"})
			return
		}
		if err := b.clear(); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not clear"})
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
	return list, name, clear
}
