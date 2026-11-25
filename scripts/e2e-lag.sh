# Sourced by e2e-install.sh. Right after a release the registry lags a few
# minutes: the dist-tag and metadata can name the new version while its
# tarball still answers 404, and npx then fails every later step. So
# latest is pinned to the version npm serves once it has caught up, and
# any npm version waits until its tarball downloads (up to 10 minutes).
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
if [ "$WANT" != local ]; then
  # A version npm does not list at all is a typo (or a publish seconds ago):
  # refuse at once rather than wait out the lag loop.
  if ! npm view @hgwk/kttn versions --json 2>/dev/null | grep -q "\"$WANT\""; then
    echo "REFUSE: @hgwk/kttn@$WANT is not on npm; check the version, or run again in a few minutes" >&2
    exit 1
  fi
  status() { curl -sIL -o /dev/null -w '%{http_code}' "$1"; }
  TARBALL=$(npm view "@hgwk/kttn@$WANT" dist.tarball 2>/dev/null)
  for i in $(seq 1 20); do
    [ -n "$TARBALL" ] && [ "$(status "$TARBALL")" = 200 ] && break
    echo "      the $WANT tarball is not downloadable yet (registry lag?); retry $i/20 in 30s"
    sleep 30
    [ -n "$TARBALL" ] || TARBALL=$(npm view "@hgwk/kttn@$WANT" dist.tarball 2>/dev/null)
  done
  if [ -z "$TARBALL" ] || [ "$(status "$TARBALL")" != 200 ]; then
    fail "registry lag: the $WANT tarball ${TARBALL:-(no address)} is not downloadable after 10 minutes"
    echo "SUMMARY: FAIL registry lag, $WANT"
    exit 1
  fi
fi
