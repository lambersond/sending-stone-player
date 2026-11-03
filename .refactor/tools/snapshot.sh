#!/usr/bin/env bash
# Save each builder worktree's work not yet landed (round.md §2.3.5) into .refactor/patches/<label>/
# and push it, so a container reset loses at most one interval. Usage: snapshot.sh [interval-s] [rounds]
set -u
APP=/home/user/sending-stone-player
BR=claude/dazzling-dirac-m8cq54
X=/tmp/claude-0/-home-user/5271a33c-a1ff-5f4e-963f-cdaf6da8c173/scratchpad/v043
EVERY=${1:-3600}
ROUNDS=${2:-1}
MAX=1048576 # files over 1 MB (whole-page snapshots) are left out: they are regenerated with --ci=false

snap() {
  local wt label out base f
  for wt in /home/user/w043/*/sending-stone-player; do
    [ -d "$wt" ] || continue
    label=$(basename "$(dirname "$wt")")
    out=$APP/.refactor/patches/$label
    rm -rf "$out" && mkdir -p "$out"
    base=$(git -C "$wt" merge-base HEAD "$BR" 2>/dev/null) || continue
    git -C "$wt" format-patch -q -o "$out/commits" "$base..HEAD" 2>/dev/null
    git -C "$wt" diff HEAD -- . ':(exclude)*.snap' >"$out/uncommitted.diff" 2>/dev/null
    git -C "$wt" ls-files --others --exclude-standard -z | while IFS= read -r -d '' f; do
      [ "$(stat -c %s "$wt/$f" 2>/dev/null || echo 0)" -le $MAX ] || { echo "$f" >>"$out/left-out.txt"; continue; }
      git -C "$wt" diff --no-index -- /dev/null "$f" >>"$out/untracked.diff" 2>/dev/null
    done
    git -C "$wt" log --oneline "$base..HEAD" >"$out/log.txt" 2>/dev/null
    find "$out" -type f -size 0 -delete
  done
  # Phase 3: lane branches must not conflict (round.md §2.2.4); each pair merged in memory.
  local a b res confl=$APP/.refactor/analysis/conflicts.md
  local branches
  branches=$(git -C "$APP" for-each-ref --format='%(refname:short)' 'refs/heads/local/043-*')
  {
    echo "# Lane branch conflicts ($(date -u +%FT%TZ); git merge-tree, round.md §2.2.4)"
    echo
    for a in $branches; do for b in $branches; do
      [[ "$a" < "$b" ]] || continue
      if ! res=$(git -C "$APP" merge-tree --write-tree --name-only "$a" "$b" 2>&1); then
        echo "- **$a × $b**: $(echo "$res" | sed -n '2,20p' | grep -v '^$' | tr '\n' ' ')"
      fi
    done; done
    echo
    echo "(no line above: no pair conflicts)"
  } >"$confl"
  (
    cd "$APP" || exit 1
    flock "$X/git.lock" sh -c '
      git add -A -- .refactor/patches .refactor/analysis/conflicts.md >/dev/null 2>&1
      if ! git diff --cached --quiet -- .refactor/patches .refactor/analysis/conflicts.md; then
        printf "%s\n\n%s\n\n%s\n%s\n" "chore(refactor): builders work in progress (snapshot)" \
          "Unlanded commits and uncommitted work of each builder worktree, saved against a container reset." \
          "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" \
          "Claude-Session: https://claude.ai/code/session_01821Sr9FKASxJn47SNudpbR" >"'"$X"'/snap-msg.txt"
        git commit -q -F "'"$X"'/snap-msg.txt" -- .refactor/patches .refactor/analysis/conflicts.md &&
          for d in 2 4 8 16; do git push -q -u origin '"$BR"' && break; sleep $d; done
      fi'
  )
}

for i in $(seq 1 "$ROUNDS"); do
  sleep "$EVERY"
  snap
  echo "snapshot $i done $(date -u +%H:%MZ)"
done
