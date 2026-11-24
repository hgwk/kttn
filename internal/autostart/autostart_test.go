package autostart

import (
	"encoding/xml"
	"errors"
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
	bootstrapWait = 0
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
	for _, want := range []string{"<string>/Users/me/.local/bin/kttn &amp; &lt;co&gt;</string>", "<string>serve</string>", "<key>KeepAlive</key>", ".local/state/kttn/serve.log", "<string>/opt/homebrew/bin:"} {
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
	if !strings.Contains(string(raw), `Environment="PATH=/opt/homebrew/bin:`) || !strings.Contains(string(raw), `ExecStart="/opt/my \"kttn\"/kttn" serve`) || !strings.Contains(string(raw), "WantedBy=default.target") {
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

// launchd can refuse a bootstrap right after bootout while the old agent is
// still going away; setup retries instead of failing.
func TestBootstrapIsRetriedWhileTheOldAgentGoesAway(t *testing.T) {
	bootstrapWait = 0
	fails := 2
	var calls []string
	s := Service{GOOS: "darwin", Home: t.TempDir(), UID: 501, Run: func(name string, args ...string) (string, error) {
		calls = append(calls, args[0])
		if args[0] == "bootstrap" && fails > 0 {
			fails--
			return "", errors.New("Bootstrap failed: 5: Input/output error")
		}
		return "", nil
	}}
	if err := s.Register("/bin/kttn"); err != nil {
		t.Fatalf("register: %v (calls %v)", err, calls)
	}
	if strings.Count(strings.Join(calls, " "), "bootstrap") != 3 {
		t.Fatalf("calls %v", calls)
	}
}

func TestRemoveStopsALoadedAgentWhoseFileIsGone(t *testing.T) {
	r := &recorder{}
	s := Service{GOOS: "darwin", Home: t.TempDir(), UID: 501, Run: r.run}
	if removed, _ := s.Remove(); removed || len(r.calls) != 1 || !strings.Contains(r.calls[0], "bootout") {
		t.Fatalf("removed %v calls %v", removed, r.calls)
	}
}

func TestTheServiceFindsTmuxWhereSetupFoundItAndKeepsSetupsConfig(t *testing.T) {
	s := Service{GOOS: "darwin", Home: t.TempDir(), UID: 501, Run: (&recorder{}).run,
		PathDirs: []string{"/opt/local/bin", "/usr/bin"},
		Env:      map[string]string{"KTTN_STATE": "/tmp/s & t", "KTTN_CONFIG": "/tmp/c.json"}}
	plist := string(s.plist("/k"))
	for _, want := range []string{
		"<string>/opt/local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>",
		"<key>KTTN_CONFIG</key>\n\t\t<string>/tmp/c.json</string>\n\t\t<key>KTTN_STATE</key>\n\t\t<string>/tmp/s &amp; t</string>",
	} {
		if !strings.Contains(plist, want) {
			t.Errorf("plist lacks %q:\n%s", want, plist)
		}
	}
	if err := xml.Unmarshal([]byte(plist), new(struct{})); err != nil {
		t.Fatal(err)
	}
	s.GOOS = "linux"
	if unit := string(s.unit("/k")); !strings.Contains(unit, `Environment="KTTN_CONFIG=/tmp/c.json"`) || !strings.Contains(unit, `Environment="PATH=/opt/local/bin:/opt/homebrew/bin:`) {
		t.Errorf("unit:\n%s", unit)
	}
}

func TestMentionsReadsTheValueTheWayRegisterWroteIt(t *testing.T) {
	odd := "/Users/me/R&D 100%/kttn/config.json"
	for _, goos := range []string{"darwin", "linux"} {
		s := Service{GOOS: goos, Home: t.TempDir(), UID: 501, Run: (&recorder{}).run, Env: map[string]string{"KTTN_CONFIG": odd}}
		if s.Mentions(odd) {
			t.Fatalf("%s: nothing registered yet", goos)
		}
		bootstrapWait = 0
		if err := s.Register("/k"); err != nil {
			t.Fatal(err)
		}
		if !s.Mentions(odd) || s.Mentions("/Users/me/other/config.json") {
			t.Errorf("%s: wrong answer", goos)
		}
	}
}
