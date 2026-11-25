#!/bin/sh
# End-to-end check of the install a real user does, isolated from this
# computer's own kttn: temp HOME, Claude config, kttn config/state and npm
# dirs; launchctl, systemctl, open, xdg-open and osascript are stubs that
# only record (osascript records its stdin after a "|").
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
  release_lock 2>/dev/null
}
trap cleanup EXIT INT TERM
. "$REPO/scripts/e2e-lock.sh"

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
printf '#!/bin/sh\necho "osascript $* | $(cat)" >> "%s/stub.log"\n' "$T" > "$T/stub/osascript"
chmod +x "$T/stub/osascript"
export HOME="$T/home" CLAUDE_CONFIG_DIR="$T/claude"
export KTTN_CONFIG="$T/home/.config/kttn/config.json" KTTN_STATE="$T/home/.local/state/kttn/sessions.json"
export npm_config_cache="$T/npm-cache" npm_config_prefix="$T/npm-prefix" npm_config_update_notifier=false
export PATH="$T/stub:$PATH"
unset KTTN_URL KTTN_TOKEN
if [ "$(command -v launchctl)" != "$T/stub/launchctl" ] || [ "$(command -v systemctl)" != "$T/stub/systemctl" ] \
  || [ "$(command -v osascript)" != "$T/stub/osascript" ] \
  || [ "$HOME" = "$REAL_HOME" ] || [ "$CLAUDE_CONFIG_DIR" = "$REAL_HOME/.claude" ]; then
  echo "REFUSE: isolation is not in place (stubs not first on PATH or HOME not temporary)" >&2
  exit 1
fi
pass "isolation: temp HOME, CLAUDE_CONFIG_DIR, KTTN_CONFIG/STATE, npm dirs, stub launchctl first on PATH"

# Right after a release the registry lags a few minutes; testing the old
# latest against this checkout's checks would fail for no real reason. So
# latest is pinned to the version npm serves once it has caught up.
older() { node -e 'const [a,b]=process.argv.slice(1).map(v=>v.split(".").map(Number));process.exit((a[0]-b[0]||a[1]-b[1]||a[2]-b[2])<0?0:1)' "$1" "$2"; }
if [ "$WANT" = latest ]; then
  CHECKOUT=$(json "$REPO/package.json" 'd.version' | tr -d '"')
  for i in $(seq 1 20); do
    NPM_LATEST=$(npm view @hgwk/kttn version 2>/dev/null)
    [ -n "$NPM_LATEST" ] && ! older "$NPM_LATEST" "$CHECKOUT" && break
    echo "      npm latest is ${NPM_LATEST:-unknown} but the checkout is $CHECKOUT (registry lag?); retry $i/20 in 30s"
    sleep 30
  done
  if [ -z "$NPM_LATEST" ] || older "$NPM_LATEST" "$CHECKOUT"; then
    echo "REFUSE: npm latest (${NPM_LATEST:-unknown}) is older than the checkout ($CHECKOUT); run again later, or pass a version or local" >&2
    exit 1
  fi
  WANT=$NPM_LATEST
fi

# --- install: the one-command setup -----------------------------------------
# settings.json is a symlink into a dotfiles folder, as many people keep it.
mkdir -p "$T/dotfiles"
cat > "$T/dotfiles/claude-settings.json" <<'EOF'
{
    "model": "keep-me",
    "hooks": {"Stop": [{"hooks": [{"type": "command", "command": "echo other-tool"}]}]}
}
EOF
cp "$T/dotfiles/claude-settings.json" "$T/original-settings.json"
ln -s "$T/dotfiles/claude-settings.json" "$T/claude/settings.json"
START=$(date +%s)
if [ "$WANT" = local ]; then
  (cd "$REPO/web" && npm ci --no-audit --no-fund >/dev/null 2>&1 && npm run build >/dev/null 2>&1) \
    && (cd "$REPO" && CGO_ENABLED=0 go build -trimpath -o "$T/local/kttn" ./cmd/kttn) || { fail "local build"; exit 1; }
  KTTN="$T/local/kttn"
  run_setup() { (cd "$T/work" && "$KTTN"); }
