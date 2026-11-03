#!/usr/bin/env bash
# The gates' base (round.md §3.4): `base.sh [--force]` makes X/base/ once (jest-base.json,
# jest-base.tsv, expects/, files/, base.json) from 24f808b. WS0's X/jest-base.json (54d8128, the
# same src) seeds the jest run; without it a detached worktree at 24f808b runs jest under the L1
# locks and is removed after. Everything else base-tsv.mjs reads from 24f808b's git objects.
set -euo pipefail
APP=/home/user/sending-stone-player
X=/tmp/claude-0/-home-user/5271a33c-a1ff-5f4e-963f-cdaf6da8c173/scratchpad/v043
BASE=24f808b
TOOLS=$(cd "$(dirname "$0")" && pwd)
OUT=${GATE_BASE_DIR:-$X/base}
if [ "${1:-}" = --force ]; then rm -rf "$OUT"; fi
if [ -f "$OUT/jest-base.tsv" ] && [ -f "$OUT/base.json" ]; then
  echo "base: $OUT is there"
  exit 0
fi
mkdir -p "$OUT"
if [ ! -f "$OUT/jest-base.json" ]; then
  if [ -f "$X/jest-base.json" ]; then
    cp "$X/jest-base.json" "$OUT/jest-base.json"
    echo "base: jest seeded from WS0's X/jest-base.json"
  else
    WT=$OUT/wt
    git -C "$APP" worktree add --detach "$WT" "$BASE"
    if git -C "$APP" diff --quiet "$BASE" HEAD -- package-lock.json prisma/; then
      ln -s "$APP/node_modules" "$WT/node_modules"
    else
      (cd "$WT" && npm ci --no-audit --no-fund && npx prisma generate)
    fi
    (cd "$WT" && flock "$X/l1-wait.lock" flock "$X/checks.lock" npx jest --ci --json \
      --outputFile="$OUT/jest-base.json" --maxWorkers=3) || echo "base: jest at $BASE exited $?"
    git -C "$APP" worktree remove --force "$WT"
  fi
fi
node "$TOOLS/base-tsv.mjs" "$OUT/jest-base.json" "$OUT"
