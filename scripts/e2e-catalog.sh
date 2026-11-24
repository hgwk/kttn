# Sourced by e2e-install.sh with the payload signal only: a claude -p run is
# headless and never kept, so only the payload walks the hook → catalog path.
# Uses check, KH, PORT from the caller.
cats() { curl -s -H "$KH" -H "Origin: http://127.0.0.1:$PORT" -H 'Content-Type: application/json' "$@"; }
CK="claude|e2e-$$" CURL_API="http://127.0.0.1:$PORT/api/cats"
check "catalog: the hooked session is in the cat catalog" "cats '$CURL_API' | grep -q '\"key\":\"$CK\"'"
cats -X PUT -d "{\"key\":\"$CK\",\"cat_name\":\"Mochi\"}" "$CURL_API/name" >/dev/null
cats -X PUT -d "{\"key\":\"$CK\",\"cat_name\":\"Momo\",\"replace\":true}" "$CURL_API/name" >/dev/null
check "catalog: a name sticks and a rename replaces it" "cats '$CURL_API' | grep -q '\"cat_name\":\"Momo\"'"
check "catalog: clear empties it" "[ \"\$(cats -o /dev/null -w '%{http_code}' -X DELETE '$CURL_API')\" = 204 ] && [ \"\$(cats '$CURL_API')\" = '{\"cats\":[]}' ]"
