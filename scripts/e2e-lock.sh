# Sourced by e2e-install.sh before anything else runs. Every run's isolated
# setup picks the same first free port above the real office, so two runs at
# once would take each other's port. Runs of this user wait their turn; the
# lock sits in /tmp, not $TMPDIR, because each session may have its own.
LOCK="/tmp/kttn-e2e-$(id -u).lock"
waited=0
until mkdir -m 700 "$LOCK" 2>/dev/null; do
  # Someone else's directory under this name is not our lock to wait on.
  [ -O "$LOCK" ] || { echo "REFUSE: $LOCK belongs to another user" >&2; exit 1; }
  holder=$(cat "$LOCK/pid" 2>/dev/null)
  # A dead holder, or no pid a minute after the lock was made, is stale. The
  # pid is read again just before removing, in case another run took over.
  if { [ -n "$holder" ] && ! kill -0 "$holder" 2>/dev/null; } \
    || { [ -z "$holder" ] && [ -n "$(find "$LOCK" -maxdepth 0 -mmin +1)" ]; }; then
    [ "$(cat "$LOCK/pid" 2>/dev/null)" = "$holder" ] && rm -rf "$LOCK"
    continue
  fi
  [ "$waited" -ge 600 ] && { echo "REFUSE: another e2e run (pid ${holder:-?}) has held $LOCK for 10 minutes" >&2; exit 1; }
  [ "$waited" = 0 ] && echo "      waiting for another e2e run (pid ${holder:-?}) to finish"
  sleep 5
  waited=$((waited + 5))
done
echo $$ > "$LOCK/pid"
release_lock() { [ "$(cat "$LOCK/pid" 2>/dev/null)" = "$$" ] && rm -rf "$LOCK"; }

# owns stops the run when the port is not held by the kttn serve it started:
# then every later step would talk to someone else's server.
owns() {
  lsof -nP -a -p "$SERVE_PID" -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1 && return 0
  echo "REFUSE: port $1 is not held by this run's kttn serve (pid $SERVE_PID); something else took it" >&2
  exit 1
}
