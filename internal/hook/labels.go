package hook

import (
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

func inputString(input map[string]any, key string) string {
	if value, ok := input[key].(string); ok {
		return value
	}
	return ""
}

// toolDetail keeps one short label per tool: a file's base name, a command's
// first program, a web host, a message recipient or a subagent type.
func toolDetail(tool string, input map[string]any) string {
	switch tool {
	case "Read", "Edit", "Write", "MultiEdit":
		return baseOrEmpty(inputString(input, "file_path"))
	case "NotebookEdit":
		return baseOrEmpty(inputString(input, "notebook_path"))
	case "Bash":
		return commandName(inputString(input, "command"))
	case "WebFetch":
		if parsed, err := url.Parse(inputString(input, "url")); err == nil {
			return parsed.Host
		}
	case "SendMessage":
		return recipient(inputString(input, "to"))
	case "Agent", "Task":
		if kind := inputString(input, "subagent_type"); kind != "" {
			return kind
		}
		return "general-purpose"
	}
	if strings.HasPrefix(tool, "mcp__") {
		if parts := strings.SplitN(tool, "__", 3); len(parts) == 3 {
			return parts[1]
		}
	}
	return ""
}

// A message names the session it goes to, sometimes with a " [ref]" tag that
// tells same-named sessions apart. kttn matches sessions by name, so the
// tag is dropped. Socket addresses and paths name no session and are not sent.
var refTag = regexp.MustCompile(`\s*\[[0-9A-Za-z]+\]$`)

func recipient(to string) string {
	name := strings.TrimSpace(refTag.ReplaceAllString(strings.TrimSpace(to), ""))
	if strings.ContainsAny(name, "/:") {
		return ""
	}
	return name
}

// Wrappers and directory changes say nothing about the work, so the label
// skips them and names the first real program in the command chain.
var skippedWords = map[string]bool{"cd": true, "rtk": true, "proxy": true, "env": true, "sudo": true, "time": true, "nohup": true, "command": true}

func commandName(command string) string {
	replacer := strings.NewReplacer("&&", "\n", "||", "\n", ";", "\n", "|", "\n")
	for _, segment := range strings.Split(replacer.Replace(command), "\n") {
		words := strings.Fields(segment)
		if len(words) > 0 && words[0] == "cd" {
			continue
		}
		for _, word := range words {
			if strings.Contains(word, "=") || skippedWords[word] || strings.HasPrefix(word, "-") {
				continue
			}
			return filepath.Base(strings.Trim(word, "\"'()"))
		}
	}
	return ""
}

// projectName names the repository the session works in, the folder inside
// it and where that repository sits, so moving into a subfolder keeps the
// session in the same area. Outside a repository the folder itself is the
// area and folder is empty; the home folder is called "~". root is the
// area's path relative to home ("" for home) or absolute outside it.
func projectName(cwd string) (name, folder, root string) {
	if cwd == "" {
		return "", "", ""
	}
	clean := filepath.Clean(cwd)
	for dir := clean; ; dir = filepath.Dir(dir) {
		if _, err := os.Stat(filepath.Join(dir, ".git")); err == nil {
			rel, err := filepath.Rel(dir, clean)
			if err != nil || rel == "." {
				rel = ""
			}
			return filepath.Base(dir), filepath.ToSlash(rel), homeRelative(dir)
		}
		if parent := filepath.Dir(dir); parent == dir {
			break
		}
	}
	// The home folder would otherwise show the account name as an area.
	if home, err := os.UserHomeDir(); err == nil && filepath.Clean(home) == clean {
		return "~", "", ""
	}
	return filepath.Base(clean), "", homeRelative(clean)
}

// homeRelative writes dir relative to the home folder, or absolute when it
// lies outside home.
func homeRelative(dir string) string {
	home, err := os.UserHomeDir()
	if err != nil {
		return filepath.ToSlash(dir)
	}
	rel, err := filepath.Rel(filepath.Clean(home), dir)
	if err != nil || rel == ".." || strings.HasPrefix(rel, ".."+string(filepath.Separator)) {
		return filepath.ToSlash(dir)
	}
	if rel == "." {
		return ""
	}
	return filepath.ToSlash(rel)
}
