#!/bin/sh
# End-to-end check of the install a real user does, isolated from this
# computer's own kttn: temp HOME, Claude config, kttn config/state and npm
# dirs; launchctl, systemctl, open and xdg-open are stubs that only record.
#
#   scripts/e2e-install.sh             # npx @hgwk/kttn@latest
#   scripts/e2e-install.sh 0.2.0       # a published version
#   scripts/e2e-install.sh local       # this checkout, built here
#
# KTTN_E2E_CLAUDE=0 skips the real `claude -p` signal and pipes a hook
# payload into `kttn hook` instead. Prints PASS/FAIL per step, exits 0 or 1.
set -u
REPO=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
WANT=${1:-latest}
TMPD=${TMPDIR:-/tmp}
T=$(mktemp -d "${TMPD%/}/kttn-e2e.XXXXXX")
REAL_HOME=$HOME
# Files of this computer's own kttn that the run must leave alone.
GUARDED="$REAL_HOME/.claude/settings.json $REAL_HOME/.config/kttn/config.json $REAL_HOME/Library/LaunchAgents/io.github.hgwk.kttn.plist"
sums() { for f in $GUARDED; do [ -f "$f" ] && cksum < "$f" || echo none; done; }
BEFORE=$(sums)
FAILS=0
STEPS=0
SERVE_PID=""

cleanup() {
  [ -n "$SERVE_PID" ] && kill "$SERVE_PID" 2>/dev/null
  rm -rf "$T"
}
trap cleanup EXIT INT TERM

pass() { STEPS=$((STEPS + 1)); echo "PASS  $1"; }
fail() { STEPS=$((STEPS + 1)); FAILS=$((FAILS + 1)); echo "FAIL  $1${2:+  ($2)}"; }
check() { if eval "$2" >/dev/null 2>&1; then pass "$1"; else fail "$1" "${3:-}"; fi; }
with_timeout() { secs=$1; shift; perl -e 'alarm shift; exec @ARGV' "$secs" "$@"; }
json() { node -e "const d=JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'));console.log(JSON.stringify(eval(process.argv[2])))" "$1" "$2"; }

# --- isolation -------------------------------------------------------------
mkdir -p "$T/home" "$T/claude" "$T/stub" "$T/npm-cache" "$T/npm-prefix" "$T/work"
for tool in launchctl systemctl open xdg-open; do
  printf '#!/bin/sh\necho "%s $*" >> "%s/stub.log"\n' "$tool" "$T" > "$T/stub/$tool"
  chmod +x "$T/stub/$tool"
done
export HOME="$T/home" CLAUDE_CONFIG_DIR="$T/claude"
export KTTN_CONFIG="$T/home/.config/kttn/config.json" KTTN_STATE="$T/home/.local/state/kttn/sessions.json"
export npm_config_cache="$T/npm-cache" npm_config_prefix="$T/npm-prefix" npm_config_update_notifier=false
export PATH="$T/stub:$PATH"
unset KTTN_URL KTTN_TOKEN
if [ "$(command -v launchctl)" != "$T/stub/launchctl" ] || [ "$(command -v systemctl)" != "$T/stub/systemctl" ] \
  || [ "$HOME" = "$REAL_HOME" ] || [ "$CLAUDE_CONFIG_DIR" = "$REAL_HOME/.claude" ]; then
  echo "REFUSE: isolation is not in place (stubs not first on PATH or HOME not temporary)" >&2
  exit 1
fi
pass "isolation: temp HOME, CLAUDE_CONFIG_DIR, KTTN_CONFIG/STATE, npm dirs, stub launchctl first on PATH"

# --- install: the one-command setup -----------------------------------------
cat > "$T/claude/settings.json" <<'EOF'
{"model": "keep-me", "hooks": {"Stop": [{"hooks": [{"type": "command", "command": "echo other-tool"}]}]}}
EOF
START=$(date +%s)
if [ "$WANT" = local ]; then
  (cd "$REPO/web" && npm ci --no-audit --no-fund >/dev/null 2>&1 && npm run build >/dev/null 2>&1) \
    && (cd "$REPO" && CGO_ENABLED=0 go build -trimpath -o "$T/local/kttn" ./cmd/kttn) || { fail "local build"; exit 1; }
  KTTN="$T/local/kttn"
  run_setup() { (cd "$T/work" && "$KTTN"); }
