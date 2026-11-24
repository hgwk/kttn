package terminal

import (
	"errors"
	"strings"
	"testing"
)

func TestCleanMessageDropsControlCharacters(t *testing.T) {
	got := CleanMessage(" hi\x1b[201~\r\nthere\tok\x07 ")
	if got != "hi[201~\nthere\tok" {
		t.Fatalf("got %q", got)
	}
}

func TestSendRefusesWhatCouldGoWrong(t *testing.T) {
	f := &fake{answers: map[string]string{"/bin/ps": "ttys003 claude"}}
	cases := []struct {
		state, text string
		want        error
	}{
		{"thinking", " \x1b ", ErrEmpty},
		{"thinking", strings.Repeat("가", MaxMessage+1), ErrTooLong},
		{"needs_you", "yes", ErrNotReady},
		{"ended", "hi", ErrNotReady},
	}
	for _, c := range cases {
		if err := Send(f.run, 4242, c.state, c.text); !errors.Is(err, c.want) {
			t.Errorf("%s %q: got %v", c.state, c.text[:min(len(c.text), 8)], err)
		}
	}
	if f.ran("/Applications") || f.ran("tmux send-keys") || f.ran("/usr/bin/osascript") {
		t.Fatalf("a refused message reached a terminal: %v", f.calls)
	}
}

func TestSendPastesThenPressesEnterInKaku(t *testing.T) {
	submitDelay = 0
	f := &fake{answers: map[string]string{
		"/bin/ps":               "ttys003 claude",
		kaku + " cli list":      `[{"pane_id":7,"tty_name":"/dev/ttys003"}]`,
		kaku + " cli send-text": "",
	}}
	if err := Send(f.run, 4242, "done", "-h looks like a flag"); err != nil {
		t.Fatal(err)
	}
	if !f.ran(kaku+" cli send-text --pane-id 7 -- -h looks like a flag") || !f.ran(kaku+" cli send-text --pane-id 7 --no-paste \r") {
		t.Fatalf("calls %q", f.calls)
	}
}

func TestSendTypesLiterallyIntoTmux(t *testing.T) {
	submitDelay = 0
	f := &fake{answers: map[string]string{
		"/bin/ps":         "ttys009 claude",
		"tmux list-panes": "/dev/ttys009 %4",
		"tmux send-keys":  "",
	}}
	if err := Send(f.run, 4242, "idle", "run it; then Enter"); err != nil {
		t.Fatal(err)
	}
	if !f.ran("tmux send-keys -t %4 -l -- run it; then Enter") || !f.ran("tmux send-keys -t %4 Enter") {
		t.Fatalf("calls %q", f.calls)
	}
}
