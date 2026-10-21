#!/bin/sh
# Rerun only the named suites' lines of regress.sh, every variant of each, serially: regress.sh's own
# run(), so each is on fresh data and logs where it always does (.out/serial). From the app's checkout:
#   npm run e2e:rerun -- gm settings
# On the serial server checks-cycle.sh left up (KEEP=1) when E2E_AUTH_SECRET is the one it was started
# with; else on a server of its own over sending_stone_e2e, from the current build (built first if there
# is none, or it is older than the sources), stopped afterwards. Run it under flock -o e2e/.out/e2e.lock.
E=$(cd "$(dirname "$0")" && pwd)
. "$E/env.sh"
[ $# -ge 1 ] || { echo "usage: sh e2e/rerun.sh suite [suite ...]" >&2; exit 2; }
need_db && module_ready || exit 1
names=" $* "
{
  sed -n '1,/^}/p' "$E/regress.sh"
  sed -n '/^}/,$p' "$E/regress.sh" | sed 1d | while read -r cmd name rest; do
    [ "$cmd" = run ] && case "$names" in *" $name "*) echo "run $name $rest";; esac
  done
} > "$O/rerun-now.sh"
grep -q '^run ' "$O/rerun-now.sh" || { echo "regress.sh has no runs of$names" >&2; exit 2; }
sh "$E/skew.sh" || exit 1
pid=$(port_pid $SERIAL_PORT)
if [ -n "$E2E_AUTH_SECRET" ] && [ -n "$pid" ] && [ "$(server_db $pid)" = $SERIAL_DB ] && server_has_secret $pid; then
  echo "serial: reusing the server on localhost:$SERIAL_PORT (pid $pid)"
  own=0
else
  new_secret
  free_port $SERIAL_PORT || exit 1
  if build_needed; then build_app "$(db_url $SERIAL_DB)" "http://localhost:$SERIAL_PORT" "$O/build-serial.out" || exit 1; fi
  serial_up || { serial_down; exit 1; }
  own=1
fi
export E2E_DB_URL=$(db_url $SERIAL_DB)
sh "$O/rerun-now.sh"
code=$?
[ $own = 1 ] && serial_down
exit $code