else
  run_setup() { (cd "$T/work" && npx -y "@hgwk/kttn@$WANT"); }
fi
printf 'E2E Office\nen\n' | run_setup > "$T/setup1.log" 2>&1
check "setup: first run finishes and names the office address" "grep -q 'The office is at' '$T/setup1.log'" "see setup output"
[ "$WANT" = local ] || KTTN="$T/home/.local/bin/kttn"
check "setup: npx binary copied to a stable path" "[ -x '$KTTN' ]"
# The plist may name the path as setup saw it or resolved (macOS /var is
# /private/var), so both are accepted.
KTTN_SEEN=$KTTN
KTTN=$(node -e 'try{console.log(require("fs").realpathSync(process.argv[1]))}catch{console.log(process.argv[1])}' "$KTTN")
VERSION=$("$KTTN" version 2>/dev/null)
echo "      under test: $VERSION"

CFG=$KTTN_CONFIG
check "config: written with mode 600" "[ \"\$(stat -f %Lp '$CFG' 2>/dev/null || stat -c %a '$CFG')\" = 600 ]"
check "config: office name and language from stdin" "[ \"\$(json '$CFG' 'd.office_name+\"/\"+d.lang')\" = '\"E2E Office/en\"' ]"
check "config: token present, answer preview off" "json '$CFG' 'd.token.length>=32 && d.preview===false' | grep -q true"
PORT=$(json "$CFG" 'd.port')
TOKEN=$(json "$CFG" 'd.token' | tr -d '"')
SKEY=$(json "$CFG" 'd.screen_key||""' | tr -d '"')
PORT_FREE=1
lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1 && PORT_FREE=0
check "config: port $PORT is not in use by anything else" "[ $PORT_FREE = 1 ]" "setup chose a port another kttn holds; serve, signal and screen steps are skipped"

S="$CLAUDE_CONFIG_DIR/settings.json"
EVENTS=$(json "$REPO/plugin/hooks/hooks.json" 'Object.keys(d.hooks).sort().join(",")')
check "hooks: settings.json has exactly the plugin's 24 events with one kttn entry each" \
  "[ \"\$(json '$S' 'Object.keys(d.hooks).sort().join(\",\")')\" = '$EVENTS' ] && json '$S' 'Object.values(d.hooks).every(l=>l.filter(e=>/kttn.* hook\$/.test(e.hooks[0].command)).length===1)' | grep -q true"
check "hooks: other keys and other tools' hooks kept" \
  "json '$S' 'd.model===\"keep-me\" && d.hooks.Stop.some(e=>e.hooks[0].command===\"echo other-tool\")' | grep -q true"

PLIST="$HOME/Library/LaunchAgents/io.github.hgwk.kttn.plist"
UNIT="$HOME/.config/systemd/user/kttn.service"
if [ "$(uname)" = Darwin ]; then
  check "autostart: LaunchAgent plist names the label, binary + serve, and the log" \
    "grep -q '<string>io.github.hgwk.kttn</string>' '$PLIST' && grep -q -e '<string>$KTTN</string>' -e '<string>$KTTN_SEEN</string>' '$PLIST' && grep -q '<string>serve</string>' '$PLIST' && grep -q '.local/state/kttn/serve.log' '$PLIST'"
  check "autostart: stub launchctl saw bootout then bootstrap" \
    "grep -n 'launchctl' '$T/stub.log' | head -2 | tr '\n' ' ' | grep -q 'bootout.*bootstrap'"
else
  check "autostart: systemd user unit runs the binary with serve" "grep -q 'serve' '$UNIT'"
  check "autostart: stub systemctl saw daemon-reload, enable, restart" "grep -q 'restart kttn.service' '$T/stub.log'"
fi
check "setup: stub opened the office with the screen key" "[ -n '$SKEY' ] && grep -q 'open http://127.0.0.1:$PORT/#k=$SKEY' '$T/stub.log'"

