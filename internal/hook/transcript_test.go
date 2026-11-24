package hook

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestStopCarriesFoldedAnswerOpening(t *testing.T) {
	raw := `{"session_id":"s","cwd":"/x","hook_event_name":"Stop","last_assistant_message":"고쳤습니다.\n\n- 테스트 통과"}`
	event, _ := eventFromHook([]byte(raw), "claude", true)
	if event.Result != "고쳤습니다. - 테스트 통과" {
		t.Fatalf("got %q", event.Result)
	}
	long := strings.Repeat("가", 500)
	event, _ = eventFromHook([]byte(`{"session_id":"s","hook_event_name":"Stop","last_assistant_message":"`+long+`"}`), "claude", true)
	if n := len([]rune(event.Result)); n != maxResultRunes {
		t.Fatalf("want %d runes, got %d", maxResultRunes, n)
	}
	event, _ = eventFromHook([]byte(`{"session_id":"s","hook_event_name":"PreToolUse","last_assistant_message":"secret"}`), "claude", true)
	if event.Result != "" {
		t.Fatal("only Stop may carry a result")
	}
}

func TestStopFallsBackToTranscript(t *testing.T) {
	path := filepath.Join(t.TempDir(), "t.jsonl")
	lines := strings.Join([]string{
		`{"type":"assistant","message":{"content":[{"type":"text","text":"old"}]}}`,
		`{"type":"user","message":{"content":"next"}}`,
		`{"type":"assistant","message":{"content":[{"type":"text","text":"new answer"}]}}`,
		`{"type":"assistant","message":{"content":[{"type":"tool_use","name":"Bash"}]}}`,
		`not json`,
	}, "\n")
	if err := os.WriteFile(path, []byte(lines), 0o600); err != nil {
		t.Fatal(err)
	}
	raw := `{"session_id":"s","hook_event_name":"Stop","transcript_path":"` + path + `"}`
	if event, _ := eventFromHook([]byte(raw), "claude", true); event.Result != "new answer" {
		t.Fatalf("got %q", event.Result)
	}
	missing := `{"session_id":"s","hook_event_name":"Stop","transcript_path":"/nope/x.jsonl"}`
	if event, _ := eventFromHook([]byte(missing), "claude", true); event.Result != "" {
		t.Fatalf("missing transcript should give empty, got %q", event.Result)
	}
}

func TestStopReadsTheModelOffTheLastRealAnswer(t *testing.T) {
	path := filepath.Join(t.TempDir(), "t.jsonl")
	lines := strings.Join([]string{
		`{"type":"assistant","message":{"model":"claude-sonnet-5-5","content":[{"type":"text","text":"a"}]}}`,
		`{"type":"assistant","message":{"model":"claude-opus-5-5","content":[{"type":"tool_use","name":"Read"}]}}`,
		`{"type":"user","message":{"content":"x"}}`,
		`{"type":"assistant","message":{"model":"<synthetic>","content":[{"type":"text","text":"interrupted"}]}}`,
	}, "\n")
	if err := os.WriteFile(path, []byte(lines+"\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	stop := `{"session_id":"s","hook_event_name":"Stop","last_assistant_message":"done","transcript_path":"` + path + `"}`
	event, ok := eventFromHook([]byte(stop), "claude", true)
	if !ok || event.Model != "claude-opus-5-5" || event.Result != "done" {
		t.Fatalf("Stop = model %q result %q", event.Model, event.Result)
	}
	missing, _ := eventFromHook([]byte(`{"session_id":"s","hook_event_name":"Stop","transcript_path":"/nope/x.jsonl"}`), "claude", true)
	if missing.Model != "" {
		t.Fatalf("missing transcript gave model %q", missing.Model)
	}
}

func TestStopSendsNoAnswerUnlessPreviewIsOn(t *testing.T) {
	raw := []byte(`{"session_id":"s","hook_event_name":"Stop","last_assistant_message":"private answer"}`)
	event, ok := eventFromHook(raw, "claude", false)
	if !ok || event.Result != "" {
		t.Fatalf("preview off must drop the answer, got %q", event.Result)
	}
	if out, _ := json.Marshal(event); strings.Contains(string(out), "private") {
		t.Fatalf("answer leaked: %s", out)
	}
}
