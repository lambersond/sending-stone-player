#!/usr/bin/env bash
# The gates of round.md §3.4 over one checkout: `gates.sh <outdir> <checkout> [ids…]` (all by
# default). Each `gate-<id>.mjs` reads <outdir>/jest.json and eslint.json (l1.sh writes them), writes
# <outdir>/gate-<id>.txt and prints `gate <id> ok|FAIL|n/a`; a gate that crashes is a FAIL. Exit:
# the number of failed gates. The scripts are this folder's (APP's R/tools once landed); the
# checkout decides which gates apply.
set -u
TOOLS=$(cd "$(dirname "$0")" && pwd)
OUTDIR=$(realpath -m "${1:?usage: gates.sh <outdir> <checkout> [ids…]}")
CHECKOUT=$(realpath "${2:?usage: gates.sh <outdir> <checkout> [ids…]}")
shift 2
IDS=${*:-1 1b 2 3 4 4b 5 6 7 8 9 10 11 12}
mkdir -p "$OUTDIR"
"$TOOLS/base.sh" >"$OUTDIR/base.log" 2>&1 || { echo "gates: base.sh failed (see $OUTDIR/base.log)"; exit 99; }
export TOOLS OUTDIR CHECKOUT
printf '%s\n' $IDS | xargs -P 3 -I{} sh -c \
  'node "$TOOLS/gate-{}.mjs" "$OUTDIR" "$CHECKOUT" >"$OUTDIR/gate-{}.out" 2>&1; echo $? >"$OUTDIR/gate-{}.rc"'
FAILS=0
for id in $IDS; do
  rc=$(cat "$OUTDIR/gate-$id.rc" 2>/dev/null || echo 99)
  line=$(grep -m1 "^gate $id " "$OUTDIR/gate-$id.out" 2>/dev/null)
  if [ "$rc" = 0 ] && [ -n "$line" ]; then
    echo "$line"
  elif [ "$rc" = 1 ] && [ -n "$line" ]; then
    echo "$line"
    FAILS=$((FAILS + 1))
  else
    echo "gate $id FAIL (crashed, exit $rc; see $OUTDIR/gate-$id.out)"
    FAILS=$((FAILS + 1))
  fi
done
exit $FAILS
