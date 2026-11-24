// Package config is the onboarding record `kttn init` writes and both
// `kttn serve` and `kttn hook` read: ~/.config/kttn/config.json.
package config

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io/fs"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
)

// DefaultPort spells KTTN on a phone keypad.
const DefaultPort = 5886

// Config is what onboarding asks for.
type Config struct {
	// OfficeName names the building and the home-folder office.
	OfficeName string `json:"office_name"`
	// Lang is the screen language: ko, en or ja. Empty follows the browser.
	Lang string `json:"lang"`
	Port int    `json:"port"`
	// Token is shared by the hook and the server; init generates it.
	Token string `json:"token"`
	// ScreenKey opens the office's sessions and terminal actions to a
	// browser; only a page opened with it (kttn open) can use them.
	ScreenKey string `json:"screen_key,omitempty"`
	// Preview lets Stop carry the opening of the answer to the screen.
	Preview bool `json:"preview"`
	// Messages lets the screen type into a session's input from its speech
	// bubble. Off unless the user turns it on.
	Messages bool `json:"messages"`
	// EmbedOrigins are the pages allowed to show the office in an iframe,
	// besides the office itself. None by default.
	EmbedOrigins *[]string `json:"embed_origins,omitempty"`
}

// Embedders returns the origins allowed to embed the office, keeping only
// well-formed http(s) origins so nothing odd reaches the CSP header.
func (c Config) Embedders() []string {
	var list []string
	if c.EmbedOrigins != nil {
		list = *c.EmbedOrigins
	}
	out := []string{}
	for _, origin := range list {
		if originPattern.MatchString(origin) {
			out = append(out, origin)
		}
	}
	return out
}

var originPattern = regexp.MustCompile(`^https?://[A-Za-z0-9.-]+(:[0-9]{1,5})?$`)

// Path is $XDG_CONFIG_HOME/kttn/config.json, else ~/.config/kttn/config.json.
// KTTN_CONFIG overrides it.
func Path() string {
	if path := os.Getenv("KTTN_CONFIG"); path != "" {
		return path
	}
	base := os.Getenv("XDG_CONFIG_HOME")
	if base == "" {
		home, err := os.UserHomeDir()
		if err != nil {
			return ""
		}
		base = filepath.Join(home, ".config")
	}
	return filepath.Join(base, "kttn", "config.json")
}

// Load reads the config. A missing file gives defaults and found=false.
func Load(path string) (cfg Config, found bool, err error) {
	cfg = Config{Port: DefaultPort}
	raw, err := os.ReadFile(path)
	if errors.Is(err, fs.ErrNotExist) {
		return cfg, false, nil
	}
	if err != nil {
		return cfg, false, err
	}
	if err := json.Unmarshal(raw, &cfg); err != nil {
		return Config{Port: DefaultPort}, false, err
	}
	if cfg.Port <= 0 || cfg.Port > 65535 {
		cfg.Port = DefaultPort
	}
	return cfg, true, nil
}

// Save writes the config readable by this user only, since it holds the token.
func Save(path string, cfg Config) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return err
	}
	raw, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		return err
	}
	temp := path + ".tmp"
	if err := os.WriteFile(temp, append(raw, '\n'), 0o600); err != nil {
		return err
	}
	return os.Rename(temp, path)
}

// NewToken makes a random shared token.
func NewToken() (string, error) {
	buf := make([]byte, 24)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return hex.EncodeToString(buf), nil
}

// EnsureKeys fills in a missing hook token or screen key and reports
// whether it did.
func (c *Config) EnsureKeys() (bool, error) {
	changed := false
	for _, key := range []*string{&c.Token, &c.ScreenKey} {
		if *key != "" {
			continue
		}
		fresh, err := NewToken()
		if err != nil {
			return changed, err
		}
		*key, changed = fresh, true
	}
	return changed, nil
}

// OfficeURL is the office's address; the key rides in the fragment, which
// browsers never send to the server.
func (c Config) OfficeURL() string {
	return "http://127.0.0.1:" + strconv.Itoa(c.Port) + "/#k=" + c.ScreenKey
}

// EventsURL is where the hook sends events for this config.
func (c Config) EventsURL() string {
	return "http://127.0.0.1:" + strconv.Itoa(c.Port) + "/api/events"
}
