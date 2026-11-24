package hook

import (
	"os"
	"path/filepath"
	"testing"
)

func TestToolDetailKeepsOnlyShortLabels(t *testing.T) {
	cases := []struct {
		tool  string
		input map[string]any
		want  string
	}{
		{"Read", map[string]any{"file_path": "/Users/x/secret/plan.md"}, "plan.md"},
		{"Bash", map[string]any{"command": "FOO=1 BAR=2 /opt/homebrew/bin/go test ./... --token abc"}, "go"},
		{"Bash", map[string]any{"command": ""}, ""},
		{"Bash", map[string]any{"command": "cd /tmp/x && rtk proxy git status"}, "git"},
		{"Bash", map[string]any{"command": "cd /tmp; npm test | tail"}, "npm"},
		{"Bash", map[string]any{"command": "nohup npx next dev &"}, "npx"},
		{"WebFetch", map[string]any{"url": "https://example.com/a?q=private"}, "example.com"},
		{"Agent", map[string]any{"subagent_type": "Explore", "prompt": "very private"}, "Explore"},
		{"Agent", map[string]any{"prompt": "very private"}, "general-purpose"},
		{"mcp__github__get_issue", nil, "github"},
		{"Grep", map[string]any{"pattern": "password"}, ""},
	}
	for _, c := range cases {
		if got := toolDetail(c.tool, c.input); got != c.want {
			t.Errorf("%s: want %q, got %q", c.tool, c.want, got)
		}
	}
}

func TestProjectNameUsesRepositoryRoot(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)
	root := home + "/Project/myrepo"
	if err := os.MkdirAll(root+"/.git", 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(root+"/tools/deep", 0o755); err != nil {
		t.Fatal(err)
	}
	cases := []struct{ cwd, name, folder, root string }{
		{root + "/tools/deep", "myrepo", "tools/deep", "Project/myrepo"},
		{root, "myrepo", "", "Project/myrepo"},
		{home + "/Project", "Project", "", "Project"},
		{home, "~", "", ""},
		{"", "", "", ""},
	}
	for _, c := range cases {
		name, folder, gotRoot := projectName(c.cwd)
		if name != c.name || folder != c.folder || gotRoot != c.root {
			t.Errorf("%q: want %q %q %q, got %q %q %q", c.cwd, c.name, c.folder, c.root, name, folder, gotRoot)
		}
	}
	outside := t.TempDir()
	if name, folder, gotRoot := projectName(outside); name != filepath.Base(outside) || folder != "" || gotRoot != filepath.ToSlash(outside) {
		t.Errorf("outside home want absolute root, got %q %q %q", name, folder, gotRoot)
	}
}

func TestSendMessageNamesTheRecipientOnly(t *testing.T) {
	for to, want := range map[string]string{
		"work-21":                      "work-21",
		"work-d3 [9e3f68]":             "work-d3",
		" 작업 콘솔 [a1] ":                 "작업 콘솔",
		"uds:/tmp/cc-socks/93649.sock": "",
		"":                             "",
	} {
		input := map[string]any{"to": to, "message": "secret body"}
		if got := toolDetail("SendMessage", input); got != want {
			t.Errorf("toolDetail(SendMessage, %q) = %q, want %q", to, got, want)
		}
	}
}
