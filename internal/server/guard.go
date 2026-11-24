package server

import (
	"crypto/subtle"
	"net"
	"net/http"
	"strings"
)

// loopbackHost reports whether the request was addressed to this computer by
// name. The server listens on 127.0.0.1 only, but a page on another site can
// still reach it through DNS rebinding, which keeps the foreign host name.
func loopbackHost(r *http.Request) bool {
	host := r.Host
	if h, _, err := net.SplitHostPort(host); err == nil {
		host = h
	}
	return host == "127.0.0.1" || host == "localhost"
}

// hookRequest accepts only what the hook sends: JSON, with no Origin. Browsers
// add Origin to every cross-site POST, so a page elsewhere cannot forge
// sessions even with a text/plain body that skips the CORS preflight.
func hookRequest(r *http.Request) bool {
	if r.Header.Get("Origin") != "" {
		return false
	}
	return strings.HasPrefix(r.Header.Get("Content-Type"), "application/json")
}

// withLoopback refuses every request that was not addressed to this computer.
func withLoopback(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !loopbackHost(r) {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "forbidden"})
			return
		}
		next.ServeHTTP(w, r)
	})
}

// withFrameAncestors lets only the office itself and the listed origins put
// the office in an iframe. Screen actions inside such a frame still come from
// the office's own page, so the same-origin check on them is unchanged.
func withFrameAncestors(origins []string, next http.Handler) http.Handler {
	policy := "frame-ancestors " + strings.Join(append([]string{"'self'"}, origins...), " ")
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Security-Policy", policy)
		next.ServeHTTP(w, r)
	})
}

// screenKeyOK checks the screen key. Origin and Host stop other web sites,
// not other programs or users on this computer, which can send any header;
// the key, kept in a file only this user can read, does. With no key set
// (kttn not set up yet) the screen stays open so it can show onboarding.
func screenKeyOK(w http.ResponseWriter, r *http.Request, key string) bool {
	if key == "" || subtle.ConstantTimeCompare([]byte(r.Header.Get("X-Kttn-Key")), []byte(key)) == 1 {
		return true
	}
	writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "screen key required; open the office with kttn open"})
	return false
}

func withScreenKey(key string, next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if screenKeyOK(w, r, key) {
			next(w, r)
		}
	}
}
