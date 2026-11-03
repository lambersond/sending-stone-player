#!/bin/sh
# The v0.43 metrics for one commit: `sh run.sh <label> [commit] [checkout]`, e.g. `sh run.sh base`.
# Runs `eslint . -f json` under the checks lock (warnings or errors both fine), then metrics.mjs,
# writing .refactor/analysis/metrics-<label>.md and ratchet-<label>.json in the checkout. The tree
# outside .refactor/ must equal <commit> (default HEAD): the metrics describe that commit.
set -eu
LABEL=${1:?usage: run.sh <label> [commit] [checkout]}
APP=${3:-/home/user/sending-stone-player}
X=/tmp/claude-0/-home-user/5271a33c-a1ff-5f4e-963f-cdaf6da8c173/scratchpad/v043
cd "$APP"
COMMIT=$(git rev-parse --short "${2:-HEAD}")
if ! git diff --quiet "$COMMIT" -- . ':!.refactor' ||
  [ -n "$(git ls-files --others --exclude-standard -- . ':!.refactor')" ]; then
  echo "run.sh: the tree outside .refactor/ differs from $COMMIT" >&2
  exit 1
fi
OUT=$X/metrics-$LABEL
mkdir -p "$OUT"
flock "$X/checks.lock" npx eslint . -f json -o "$OUT/eslint.json" || [ $? -eq 1 ]
node .refactor/analysis/metrics/metrics.mjs "$OUT/eslint.json" \
  ".refactor/analysis/metrics-$LABEL.md" ".refactor/analysis/ratchet-$LABEL.json" "$COMMIT" "$LABEL"
echo "metrics-$LABEL.md and ratchet-$LABEL.json for $COMMIT"
