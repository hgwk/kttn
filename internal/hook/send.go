package hook

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"time"
)

const maxHookInput = 1 << 20

// Options says where and how the hook forwards its event.
type Options struct {
	Endpoint string
	Source   string
	Token    string
	Timeout  time.Duration
	// Preview lets Stop carry the opening of the answer. Off by default.
	Preview bool
}

// Run forwards one hook payload and never fails the session: the office is
// decoration, so a stopped server or a bad payload just drops the signal. It
// writes nothing to stdout because some hook events add stdout to context.
func Run(stdin io.Reader, opts Options) {
	raw, err := io.ReadAll(io.LimitReader(stdin, maxHookInput))
	if err != nil {
		return
	}
	event, ok := eventFromHook(raw, opts.Source, opts.Preview)
	if !ok {
		return
	}
	body, err := json.Marshal(event)
	if err != nil {
		return
	}
	req, err := http.NewRequest(http.MethodPost, opts.Endpoint, bytes.NewReader(body))
	if err != nil {
		return
	}
	req.Header.Set("Content-Type", "application/json")
	if opts.Token != "" {
		req.Header.Set("Authorization", "Bearer "+opts.Token)
	}
	client := &http.Client{Timeout: opts.Timeout}
	if resp, err := client.Do(req); err == nil {
		_, _ = io.Copy(io.Discard, resp.Body)
		resp.Body.Close()
	}
}
