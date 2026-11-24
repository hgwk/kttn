package hook

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestEventFromHookDropsPromptAndRejectsJunk(t *testing.T) {
	raw := `{"session_id":"abc","cwd":"/Users/x/Project/myrepo","hook_event_name":"UserPromptSubmit","prompt":"private words"}`
	event, ok := eventFromHook([]byte(raw), "claude", false)
	if !ok || event.Project != "myrepo" || event.Session != "abc" {
		t.Fatalf("unexpected event %+v", event)
	}
	if strings.Contains(event.Detail+event.Tool, "private") {
		t.Fatal("prompt text must not be forwarded")
	}
	for _, junk := range []string{"", "not json", `{"hook_event_name":"Stop"}`} {
		if _, ok := eventFromHook([]byte(junk), "claude", false); ok {
			t.Errorf("%q should be dropped", junk)
		}
	}
}

func TestNotificationSendsItsType(t *testing.T) {
	raw := `{"session_id":"s","hook_event_name":"Notification","notification_type":"idle_prompt","message":"Claude is waiting for your input"}`
	if event, _ := eventFromHook([]byte(raw), "claude", false); event.Detail != "idle_prompt" {
		t.Fatalf("got %q", event.Detail)
	}
}

func TestSubagentEventsCarryAgentIDAndType(t *testing.T) {
	raw := `{"session_id":"s","hook_event_name":"SubagentStart","agent_id":"ag1","agent_type":"Explore"}`
	event, _ := eventFromHook([]byte(raw), "claude", false)
	if event.ToolUseID != "ag1" || event.Detail != "Explore" {
		t.Fatalf("got %+v", event)
	}
	raw = `{"session_id":"s","hook_event_name":"SubagentStop","agent_id":"ag1","last_assistant_message":"secret"}`
	event, _ = eventFromHook([]byte(raw), "claude", false)
	if event.ToolUseID != "ag1" || event.Detail != "general-purpose" || event.Result != "" {
		t.Fatalf("got %+v", event)
	}
}

func TestHeadlessComesFromEntrypoint(t *testing.T) {
	raw := []byte(`{"session_id":"s","hook_event_name":"SessionStart"}`)
	t.Setenv("CLAUDE_CODE_ENTRYPOINT", "sdk-cli")
	if event, _ := eventFromHook(raw, "claude", false); !event.Headless {
		t.Fatal("sdk-cli should be headless")
	}
	t.Setenv("CLAUDE_CODE_ENTRYPOINT", "cli")
	if event, _ := eventFromHook(raw, "claude", false); event.Headless {
		t.Fatal("cli is interactive")
	}
}

func TestToolEventsInsideSubagentAreMarked(t *testing.T) {
	raw := `{"session_id":"s","hook_event_name":"PreToolUse","tool_name":"Read","tool_use_id":"t1","agent_id":"ag1"}`
	event, _ := eventFromHook([]byte(raw), "claude", false)
	if event.Subagent != "ag1" || event.ToolUseID != "t1" {
		t.Fatalf("got %+v", event)
	}
	raw = `{"session_id":"s","hook_event_name":"SubagentStart","agent_id":"ag1"}`
	if event, _ := eventFromHook([]byte(raw), "claude", false); event.Subagent != "" {
		t.Fatalf("start should not be marked, got %+v", event)
	}
}

func TestSessionPIDOnlyOnSessionEvents(t *testing.T) {
	if got := sessionPID("PreToolUse"); got != 0 {
		t.Fatalf("tool events must not look up the pid, got %d", got)
	}
	// go test is not run by claude, so no claude process is found above it.
	if got := sessionPID("SessionStart"); got != 0 && got != os.Getppid() {
		t.Fatalf("unexpected pid %d", got)
	}
}

func TestSessionNameReadsRegistry(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)
	if err := os.MkdirAll(filepath.Join(home, ".claude", "sessions"), 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(home, ".claude", "sessions", "4242.json"), []byte(`{"pid":4242,"name":"work-eb"}`), 0o600); err != nil {
		t.Fatal(err)
	}
	if got := sessionName(4242); got != "work-eb" {
		t.Fatalf("got %q", got)
	}
	if got := sessionName(4243); got != "" {
		t.Fatalf("missing file should give empty, got %q", got)
	}
	if got := sessionName(0); got != "" {
		t.Fatalf("no pid should give empty, got %q", got)
	}
}

