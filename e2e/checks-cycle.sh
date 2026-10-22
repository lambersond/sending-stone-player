#!/bin/sh
# The serial e2e: build the app, one server on localhost:3000 over the e2e's own sending_stone_e2e, every
# run of regress.sh on it, one at a time, then that server stopped (KEEP=1 leaves it up, for rerun.sh with
# the same E2E_AUTH_SECRET). From the app's checkout, under the lock:
#   flock -o e2e/.out/e2e.lock npm run e2e:serial
# Needs E2E_DATABASE_URL and the module checkout (README.md); makes the pass's E2E_AUTH_SECRET unless one
# is exported. A server this e2e left on :3000 is stopped first; anything else there is refused.
E=$(cd "$(dirname "$0")" && pwd)
. "$E/env.sh"
need_db && module_ready || exit 1
new_secret
free_port $SERIAL_PORT || exit 1
build_app "$(db_url $SERIAL_DB)" "http://localhost:$SERIAL_PORT" "$O/build-serial.out" || exit 1
heads
sh "$E/skew.sh" || exit 1
serial_up || { serial_down; exit 1; }
export E2E_DB_URL=$(db_url $SERIAL_DB)
sh "$E/regress.sh"
code=$?
[ "$KEEP" = 1 ] || serial_down
exit $code