printf '' | run_setup > "$T/setup2.log" 2>&1
check "rerun: asks nothing and keeps the token" "! grep -q 'Office name' '$T/setup2.log' && [ \"\$(json '$CFG' 'd.token' | tr -d '\"')\" = '$TOKEN' ]"
check "rerun: hooks still one set" "json '$S' 'Object.values(d.hooks).every(l=>l.filter(e=>/kttn.* hook\$/.test(e.hooks[0].command)).length===1)' | grep -q true"

# --- a real signal ----------------------------------------------------------
# Never talk to a server this run did not start: if setup picked a port that
# is already taken, the signal and screen steps would hit someone else's kttn.
if [ "$PORT_FREE" = 1 ]; then
"$KTTN" serve > "$T/serve.log" 2>&1 &
SERVE_PID=$!
KH="X-Kttn-Key: $SKEY"
for _ in 1 2 3 4 5 6 7 8 9 10; do curl -sf -H "$KH" "http://127.0.0.1:$PORT/api/snapshot" >/dev/null && break; sleep 0.3; done
check "serve: answers on the test port $PORT" "curl -sf -H '$KH' http://127.0.0.1:$PORT/api/snapshot"
check "screen key: snapshot without the key is refused" "[ \"\$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:$PORT/api/snapshot)\" = 401 ]"
check "screen key: a message forged with the right Origin but no key is refused" \
  "[ \"\$(curl -s -o /dev/null -w '%{http_code}' -H 'Origin: http://127.0.0.1:$PORT' -H 'Content-Type: application/json' -d '{\"key\":\"x\",\"text\":\"!id\"}' http://127.0.0.1:$PORT/api/message)\" = 401 ]"

SECRET="e2e-secret-prompt-$$"
SIGNAL=payload
if [ "${KTTN_E2E_CLAUDE:-1}" = 1 ] && command -v claude >/dev/null 2>&1; then
  # Headless sessions leave the office at SessionEnd, so this run hooks only
  # the events it checks, from a settings file of its own.
  node -e '
const s=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));
const keep=["SessionStart","UserPromptSubmit","Stop"];
s.hooks=Object.fromEntries(keep.map(k=>[k,s.hooks[k].filter(e=>/kttn.* hook$/.test(e.hooks[0].command))]));
// A headless session leaves the office once its process exits, so Stop holds
// the process for a moment while the snapshot is read.
s.hooks.Stop.push({hooks:[{type:"command",command:"sleep 3",timeout:5}]});
require("fs").writeFileSync(process.argv[2],JSON.stringify(s));' "$S" "$T/run-settings.json"
  # Claude Code needs the real login, so it runs with the real HOME, but it
  # loads project settings only (the work folder has none): this computer's
  # own hooks and plugins stay off, and the run keeps no session history.
  ( while :; do curl -s -H "$KH" "http://127.0.0.1:$PORT/api/snapshot" > "$T/snap.poll" && grep -q '"state":"done"' "$T/snap.poll" && cp "$T/snap.poll" "$T/snap.claude"; sleep 0.3; done ) &
  POLL_PID=$!
  if (cd "$T/work" && unset CLAUDE_CONFIG_DIR && HOME="$REAL_HOME" with_timeout 90 claude -p "Reply with the word ok. $SECRET" \
      --model haiku --setting-sources project --settings "$T/run-settings.json" \
      --strict-mcp-config --no-session-persistence > "$T/claude.log" 2>&1); then
    SIGNAL=claude
    kill "$POLL_PID" 2>/dev/null
  else
    kill "$POLL_PID" 2>/dev/null
    echo "      claude -p did not run ($(tail -1 "$T/claude.log" | cut -c1-120)); using a hook payload"
  fi
fi
if [ "$SIGNAL" = payload ]; then
  for ev in SessionStart UserPromptSubmit Stop; do
    printf '{"session_id":"e2e-%s","cwd":"%s","hook_event_name":"%s","prompt":"%s","last_assistant_message":"%s","model":"claude-haiku-5-5"}' \
      "$$" "$T/work" "$ev" "$SECRET" "$SECRET" | "$KTTN" hook
  done
