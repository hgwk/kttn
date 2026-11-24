package server

import (
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
