#!/bin/sh
# The SKEW runs' older modules (skew.conf), each extracted from the module checkout's history by SHA
# into .out/module-<version>, once, and again only when its SHA changes:  sh e2e/skew.sh [id ...]
# (every id in skew.conf by default). By SHA because a clone's local tags may stop short; a shallow
# clone of the module needs `git fetch --tags` (or a full clone) first.
E=$(cd "$(dirname "$0")" && pwd)
O=$E/.out
M=${SENDING_STONE_MODULE:-$(dirname "$(dirname "$E")")/fvtt-sending-stone}
ids=" $* "
bad=0
while read -r id tag sha; do
  case $id in ''|'#'*) continue;; esac
  [ "$ids" = "  " ] || case $ids in *" $id "*) ;; *) continue;; esac
  dir=$O/module-${tag#v}
  [ "$(cat "$dir.sha" 2>/dev/null)" = "$sha" ] && [ -f "$dir/module.json" ] && continue
  git -C "$M" cat-file -e "$sha^{commit}" 2>/dev/null \
    || { echo "skew $id: $tag ($sha) is not in $M's history: git fetch --tags there" >&2; bad=1; continue; }
  rm -rf "$dir" "$dir.sha"
  mkdir -p "$dir"
  if git -C "$M" archive "$sha" | tar -x -C "$dir"; then
    echo "$sha" > "$dir.sha"
    echo "skew $id: $tag extracted into $dir"
  else
    echo "skew $id: git archive $sha failed" >&2; rm -rf "$dir"; bad=1
  fi
done < "$E/skew.conf"
exit $bad
