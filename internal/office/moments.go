package office

// MaxTasks caps a session's checklist.
const MaxTasks = 12

// momentEvents are short happenings kept as the session's last moment. The
// screen plays each one once, when its time changes.
var momentEvents = map[string]bool{
	"SessionStart": true, "SessionEnd": true, "PostToolUseFailure": true,
	"StopFailure": true, "PreCompact": true, "PostCompact": true,
	"TaskCreated": true, "TaskCompleted": true, "TeammateIdle": true,
	"WorktreeRemove": true, "Elicitation": true, "ElicitationResult": true,
	"InstructionsLoaded": true, "ConfigChange": true, "Setup": true,
	"PostModelSwitch": true,
}

// Moment is the last short happening of a session.
type Moment struct {
	Kind   string `json:"kind"`
	Detail string `json:"detail"`
	At     string `json:"at"`
}

// Task is one entry of a session's checklist.
type Task struct {
	ID      string `json:"id"`
	Subject string `json:"subject"`
	Done    bool   `json:"done"`
}

func momentFor(event Event, at string) *Moment {
	if !momentEvents[event.Event] {
		return nil
	}
	return &Moment{Kind: event.Event, Detail: event.Detail, At: at}
}

// nextTasks updates the checklist. A task first seen as completed goes in
// as done; when full, finished tasks leave first.
func nextTasks(tasks []Task, event Event) []Task {
	if event.Event != "TaskCreated" && event.Event != "TaskCompleted" {
		return tasks
	}
	id := event.ToolUseID
	if id == "" {
		return tasks
	}
	done := event.Event == "TaskCompleted"
	list := append([]Task(nil), tasks...)
	for i, task := range list {
		if task.ID == id {
			if event.Detail != "" {
				list[i].Subject = event.Detail
			}
			list[i].Done = task.Done || done
			return list
		}
	}
	list = append(list, Task{ID: id, Subject: event.Detail, Done: done})
	for len(list) > MaxTasks {
		drop := 0
		for i, task := range list {
			if task.Done {
				drop = i
				break
			}
		}
		list = append(list[:drop], list[drop+1:]...)
	}
	return list
}
