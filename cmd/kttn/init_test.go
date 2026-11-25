package main

import (
	"bytes"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/hgwk/kttn/internal/autostart"
	"github.com/hgwk/kttn/internal/config"
)

func TestInitAsksSavesAndKeepsItsAnswersAsNextDefaults(t *testing.T) {
	path := filepath.Join(t.TempDir(), "config.json")
	t.Setenv("KTTN_CONFIG", path)
	var out bytes.Buffer
	answers := "우리 팀\nja\n\ny\n"
	if err := runInit(nil, strings.NewReader(answers), &out, noService(t)); err != nil {
		t.Fatal(err)
	}
	cfg, found, err := config.Load(path)
	if err != nil || !found {
		t.Fatalf("not saved: %v", err)
	}
	if cfg.OfficeName != "우리 팀" || cfg.Lang != "ja" || !cfg.Preview || cfg.Token == "" || cfg.Port == 0 {
		t.Fatalf("got %+v", cfg)
	}
	token := cfg.Token
	// A second run with blank answers keeps everything, the token included.
	if err := runInit(nil, strings.NewReader("\n\n\n\n"), &out, noService(t)); err != nil {
		t.Fatal(err)
	}
	again, _, _ := config.Load(path)
	if again != cfg || again.Token != token {
		t.Fatalf("defaults not kept: %+v vs %+v", again, cfg)
	}
}

func TestInitWithYesTakesFlagsAndKeepsPreviewOff(t *testing.T) {
	path := filepath.Join(t.TempDir(), "config.json")
	t.Setenv("KTTN_CONFIG", path)
	var out bytes.Buffer
	if err := runInit([]string{"--yes", "--office-name", "Lab"}, strings.NewReader(""), &out, noService(t)); err != nil {
		t.Fatal(err)
	}
	cfg, _, _ := config.Load(path)
	if cfg.OfficeName != "Lab" || cfg.Preview || cfg.Lang != "" {
		t.Fatalf("got %+v", cfg)
	}
	if info, _ := os.Stat(path); info.Mode().Perm() != 0o600 {
		t.Fatalf("mode %v", info.Mode().Perm())
	}
	if err := runInit([]string{"--yes", "--lang", "fr"}, strings.NewReader(""), &out, noService(t)); err == nil {
		t.Fatal("unknown language accepted")
	}
}

func TestInitAsksForMessagesAndYesKeepsThemOffUnlessFlagged(t *testing.T) {
	path := filepath.Join(t.TempDir(), "config.json")
	t.Setenv("KTTN_CONFIG", path)
	var out bytes.Buffer
	if err := runInit(nil, strings.NewReader("Lab\nen\n\nn\ny\n"), &out, noService(t)); err != nil {
		t.Fatal(err)
	}
	if cfg, _, _ := config.Load(path); !cfg.Messages || !strings.Contains(out.String(), "Off by default") {
		t.Fatalf("asked and answered yes: %+v", cfg)
	}
	if err := runInit([]string{"--yes"}, strings.NewReader(""), &out, noService(t)); err != nil {
		t.Fatal(err)
	}
	if cfg, _, _ := config.Load(path); !cfg.Messages {
		t.Fatal("--yes rerun dropped the earlier answer")
	}
	fresh := filepath.Join(t.TempDir(), "config.json")
	t.Setenv("KTTN_CONFIG", fresh)
	runInit([]string{"--yes"}, strings.NewReader(""), &out, noService(t))
	if cfg, _, _ := config.Load(fresh); cfg.Messages {
		t.Fatal("--yes turned messages on")
	}
	runInit([]string{"--yes", "--messages"}, strings.NewReader(""), &out, noService(t))
	if cfg, _, _ := config.Load(fresh); !cfg.Messages {
		t.Fatal("--messages did not turn them on")
	}
}

// noService is a login service that was never registered.
func noService(t *testing.T) autostart.Service {
	return autostart.Service{GOOS: "darwin", Home: t.TempDir(), UID: 501, Run: func(string, ...string) (string, error) {
		t.Fatal("nothing registered, nothing to restart")
		return "", nil
	}}
}

func TestInitRestartsARegisteredServiceSoTheNewSettingsApply(t *testing.T) {
	t.Setenv("KTTN_CONFIG", filepath.Join(t.TempDir(), "config.json"))
	var calls []string
	svc := autostart.Service{GOOS: "darwin", Home: t.TempDir(), UID: 501, Run: func(name string, args ...string) (string, error) {
		calls = append(calls, name+" "+strings.Join(args, " "))
		return "", nil
	}}
	os.MkdirAll(filepath.Dir(svc.Path()), 0o755)
	os.WriteFile(svc.Path(), []byte("plist"), 0o644)
	var out bytes.Buffer
	if err := runInit([]string{"--yes", "--messages"}, strings.NewReader(""), &out, svc); err != nil {
		t.Fatal(err)
	}
	if len(calls) != 1 || calls[0] != "launchctl kickstart -k gui/501/"+autostart.Label {
		t.Fatalf("calls %v", calls)
	}
	if !strings.Contains(out.String(), "Restarted kttn") || !strings.Contains(out.String(), "reads another config") {
		t.Fatalf("out %q", out.String())
	}
	// A service pinned to this config needs no word about it.
	os.WriteFile(svc.Path(), []byte("<string>"+config.Path()+"</string>"), 0o644)
	out.Reset()
	if err := runInit([]string{"--yes"}, strings.NewReader(""), &out, svc); err != nil || strings.Contains(out.String(), "another config") {
		t.Fatalf("out %q %v", out.String(), err)
	}
}
