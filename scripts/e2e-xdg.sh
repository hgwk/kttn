# Sourced by e2e-install.sh after removal: setup with XDG folders only, in
# the same temp HOME, stubs and helpers (check, json, KTTN, PLIST, UNIT).
# --- XDG folders only ----------------------------------------------------------
# The login service gets none of the shell's variables, so setup must pin it
# to the config it wrote, or the service reads ~/.config and refuses events.
XC="$T/xdg-config" XS="$T/xdg-state"
printf 'XDG Office\nen\nn\n' | (cd "$T/work" && env -u KTTN_CONFIG -u KTTN_STATE XDG_CONFIG_HOME="$XC" XDG_STATE_HOME="$XS" \
  CLAUDE_CONFIG_DIR="$T/claude-xdg" "$KTTN" setup) > "$T/setup-xdg.log" 2>&1
SVC=$(cat "$PLIST" "$UNIT" 2>/dev/null)
check "xdg: the service is pinned to the XDG config and state setup wrote" "[ -f '$XC/kttn/config.json' ] && echo \"\$SVC\" | grep -q '$XC/kttn/config.json' && echo \"\$SVC\" | grep -q '$XS/kttn/sessions.json'"
# A session from an IDE or the desktop app has no XDG_* either: the hook
# command setup wrote must still find the office.
XPORT=$(json "$XC/kttn/config.json" 'd.port')
if ! lsof -nP -iTCP:"$XPORT" -sTCP:LISTEN >/dev/null 2>&1; then
  KTTN_CONFIG="$XC/kttn/config.json" KTTN_STATE="$XS/kttn/sessions.json" "$KTTN" serve > "$T/serve-xdg.log" 2>&1 &
  SERVE_PID=$!
  XKEY="X-Kttn-Key: $(json "$XC/kttn/config.json" 'd.screen_key' | tr -d '"')"
  for _ in 1 2 3 4 5 6 7 8 9 10; do curl -sf -H "$XKEY" "http://127.0.0.1:$XPORT/api/snapshot" >/dev/null && break; sleep 0.3; done
  HOOK_CMD=$(json "$T/claude-xdg/settings.json" 'd.hooks.Stop.find(e=>/kttn/.test(e.hooks[0].command)).hooks[0].command' | node -e 'process.stdin.on("data",d=>process.stdout.write(JSON.parse(d)))')
  printf '{"session_id":"xdg-%s","cwd":"%s","hook_event_name":"Stop"}' "$$" "$T/work" \
    | (cd / && env -u XDG_CONFIG_HOME -u XDG_STATE_HOME -u KTTN_CONFIG -u KTTN_STATE sh -c "$HOOK_CMD")
  check "xdg: the hook setup wrote reaches the office without the shell's XDG variables" \
    "curl -s -H '$XKEY' http://127.0.0.1:$XPORT/api/snapshot | grep -q '\"xdg-$$'"
  kill "$SERVE_PID" 2>/dev/null; SERVE_PID=""
fi

