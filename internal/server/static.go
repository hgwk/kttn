package server

import (
	"embed"
	"io/fs"
	"net/http"
	"path"
	"strings"
)

// web is the screen build (web/ → `npm run build`). Without a build only
// .gitkeep is here and the screen answers with a hint instead of a page.
//
//go:embed all:web
var webFiles embed.FS

// staticHandler serves the embedded screen. Unknown paths that are not files
// fall back to index.html, so the page can be reloaded anywhere.
func staticHandler() http.Handler {
	root, _ := fs.Sub(webFiles, "web")
	files := http.FileServer(http.FS(root))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		name := strings.TrimPrefix(path.Clean(r.URL.Path), "/")
		if name == "" || name == "." {
			name = "index.html"
		}
		if _, err := fs.Stat(root, name); err != nil {
			name = "index.html"
			r = r.Clone(r.Context())
			r.URL.Path = "/"
		}
		if _, err := fs.Stat(root, "index.html"); err != nil {
			http.Error(w, "kttn: the screen is not built. Run `npm --prefix web run build`, then rebuild kttn.", http.StatusNotFound)
			return
		}
		if strings.HasSuffix(name, ".webmanifest") {
			w.Header().Set("Content-Type", "application/manifest+json")
		}
		if strings.HasPrefix(name, "assets/") {
			// Built asset names carry a content hash.
			w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
		} else {
			w.Header().Set("Cache-Control", "no-cache")
		}
		files.ServeHTTP(w, r)
	})
}