else
  run_setup() { (cd "$T/work" && npx -y "@hgwk/kttn@$WANT"); }
fi
printf 'E2E kttn\nen\nn\n' | run_setup > "$T/setup1.log" 2>&1
check "setup: first run finishes and names the kttn address" "grep -q 'kttn is open at' '$T/setup1.log'" "see setup output"
[ "$WANT" = local ] || KTTN="$T/home/.local/bin/kttn"
check "setup: npx binary copied to a stable path" "[ -x '$KTTN' ]"
# The plist may name the path as setup saw it or resolved (macOS /var is
# /private/var), so both are accepted.
KTTN_SEEN=$KTTN
KTTN=$(node -e 'try{console.log(require("fs").realpathSync(process.argv[1]))}catch{console.log(process.argv[1])}' "$KTTN")
VERSION=$("$KTTN" version 2>/dev/null); echo "      under test: $VERSION"
# Newer behaviour is checked by the version under test: pass on npm latest and the next release alike.
since() { ! older "${VERSION#kttn }" "$1"; }
NAMEKEY=$(since 0.14.0 && echo kttn_name || echo office_name)

CFG=$KTTN_CONFIG
check "config: written with mode 600" "[ \"\$(stat -f %Lp '$CFG' 2>/dev/null || stat -c %a '$CFG')\" = 600 ]"
check "config: kttn name and language from stdin" "[ \"\$(json '$CFG' 'd.$NAMEKEY+\"/\"+d.lang')\" = '\"E2E kttn/en\"' ]"
check "config: token and screen key present, answer preview and messages off" "json '$CFG' 'd.token.length>=32 && d.screen_key.length>=32 && d.preview===false && d.messages===false' | grep -q true"
PORT=$(json "$CFG" 'd.port')
TOKEN=$(json "$CFG" 'd.token' | tr -d '"')
SKEY=$(json "$CFG" 'd.screen_key||""' | tr -d '"')
PORT_FREE=1
lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1 && PORT_FREE=0
check "config: port $PORT is not in use by anything else" "[ $PORT_FREE = 1 ]" "setup chose a port another kttn holds; serve, signal and screen steps are skipped"

S="$CLAUDE_CONFIG_DIR/settings.json"
EVENTS=$(json "$REPO/plugin/hooks/hooks.json" 'Object.keys(d.hooks).sort().join(",")')
check "hooks: settings.json has exactly the plugin's 24 events with one kttn entry each" \
  "[ \"\$(json '$S' 'Object.keys(d.hooks).sort().join(\",\")')\" = '$EVENTS' ] && json '$S' 'Object.values(d.hooks).every(l=>l.filter(e=>/kttn.* hook( |\$)/.test(e.hooks[0].command)).length===1)' | grep -q true"
check "hooks: a symlinked settings.json stays a link, written through to its target" "[ -L '$S' ] && grep -q 'kttn' '$T/dotfiles/claude-settings.json'"
check "hooks: the original settings kept as .bak beside the link, not in the dotfiles, indentation kept" "cmp -s '$T/original-settings.json' '$S.bak' && [ ! -e '$T/dotfiles/claude-settings.json.bak' ] && grep -q '^    \"model\"' '$T/dotfiles/claude-settings.json'"
check "hooks: other keys and other tools' hooks kept" \
  "json '$S' 'd.model===\"keep-me\" && d.hooks.Stop.some(e=>e.hooks[0].command===\"echo other-tool\")' | grep -q true"

PLIST="$HOME/Library/LaunchAgents/io.github.hgwk.kttn.plist"
UNIT="$HOME/.config/systemd/user/kttn.service"
if [ "$(uname)" = Darwin ]; then
  check "autostart: LaunchAgent plist names the label, binary + serve, and the log" \
    "grep -q '<string>io.github.hgwk.kttn</string>' '$PLIST' && grep -q -e '<string>$KTTN</string>' -e '<string>$KTTN_SEEN</string>' '$PLIST' && grep -q '<string>serve</string>' '$PLIST' && grep -q '.local/state/kttn/serve.log' '$PLIST'"
  check "autostart: the service PATH includes Homebrew" "grep -q '<string>[^<]*/opt/homebrew/bin:' '$PLIST'"
  check "autostart: the service reads the config setup used" "grep -A1 '<key>KTTN_CONFIG</key>' '$PLIST' | grep -q 'kttn/config.json</string>'"
  check "autostart: stub launchctl saw bootout then bootstrap" \
    "grep -n 'launchctl' '$T/stub.log' | head -2 | tr '\n' ' ' | grep -q 'bootout.*bootstrap'"
