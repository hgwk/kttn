package hook

import (
	"encoding/json"
	"io"
	"os"
	"strings"
)

// maxResultRunes keeps the finished answer to its opening lines; the screen
// shows a single line and the server's body limit is 4096 bytes.
const maxResultRunes = 300

// transcriptTail bounds how much of a long transcript is read.
const transcriptTail = 256 << 10

// stopResult is the opening of the answer a session just finished, folded to
// one line. Only Stop carries it.
func stopResult(input hookInput, tail []string) string {
	if input.HookEventName != "Stop" {
		return ""
	}
	text := input.LastAssistantMessage
	if strings.TrimSpace(text) == "" {
		text = lastAssistantText(tail)
	}
	return foldResult(text)
}

func foldResult(text string) string {
	runes := []rune(strings.Join(strings.Fields(text), " "))
	if len(runes) > maxResultRunes {
		return string(runes[:maxResultRunes-1]) + "…"
	}
	return string(runes)
}

// transcriptLines reads the end of a Claude Code transcript (JSONL).
func transcriptLines(path string) []string {
	if path == "" {
		return nil
	}
	file, err := os.Open(path)
	if err != nil {
		return nil
	}
	defer file.Close()
	info, err := file.Stat()
	if err != nil {
		return nil
	}
	offset := info.Size() - transcriptTail
	if offset < 0 {
		offset = 0
	}
	buf := make([]byte, info.Size()-offset)
	if _, err := file.ReadAt(buf, offset); err != nil && err != io.EOF {
		return nil
	}
	return strings.Split(string(buf), "\n")
}

type transcriptEntry struct {
	Type    string `json:"type"`
	Message struct {
		Model   string          `json:"model"`
		Content json.RawMessage `json:"content"`
	} `json:"message"`
}

// lastAssistant walks the transcript backwards and returns the first
// non-empty value pick finds in an assistant entry.
func lastAssistant(lines []string, pick func(transcriptEntry) string) string {
	for i := len(lines) - 1; i >= 0; i-- {
		var entry transcriptEntry
		if json.Unmarshal([]byte(lines[i]), &entry) != nil || entry.Type != "assistant" {
			continue
		}
		if value := pick(entry); value != "" {
			return value
		}
	}
	return ""
}

// lastAssistantText returns the text of the last assistant entry that has any.
func lastAssistantText(lines []string) string {
	return lastAssistant(lines, func(entry transcriptEntry) string {
		var parts []struct {
			Type string `json:"type"`
			Text string `json:"text"`
		}
		if json.Unmarshal(entry.Message.Content, &parts) != nil {
			return ""
		}
		var texts []string
		for _, part := range parts {
			if part.Type == "text" && strings.TrimSpace(part.Text) != "" {
				texts = append(texts, part.Text)
			}
		}
		return strings.Join(texts, " ")
	})
}

// lastModel returns the model of the last real answer. Claude Code writes
// "<synthetic>" for answers it makes up itself (an interrupt, an API error).
func lastModel(lines []string) string {
	return lastAssistant(lines, func(entry transcriptEntry) string {
		model := strings.TrimSpace(entry.Message.Model)
		if strings.HasPrefix(model, "<") || len(model) > 64 {
			return ""
		}
		return model
	})
}
