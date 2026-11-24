package terminal

import (
	"errors"
	"strings"
	"testing"
)

// fake answers commands by their first words and records every call.
type fake struct {
	answers map[string]string
	calls   []string
}

func (f *fake) run(name string, args ...string) (string, error) {
	call := strings.TrimRight(name+" "+strings.Join(args, " "), " ")
	f.calls = append(f.calls, call)
	for prefix, out := range f.answers {
		if strings.HasPrefix(call, prefix) {
			if out == "ERR" {
				return "", errors.New("failed")
			}
			return out, nil
		}
	}
	return "", errors.New("not installed")
}

func (f *fake) ran(prefix string) bool {
	for _, call := range f.calls {
		if strings.HasPrefix(call, prefix) {
			return true
		}
	}
	return false
}

const kaku = "/Applications/Kaku.app/Contents/MacOS/kaku"

func TestFocusFindsTheKakuPaneByTheSessionsTTY(t *testing.T) {
	f := &fake{answers: map[string]string{
		"/bin/ps":                   "ttys003\n",
		kaku + " cli list":          `[{"pane_id":1,"tty_name":"/dev/ttys001"},{"pane_id":7,"tty_name":"/dev/ttys003"}]`,
		kaku + " cli activate-pane": "",
		"/usr/bin/open -a Kaku":     "",
	}}
	if err := Focus(f.run, 4242); err != nil {
		t.Fatal(err)
	}
	if !f.ran(kaku+" cli activate-pane --pane-id 7") || !f.ran("/usr/bin/open -a Kaku") {
		t.Fatalf("calls %v", f.calls)
	}
}

func TestTmuxWinsBecauseItsPaneSitsInsideAnotherTerminal(t *testing.T) {
	f := &fake{answers: map[string]string{
		"/bin/ps":                  "ttys009",
		"tmux list-panes":          "/dev/ttys002 %1\n/dev/ttys009 %4\n",
		"tmux select-window -t %4": "",
		"tmux select-pane -t %4":   "",
	}}
	if err := Focus(f.run, 4242); err != nil {
		t.Fatal(err)
	}
	if f.ran(kaku) {
		t.Fatalf("went past tmux: %v", f.calls)
	}
}

func TestAppleScriptTerminalsGetTheTTYAsAnArgument(t *testing.T) {
	f := &fake{answers: map[string]string{
		"/bin/ps":            "ttys005",
		"/usr/bin/osascript": "none",
	}}
	if err := Focus(f.run, 4242); !errors.Is(err, ErrNoTab) {
		t.Fatalf("want ErrNoTab, got %v", err)
	}
	for _, call := range f.calls {
		if strings.HasPrefix(call, "/usr/bin/osascript") && !strings.HasSuffix(call, "end run /dev/ttys005") {
			t.Fatalf("tty not passed as argv: %q", call[len(call)-40:])
		}
	}
	f.answers["/usr/bin/osascript"] = "ok"
	if err := Focus(f.run, 4242); err != nil {
		t.Fatal(err)
	}
}

func TestFocusRefusesSessionsWithoutAUsableProcess(t *testing.T) {
	f := &fake{answers: map[string]string{"/bin/ps": "??"}}
	if err := Focus(f.run, 0); !errors.Is(err, ErrNoProcess) {
		t.Fatalf("pid 0: %v", err)
	}
	if err := Focus(f.run, 4242); !errors.Is(err, ErrNoTab) {
		t.Fatalf("no tty: %v", err)
	}
	f.answers["/bin/ps"] = "ERR"
	if err := Focus(f.run, 4242); !errors.Is(err, ErrNoProcess) {
		t.Fatalf("gone process: %v", err)
	}
}