else
  check "autostart: systemd user unit runs the binary with serve" "grep -q 'serve' '$UNIT'"
  check "autostart: stub systemctl saw daemon-reload, enable, restart" "grep -q 'restart kttn.service' '$T/stub.log'"
  check "autostart: the service reads the config setup used" "grep -q 'Environment=\"KTTN_CONFIG=' '$UNIT'"
fi
# The key never goes on a command line, where other users could read it.
if [ "$(uname)" = Darwin ]; then
  check "setup: opened kttn with the screen key through osascript's stdin" "[ -n '$SKEY' ] && grep -q '^osascript - | open location \"http://127.0.0.1:$PORT/#k=$SKEY\"' '$T/stub.log'"
else
  check "setup: opened kttn through a private redirect page" "[ -n '$SKEY' ] && grep -q 'xdg-open .*open.html' '$T/stub.log' && grep -q '#k=$SKEY' \"\$(dirname '$KTTN_STATE')/open.html\" && [ \"\$(stat -c %a \"\$(dirname '$KTTN_STATE')/open.html\")\" = 600 ]"
fi
check "setup: no command line carried the screen key" "! grep -v '^osascript - |' '$T/stub.log' | grep -q '$SKEY'"

printf '' | run_setup > "$T/setup2.log" 2>&1
check "rerun: asks nothing and keeps the token" "! grep -q 'kttn name' '$T/setup2.log' && [ \"\$(json '$CFG' 'd.token' | tr -d '\"')\" = '$TOKEN' ]"
check "rerun: the original .bak is not replaced" "cmp -s '$T/original-settings.json' '$S.bak'"
check "rerun: hooks still one set" "json '$S' 'Object.values(d.hooks).every(l=>l.filter(e=>/kttn.* hook( |\$)/.test(e.hooks[0].command)).length===1)' | grep -q true"

# --- a real signal ----------------------------------------------------------
# Never talk to a server this run did not start: if setup picked a port that
# is already taken, the signal and screen steps would hit someone else's kttn.
if [ "$PORT_FREE" = 1 ]; then
# A config from 0.13 or earlier says office_name: serve keeps the name, and init saves it as kttn_name (office_name too, for one release).
since 0.14.0 && node -e 'const f=process.argv[1],d=JSON.parse(require("fs").readFileSync(f));d.office_name=d.kttn_name;delete d.kttn_name;require("fs").writeFileSync(f,JSON.stringify(d),{mode:0o600})' "$CFG"
"$KTTN" serve > "$T/serve.log" 2>&1 &
SERVE_PID=$!
KH="X-Kttn-Key: $SKEY"
for _ in 1 2 3 4 5 6 7 8 9 10; do curl -sf -H "$KH" "http://127.0.0.1:$PORT/api/snapshot" >/dev/null && break; sleep 0.3; done
owns "$PORT"
check "serve: answers on the test port $PORT" "curl -sf -H '$KH' http://127.0.0.1:$PORT/api/snapshot"
check "screen key: snapshot without the key is refused" "[ \"\$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:$PORT/api/snapshot)\" = 401 ]"
# Rerunning while kttn runs must not move it: the hooks would follow
# the new port and the running kttn would hear nothing.
printf '' | run_setup > "$T/setup3.log" 2>&1
"$KTTN" init --yes > "$T/init-live.log" 2>&1
since 0.14.0 && check "config: an old office_name keeps the name on screen, and init saves kttn_name" "curl -s -H '$KH' http://127.0.0.1:$PORT/api/snapshot | grep -q '\"kttnName\":\"E2E kttn\"' && [ \"\$(json '$CFG' 'd.kttn_name+\"/\"+d.office_name')\" = '\"E2E kttn/E2E kttn\"' ]"
check "rerun: setup and init with kttn running keep port $PORT" "[ \"\$(json '$CFG' 'd.port')\" = '$PORT' ] && ! grep -q 'taken' '$T/setup3.log' '$T/init-live.log'"
check "screen key: a message forged with the right Origin but no key is refused" \
  "[ \"\$(curl -s -o /dev/null -w '%{http_code}' -H 'Origin: http://127.0.0.1:$PORT' -H 'Content-Type: application/json' -d '{\"key\":\"x\",\"text\":\"!id\"}' http://127.0.0.1:$PORT/api/message)\" = 401 ]"

