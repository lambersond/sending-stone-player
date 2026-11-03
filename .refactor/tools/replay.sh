#!/usr/bin/env bash
# L3, the replay (round.md §2.6, §0.6.15): `replay.sh [after] [until]` runs L1 with today's gates
# (this folder's scripts) on each commit of APP's branch after <after> (default 1dff83f, commit 1)
# up to <until> (default the branch head), oldest first, but the chore(refactor) planning commits,
# each in a detached worktree of its own (node_modules symlinked from APP while package-lock.json
# and prisma/ equal the head's, else npm ci and prisma generate there), removed after. Each gate
# decides from the commit whether it applies. Writes X/replay/<n>-<sha>/ (L1's outdir) and
# X/replay/summary.tsv (n, sha, subject, failed, the failing lines; REPLAY_OUT moves both). History
# is never rewritten: a red commit is fixed forward and the replay run again from it.
set -u
APP=/home/user/sending-stone-player
BR=claude/dazzling-dirac-m8cq54
X=/tmp/claude-0/-home-user/5271a33c-a1ff-5f4e-963f-cdaf6da8c173/scratchpad/v043
TOOLS=$(cd "$(dirname "$0")" && pwd)
AFTER=${1:-1dff83f}
UNTIL=${2:-$BR}
OUT=${REPLAY_OUT:-$X/replay}
mkdir -p "$OUT"
SUMMARY=$OUT/summary.tsv
[ -f "$SUMMARY" ] || printf 'n\tsha\tsubject\tfailed\tfailing\n' >"$SUMMARY"
n=0
git -C "$APP" rev-list --reverse --no-merges --format='%h%x09%s' "$AFTER..$UNTIL" |
  grep -v '^commit ' | while IFS=$'\t' read -r sha subject; do
  case "$subject" in chore\(refactor\)*) continue ;; esac
  n=$((n + 1))
  WT=/home/user/w043/replay/$sha
  rm -rf "$WT"
  git -C "$APP" worktree add --detach "$WT" "$sha" >/dev/null 2>&1 || { echo "replay: no worktree for $sha"; continue; }
  if git -C "$APP" diff --quiet "$sha" "$UNTIL" -- package-lock.json prisma/; then
    ln -s "$APP/node_modules" "$WT/node_modules"
  else
    (cd "$WT" && npm ci --no-audit --no-fund >/dev/null 2>&1 && npx prisma generate >/dev/null 2>&1)
  fi
  DIR=$OUT/$(printf '%02d' $n)-$sha
  "$TOOLS/l1.sh" "$DIR" "$WT" >"$DIR.log" 2>&1
  failed=$?
  failing=$(grep -E '^(check|gate) .* FAIL' "$DIR.log" | tr '\n' ';')
  printf '%s\t%s\t%s\t%s\t%s\n' "$n" "$sha" "$subject" "$failed" "$failing" >>"$SUMMARY"
  echo "replay $n $sha ${failed} failed: $subject"
  git -C "$APP" worktree remove --force "$WT"
done
