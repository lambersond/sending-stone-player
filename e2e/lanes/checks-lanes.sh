#!/bin/sh
# The lanes' checks-cycle.sh: build the app, up the lanes, every regress.sh run on them, down the lanes.
# From the app's checkout, under the lock:  flock -o e2e/.out/e2e.lock npm run e2e
# ONLY, NO_MIDI, SOLO, RETRY, LANES, PORT_BASE and LANES_CONF pass through to regress-lanes.sh; BUILD=0
# reuses a build that is newer than the sources (default: build, as checks-cycle.sh does); KEEP=1 leaves
# the lanes up afterwards for targeted passes (then lanes-down.sh before anything serial uses :3000).
# The pass makes its own E2E_AUTH_SECRET unless one is exported: export one first to keep using the
# lanes after a KEEP=1 pass.
L=$(cd "$(dirname "$0")" && pwd)
. "$L/lanes-env.sh"
new_secret
case $BUILD in 0) BUILD=;; *) BUILD=1;; esac
BUILD=$BUILD sh "$L/lanes-up.sh" || { echo "LANES NOT UP"; sh "$L/lanes-down.sh"; exit 2; }
sh "$L/regress-lanes.sh"
code=$?
[ "$KEEP" = 1 ] || sh "$L/lanes-down.sh"
echo "exit $code"
exit $code
