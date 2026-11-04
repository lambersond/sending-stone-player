#!/usr/bin/env bash
# The L3 replay, resumable across container restarts: replays (with replay.sh, one commit at a time)
# every commit after 1dff83f up to ea00b7c that is not chore(refactor) and has no row in
# X/replay/summary.tsv yet. Stale replay worktrees left by a killed run are pruned first.
# Usage: replay-resume.sh [until]   (default ea00b7c, the last commit 2-25 commit)
set -u
APP=/home/user/sending-stone-player
X=/tmp/claude-0/-home-user/5271a33c-a1ff-5f4e-963f-cdaf6da8c173/scratchpad/v043
TOOLS=$(cd "$(dirname "$0")" && pwd)
UNTIL=${1:-ea00b7c}
SUMMARY=$X/replay/summary.tsv
git -C "$APP" rev-list --reverse --no-merges --format='%h%x09%s' "1dff83f..$UNTIL" | grep -v '^commit ' |
  while IFS=$'\t' read -r sha subject; do
    case "$subject" in chore\(refactor\)*) continue ;; esac
    grep -q "^[0-9]*	$sha	" "$SUMMARY" 2>/dev/null && continue
    rm -rf "/home/user/w043/replay/$sha"
    git -C "$APP" worktree prune
    REPLAY_OUT=$X/replay "$TOOLS/replay.sh" "$(git -C "$APP" log --format=%h -1 "$sha^")" "$sha"
  done
echo "replay-resume: done; $(($(wc -l <"$SUMMARY") - 1)) rows in $SUMMARY"
