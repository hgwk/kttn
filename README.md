# kttn

kttn shows the Claude Code sessions running on your computer as pixel cats in an
office. Each repository gets an office, each folder a room, each session a cat at
a desk. A cat reads, edits, runs commands, waits for you, naps and goes home as
its session does.

Everything stays on your computer. A Claude Code hook sends short labels to a
small server on `127.0.0.1`, and the screen is a page that server serves.

The screen speaks Korean, English and Japanese.

## What leaves a session

The hook sends one small event per hook call, and only these fields:

- the session ID, the repository name, the folder inside it, and where the
  repository sits relative to your home folder (`~` instead of your account name)
- the hook event and tool name
- one short label: a file's base name, a command's first program (`go`, `npm`),
  a web host, a subagent type, an MCP server name, or the name of the session a
  message goes to
- for a few events, a one-word reason: `startup`, `rate_limit`, `auto`, a task
  title, a model name
- on `SessionStart` and `UserPromptSubmit`, the Claude Code process ID and the
  session's name, so a closed terminal can be noticed

It never sends prompts, file contents, command arguments, error texts or message
bodies.

**Answer preview (off by default).** If you turn it on in `kttn init`, `Stop`
also carries the first 300 characters of the answer the session just finished,
so the cat can say what it did. The server keeps only the latest one per
session, in memory and in its local state file.

## Install

Build from source (Go 1.22+, Node 22.12+):

```sh
git clone https://github.com/hgwk/kttn && cd kttn
npm --prefix web ci && npm --prefix web run build   # the screen, embedded into the binary
go build -o ~/.local/bin/kttn ./cmd/kttn             # any folder on your PATH
```

Then set it up and start the office:

```sh
kttn init    # office name, language, port, answer preview; writes ~/.config/kttn/config.json
kttn serve   # http://127.0.0.1:5886
```

Open the address in Chrome. You can install it as an app (⊕ in the address
bar) to get its own window and Dock icon.

### Connect Claude Code

Install the plugin, which registers the hook for all 24 events it uses:

```text
/plugin marketplace add hgwk/kttn
/plugin install kttn@kttn
```

The hook runs `kttn hook`, so `kttn` must be on the `PATH` Claude Code sees.
If the server is not running, the hook gives up after 300 ms and the session
carries on; it never prints anything and never blocks a session.

The plugin does not hook `WorktreeCreate`, because a hook there replaces Claude
Code's own worktree creation.

## Commands

| Command | What it does |
| --- | --- |
| `kttn init [--yes] [--office-name NAME] [--home-repo REPO] [--lang ko\|en\|ja] [--port N] [--preview]` | Asks for the settings (or takes flags with `--yes`), keeps earlier answers as defaults, picks another port if the one you want is taken by something else, and generates the token the hook and the server share. |
| `kttn serve [--port N]` | Runs the office on `127.0.0.1`. |
| `kttn hook [--url URL] [--source claude] [--timeout 300ms]` | The Claude Code hook. Reads a hook payload on stdin. |

Config lives in `~/.config/kttn/config.json` (mode 600; `KTTN_CONFIG` moves
it). `KTTN_URL` and `KTTN_TOKEN` override the hook's address and token.
Sessions survive a restart through `~/.local/state/kttn/sessions.json`
(`KTTN_STATE` moves it).

The screen language follows `?lang=` in the address, then the config, then the
browser, and falls back to English.

## Machine room: automation runs

Anything on your computer can show its runs in the machine room by posting JSON
to the server, with the same token as the hook:

```sh
curl -s http://127.0.0.1:5886/api/automation \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $(jq -r .token ~/.config/kttn/config.json)" \
  -d '{"key":"nightly-42","label":"Nightly build","state":"running","started_at":"2026-11-24T09:00:00Z"}'
```

`state` is `running`, `ok`, `failed` or `held` (`held_count` says how many items
wait). Send the same `key` again with `ended_at` when the run ends. Finished runs
stay for 30 minutes; the room shows up to 8.

## Terminal tabs

Click a cat and the butler walks over and brings that session's terminal tab to
the front. Click its speech bubble to type a message into the session's input;
Enter is pressed for you.

kttn finds the tab from the session's process: process → tty → the terminal
pane on that tty. It tries, in order:

| Terminal | Bring forward | Message |
| --- | --- | --- |
| tmux | selects the window and pane (not the app around it) | `send-keys` |
| Kaku, WezTerm | `cli activate-pane`, then raises the app | `cli send-text` |
| iTerm2 | AppleScript, by the session's `tty` | AppleScript `write text` |
| Terminal.app | AppleScript, by the tab's `tty` | not supported (needs accessibility permission) |

A terminal that is not installed or not running is skipped; one that is not
running is never launched. AppleScript asks for automation permission the first
time. For tmux, `tmux` must be on the `PATH` of `kttn serve`.

Messages are limited to 2,000 characters, control characters are removed, and
nothing is sent to a session that is waiting on a permission prompt (the text
would answer it) or has ended. A busy session takes the message as its next
turn. Message text is never logged.

## Safety

The server listens on `127.0.0.1` only and refuses any request addressed to a
host name other than `127.0.0.1` or `localhost`, which blocks DNS rebinding.
Reports (`/api/events`, `/api/automation`) must be JSON, must carry the token,
and must not carry an `Origin` header, so a web page in your browser cannot forge
sessions. Screen actions (`/api/focus`, `/api/message`) must be JSON from a page
on the same address, so another site cannot type into your terminal.

## Development

```sh
go vet ./... && go test ./...
npm --prefix web test && npm --prefix web run typecheck
npm --prefix web run dev    # screen with hot reload, proxying /api to kttn serve
```

Source files stay at or below 300 lines.

## Not yet

- Messaging through Claude Code Channels instead of the terminal. Channels is a
  research preview that loads custom channels only with a development flag, so
  kttn types into the terminal for now.
- Codex sessions. A Codex hook that posts the same event shape would show up in
  the office with `--source codex`.

## Licenses

See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for the fonts and UI
components kttn ships.