SECRET="e2e-secret-prompt-$$"
SIGNAL=payload
if [ "${KTTN_E2E_CLAUDE:-1}" = 1 ] && command -v claude >/dev/null 2>&1; then
  # Headless sessions leave kttn at SessionEnd, so this run hooks only
  # the events it checks, from a settings file of its own.
  node -e '
const s=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));
const keep=["SessionStart","UserPromptSubmit","Stop"];
s.hooks=Object.fromEntries(keep.map(k=>[k,s.hooks[k].filter(e=>/kttn.* hook( |$)/.test(e.hooks[0].command))]));
// A headless session leaves kttn once its process exits, so Stop holds
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
[ "$SIGNAL" = payload ] && . "$REPO/scripts/e2e-catalog.sh"

# --- screen -------------------------------------------------------------------
for p in / /manifest.webmanifest /icons/kttn-icon-192.png /icons/kttn-icon-512.png /icons/kttn-icon-maskable-512.png; do
  check "screen: GET $p is 200" "[ \"\$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:$PORT$p)\" = 200 ]"
done
check "screen: frame-ancestors is kttn itself only by default" "curl -sI http://127.0.0.1:$PORT/ | tr -d '\r' | grep -qix \"content-security-policy: frame-ancestors 'self'\""
check "screen: a foreign Host is refused" "[ \"\$(curl -s -o /dev/null -w '%{http_code}' -H 'Host: evil.example' http://127.0.0.1:$PORT/)\" = 403 ]"
check "screen: an event without the token is refused" \
  "[ \"\$(curl -s -o /dev/null -w '%{http_code}' -H 'Content-Type: application/json' -d '{}' http://127.0.0.1:$PORT/api/events)\" = 401 ]"

msg() { curl -s -o /dev/null -w '%{http_code}' -H "$KH" -H "Origin: http://127.0.0.1:$PORT" -H 'Content-Type: application/json' -d '{"key":"claude|no-such-session","text":"hi"}' "http://127.0.0.1:$PORT/api/message"; }
check "messages: off by default, a keyed message is refused with 403" "[ \"\$(msg)\" = 403 ]"
kill "$SERVE_PID" 2>/dev/null; SERVE_PID=""
"$KTTN" init --yes --messages >/dev/null 2>&1
"$KTTN" serve > "$T/serve2.log" 2>&1 &
SERVE_PID=$!
for _ in 1 2 3 4 5 6 7 8 9 10; do curl -sf -H "$KH" "http://127.0.0.1:$PORT/api/snapshot" >/dev/null && break; sleep 0.3; done
owns "$PORT"
check "messages: after kttn init --messages the gate opens (unknown session gets 404, not 403)" "[ \"\$(msg)\" = 404 ]"
kill "$SERVE_PID" 2>/dev/null; SERVE_PID=""
else
  SIGNAL=skipped
fi

# --- npm -g -------------------------------------------------------------------
# A global install runs setup from node_modules; hooks and the service must
# end up on the stable copy, not inside npm's tree.
if [ "$WANT" != local ]; then
  npm i -g "@hgwk/kttn@$WANT" >/dev/null 2>&1
  (cd "$T/work" && "$T/npm-prefix/bin/kttn" setup) > "$T/setup-global.log" 2>&1
  check "npm -g: hooks and the login service do not point into node_modules" \
    "! grep -q node_modules '$S' && ! grep -q node_modules '$PLIST' '$UNIT' 2>/dev/null && grep -q '.local/bin/kttn' '$S'"
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

. "$REPO/scripts/e2e-xdg.sh"

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