fi
echo "      signal source: $SIGNAL"
sleep 0.5
if [ "$SIGNAL" = claude ] && [ -s "$T/snap.claude" ]; then
  cp "$T/snap.claude" "$T/snap.json"
else
  curl -s -H "$KH" "http://127.0.0.1:$PORT/api/snapshot" > "$T/snap.json"
fi
check "signal: the session shows up done" "json '$T/snap.json' 'd.agents.some(a=>a.state===\"done\")' | grep -q true"
if [ "$SIGNAL" = payload ]; then
  check "signal: model filled in" "json '$T/snap.json' 'd.agents.some(a=>a.model)' | grep -q true"
else
  # claude -p sends no model on SessionStart, and Stop reads it from the
  # transcript, which this run does not keep.
  echo "SKIP  signal: model (claude -p keeps no transcript here)"
fi
if [ "$SIGNAL" = claude ]; then
  check "signal: Claude Code pid filled in" "json '$T/snap.json' 'd.agents.some(a=>a.pid>1)' | grep -q true"
fi
check "privacy: no prompt or answer text reached the server" "! grep -q '$SECRET' '$T/snap.json' '$KTTN_STATE'"

# --- screen -------------------------------------------------------------------
for p in / /manifest.webmanifest /icons/office-icon-192.png /icons/office-icon-512.png /icons/office-icon-maskable-512.png; do
  check "screen: GET $p is 200" "[ \"\$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:$PORT$p)\" = 200 ]"
done
check "screen: frame-ancestors header" "curl -sI http://127.0.0.1:$PORT/ | grep -qi \"content-security-policy: frame-ancestors 'self'\""
check "screen: a foreign Host is refused" "[ \"\$(curl -s -o /dev/null -w '%{http_code}' -H 'Host: evil.example' http://127.0.0.1:$PORT/)\" = 403 ]"
check "screen: an event without the token is refused" \
  "[ \"\$(curl -s -o /dev/null -w '%{http_code}' -H 'Content-Type: application/json' -d '{}' http://127.0.0.1:$PORT/api/events)\" = 401 ]"

kill "$SERVE_PID" 2>/dev/null; SERVE_PID=""
else
  SIGNAL=skipped
fi

# --- removal ------------------------------------------------------------------
"$KTTN" uninstall > "$T/uninstall.log" 2>&1
check "uninstall: kttn hooks gone, other tools' hooks kept" \
  "! grep -q 'kttn' '$S' && json '$S' 'd.hooks.Stop.length===1 && d.model===\"keep-me\"' | grep -q true"
if [ "$(uname)" = Darwin ]; then
  check "uninstall: plist removed and launchctl bootout recorded" "[ ! -e '$PLIST' ] && tail -1 '$T/stub.log' | grep -q 'launchctl bootout'"
else
  check "uninstall: unit removed and disabled" "[ ! -e '$UNIT' ] && grep -q 'disable --now' '$T/stub.log'"
fi
if [ "$PORT_FREE" = 1 ]; then
  check "uninstall: config and session state stay" "[ -f '$CFG' ] && [ -f '$KTTN_STATE' ]"
else
  check "uninstall: config stays" "[ -f '$CFG' ]"
fi

# --- plugin path --------------------------------------------------------------
if command -v claude >/dev/null 2>&1; then
  check "plugin: claude plugin validate" "claude plugin validate '$REPO/plugin' && claude plugin validate '$REPO'"
fi
CLAUDE_CONFIG_DIR="$T/claude-plugin" "$KTTN" install >/dev/null 2>&1
check "plugin: hooks.json events match what the binary installs" \
  "[ \"\$(json '$T/claude-plugin/settings.json' 'Object.keys(d.hooks).sort().join(\",\")')\" = '$EVENTS' ]"

# --- isolation held -------------------------------------------------------------
check "isolation: the real settings.json, kttn config and LaunchAgent are unchanged" "[ \"\$(sums)\" = \"\$BEFORE\" ]"

echo "SUMMARY: $([ $FAILS -eq 0 ] && echo PASS || echo FAIL) $((STEPS - FAILS))/$STEPS steps, $VERSION, signal=$SIGNAL, $(( $(date +%s) - START ))s"
[ $FAILS -eq 0 ]
