#!/bin/sh
# Map T: top-level test helpers defined in 3+ suites, each copy hashed (definition line to the
# first blank line, whitespace kept) so identical copies group together.
# usage: sh dup-helpers.sh <repo>   (prints "name hash count file:line ..." per variant)
cd "$1" || exit 1
NAMES="respond advance posted posts reads ago held answering brokenBeforeMount spinnersIn settle wait clearStorage landing face flush tick"
for n in $NAMES; do
  grep -rn -E "^(async )?function $n\b|^const $n = " src --include='*.test.ts' --include='*.test.tsx' |
    while IFS=: read -r f l _; do
      h=$(awk -v s="$l" 'NR>=s { if (NR>s && $0 == "") exit; print }' "$f" | md5sum | cut -c1-6)
      echo "$n $h $f:$l"
    done
done | sort | awk '
  { key = $1 " " $2; c[key]++; w[key] = w[key] " " $3; n[$1]++ }
  END { for (k in c) { split(k, p, " "); if (n[p[1]] >= 3) print k, c[k], w[k] } }' | sort -k1,1 -k3,3nr