func TestNewEventsSendOnlyAShortLabel(t *testing.T) {
	cases := []struct{ body, detail, id string }{
		{`"hook_event_name":"SessionStart","source":"resume"`, "resume", ""},
		{`"hook_event_name":"SessionEnd","reason":"clear"`, "clear", ""},
		{`"hook_event_name":"PreCompact","trigger":"auto","custom_instructions":"keep x"`, "auto", ""},
		{`"hook_event_name":"PostCompact","trigger":"manual","compact_summary":"long summary"`, "manual", ""},
		{`"hook_event_name":"StopFailure","error":"rate_limit","error_details":"429 body"`, "rate_limit", ""},
		{`"hook_event_name":"PostToolUseFailure","tool_name":"Bash","tool_input":{"command":"go test ./..."},"error":"exit 1 secret"`, "go", ""},
		{`"hook_event_name":"PostToolUseFailure","tool_name":"Bash","is_interrupt":true`, "interrupt", ""},
		{`"hook_event_name":"TaskCreated","task_id":"t1","task_subject":"Add login","task_description":"long"`, "", "t1"},
		{`"hook_event_name":"TaskCompleted","task_id":"t1","task_subject":"Add login"`, "", "t1"},
		{`"hook_event_name":"TeammateIdle","teammate_name":"researcher","team_name":"x"`, "researcher", ""},
		{`"hook_event_name":"WorktreeRemove","worktree_path":"/a/.claude/worktrees/feature-auth"`, "feature-auth", ""},
		{`"hook_event_name":"Elicitation","mcp_server_name":"github","message":"token?"`, "github", ""},
		{`"hook_event_name":"ElicitationResult","mcp_server_name":"github","action":"accept","content":{"u":"a"}`, "accept", ""},
		{`"hook_event_name":"InstructionsLoaded","file_path":"/r/CLAUDE.md","load_reason":"session_start"`, "CLAUDE.md", ""},
		{`"hook_event_name":"ConfigChange","source":"user_settings","file_path":"/h/.claude/settings.json"`, "user_settings", ""},
		{`"hook_event_name":"Setup","trigger":"init"`, "init", ""},
		{`"hook_event_name":"PostModelSwitch","from_model":"a","to_model":"claude-opus-5-5"`, "claude-opus-5-5", ""},
	}
	for _, c := range cases {
		raw := []byte(`{"session_id":"s","cwd":"/tmp",` + c.body + `}`)
		event, ok := eventFromHook(raw, "claude", false)
		if !ok {
			t.Fatalf("eventFromHook rejected %s", c.body)
		}
		if event.Detail != c.detail || event.ToolUseID != c.id {
			t.Errorf("%s: detail %q id %q, want %q %q", c.body, event.Detail, event.ToolUseID, c.detail, c.id)
		}
		if out, _ := json.Marshal(event); strings.Contains(string(out), "secret") || strings.Contains(string(out), "summary") || strings.Contains(string(out), "429") {
			t.Errorf("%s leaked text: %s", c.body, out)
		}
	}
}

func TestSessionStartCarriesTheStartingModelOnly(t *testing.T) {
	start, ok := eventFromHook([]byte(`{"session_id":"s","cwd":"/tmp","hook_event_name":"SessionStart","source":"startup","model":"claude-opus-5-5"}`), "claude", false)
	if !ok || start.Model != "claude-opus-5-5" || start.Detail != "startup" {
		t.Fatalf("SessionStart = %+v", start)
	}
	tool, ok := eventFromHook([]byte(`{"session_id":"s","cwd":"/tmp","hook_event_name":"PreToolUse","tool_name":"Read","model":"claude-opus-5-5"}`), "claude", false)
	if !ok || tool.Model != "" {
		t.Fatalf("PreToolUse model = %q", tool.Model)
	}
	raw, _ := json.Marshal(tool)
	if strings.Contains(string(raw), `"model"`) {
		t.Fatalf("tool event sends a model field: %s", raw)
	}
}

func TestOnceATurnEventsCarryThePID(t *testing.T) {
	for _, event := range []string{"SessionStart", "UserPromptSubmit", "Stop", "Notification"} {
		if !carriesPID(event) {
			t.Fatalf("%s should look up the pid", event)
		}
	}
	for _, event := range []string{"PreToolUse", "PostToolUse", "PostToolUseFailure", "SubagentStop", "InstructionsLoaded"} {
		if carriesPID(event) {
			t.Fatalf("%s must not look up the pid", event)
		}
	}
}

func TestTaskTitlesTravelOnlyWithThePreviewAndErrorsAreLabels(t *testing.T) {
	task := []byte(`{"session_id":"s","hook_event_name":"TaskCreated","task_id":"t1","task_subject":"Fix the payroll export for Kim"}`)
	if event, _ := eventFromHook(task, "claude", false); event.Detail != "" || event.ToolUseID != "t1" {
		t.Fatalf("preview off: %+v", event)
	}
	if event, _ := eventFromHook(task, "claude", true); event.Detail != "Fix the payroll export for Kim" {
		t.Fatalf("preview on: %+v", event)
	}
	for raw, want := range map[string]string{"rate_limit": "rate_limit", "overloaded": "overloaded", "socket hang up at 10.0.0.3": "other", "": "other"} {
		body := []byte(`{"session_id":"s","hook_event_name":"StopFailure","error":"` + raw + `"}`)
		if event, _ := eventFromHook(body, "claude", false); event.Detail != want {
			t.Errorf("%q: got %q", raw, event.Detail)
		}
	}
}
