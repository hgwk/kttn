package autostart

import (
	"encoding/xml"
	"os"
	"strings"
	"testing"
)

type recorder struct{ calls []string }

func (r *recorder) run(name string, args ...string) (string, error) {
	r.calls = append(r.calls, name+" "+strings.Join(args, " "))
	return "", nil
}

func TestMacRegistersOneLaunchAgentAndReplacesItOnRerun(t *testing.T) {
	r := &recorder{}
	s := Service{GOOS: "darwin", Home: t.TempDir(), UID: 501, Run: r.run}
	exe := "/Users/me/.local/bin/kttn & <co>"
	for i := 0; i < 2; i++ {
		if err := s.Register(exe); err != nil {
			t.Fatal(err)
		}
	}
	raw, err := os.ReadFile(s.Path())
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasSuffix(s.Path(), "Library/LaunchAgents/io.github.hgwk.kttn.plist") {
		t.Fatalf("path %s", s.Path())
	}
	if err := xml.Unmarshal(raw, new(struct{})); err != nil {
		t.Fatalf("plist is not XML: %v", err)
	}
	for _, want := range []string{"<string>/Users/me/.local/bin/kttn &amp; &lt;co&gt;</string>", "<string>serve</string>", "<key>KeepAlive</key>", ".local/state/kttn/serve.log"} {
		if !strings.Contains(string(raw), want) {
			t.Errorf("plist lacks %s", want)
		}
	}
	want := []string{
		"launchctl bootout gui/501/io.github.hgwk.kttn",
		"launchctl bootstrap gui/501 " + s.Path(),
		"launchctl bootout gui/501/io.github.hgwk.kttn",
		"launchctl bootstrap gui/501 " + s.Path(),
	}
	if strings.Join(r.calls, "\n") != strings.Join(want, "\n") {
		t.Fatalf("calls\n%s", strings.Join(r.calls, "\n"))
	}
	if removed, err := s.Remove(); err != nil || !removed {
		t.Fatalf("remove: %v %v", removed, err)
	}
	if _, err := os.Stat(s.Path()); !os.IsNotExist(err) {
		t.Fatal("plist left behind")
	}
	if removed, _ := s.Remove(); removed {
		t.Fatal("second remove found something")
	}
}

func TestLinuxRegistersAUserUnit(t *testing.T) {
	r := &recorder{}
	s := Service{GOOS: "linux", Home: t.TempDir(), Run: r.run}
	if err := s.Register(`/opt/my "kttn"/kttn`); err != nil {
		t.Fatal(err)
	}
	raw, _ := os.ReadFile(s.Path())
	if !strings.Contains(string(raw), `ExecStart="/opt/my \"kttn\"/kttn" serve`) || !strings.Contains(string(raw), "WantedBy=default.target") {
		t.Fatalf("unit:\n%s", raw)
	}
	if !strings.HasSuffix(s.Path(), ".config/systemd/user/kttn.service") || len(r.calls) != 3 || !strings.Contains(r.calls[2], "restart kttn.service") {
		t.Fatalf("calls %v", r.calls)
	}
	if removed, err := s.Remove(); err != nil || !removed {
		t.Fatalf("remove: %v %v", removed, err)
	}
	if !strings.Contains(strings.Join(r.calls, "\n"), "disable --now kttn.service") {
		t.Fatalf("calls %v", r.calls)
	}
}

func TestOtherSystemsAreRefused(t *testing.T) {
	s := Service{GOOS: "windows", Home: t.TempDir(), Run: (&recorder{}).run}
	if err := s.Register("kttn"); err != ErrUnsupported {
		t.Fatalf("got %v", err)
	}
}
