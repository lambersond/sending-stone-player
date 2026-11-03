#!/usr/bin/env bash
# L1 (round.md §2.6, §3.4): `l1.sh <outdir> <checkout>`. Under the L1 locks (§2.3.6: the wait lock,
# then the checks lock, both exclusive), in the checkout: the full `jest --ci --json`, each test red
# there rerun once alone (reruns.tsv: a red one green alone is a flake, which gate 2 lists), `next
# typegen`, `tsc --noEmit`, `eslint . -f json`, then gates.sh. Prints `check jest|tsc|eslint ok|FAIL`
# and each gate's line; exit = failed checks + failed gates. The scripts are this folder's (APP's
# R/tools once landed), whatever commit the checkout is at.
set -u
TOOLS=$(cd "$(dirname "$0")" && pwd)
X=/tmp/claude-0/-home-user/5271a33c-a1ff-5f4e-963f-cdaf6da8c173/scratchpad/v043
OUTDIR=$(realpath -m "${1:?usage: l1.sh <outdir> <checkout>}")
CHECKOUT=$(realpath "${2:?usage: l1.sh <outdir> <checkout>}")
mkdir -p "$OUTDIR"
rm -f "$OUTDIR"/jest.json "$OUTDIR"/eslint.json "$OUTDIR"/reruns.tsv "$OUTDIR"/gate-* "$OUTDIR"/*.rc
# The base first, outside the locks (base.sh takes them itself if it must run jest).
"$TOOLS/base.sh" >"$OUTDIR/base.log" 2>&1 || { echo "l1: base.sh failed (see $OUTDIR/base.log)"; exit 99; }
export TOOLS OUTDIR CHECKOUT
flock "$X/l1-wait.lock" flock "$X/checks.lock" bash -c '
  cd "$CHECKOUT" || exit 99
  date -u +%FT%TZ >"$OUTDIR/start"
  # typegen first (tsc reads its output); then jest (3 workers), eslint and tsc side by side on the
  # 4 cores (each of eslint and tsc uses one): the same checks, about 40% sooner than one by one.
  npx next typegen >"$OUTDIR/typegen.log" 2>&1
  echo $? >"$OUTDIR/typegen.rc"
  ( npx eslint . -f json -o "$OUTDIR/eslint.json" >"$OUTDIR/eslint.log" 2>&1; echo $? >"$OUTDIR/eslint.rc" ) &
  ( npx tsc --noEmit >"$OUTDIR/tsc.log" 2>&1; echo $? >"$OUTDIR/tsc.rc" ) &
  npx jest --ci --json --outputFile="$OUTDIR/jest.json" --maxWorkers=3 >"$OUTDIR/jest.log" 2>&1
  echo $? >"$OUTDIR/jest.rc"
  wait
  # Each red test once more, alone (round.md §2.3.6), with nothing beside it.
  [ -f "$OUTDIR/jest.json" ] && node "$TOOLS/rerun.mjs" "$OUTDIR" "$CHECKOUT" >"$OUTDIR/rerun.log" 2>&1
  "$TOOLS/gates.sh" "$OUTDIR" "$CHECKOUT" >"$OUTDIR/gates.log" 2>&1
  echo $? >"$OUTDIR/gates.rc"
  date -u +%FT%TZ >"$OUTDIR/end"
'
FAILS=0
check() { # name, ok?, detail
  if [ "$2" = ok ]; then echo "check $1 ok${3:+ ($3)}"; else echo "check $1 FAIL${3:+ ($3)}"; FAILS=$((FAILS + 1)); fi
}
JEST=$(node -e '
  const r = require(process.argv[1]); const reruns = new Map()
  const unescape = t => t.replace(/\\(.)/g, (_, c) => ({ t: "\t", n: "\n", r: "\r" })[c] ?? c)
  try { for (const l of require("fs").readFileSync(process.argv[2], "utf8").split("\n").filter(Boolean)) { const [f, n, s] = l.split("\t"); reruns.set(unescape(n), s) } } catch {}
  let red = 0, flakes = 0
  for (const s of r.testResults) for (const t of s.assertionResults) if (t.status === "failed") { if (reruns.get(t.fullName) === "passed") flakes++; else red++ }
  const broken = r.testResults.filter(s => s.status === "failed" && s.assertionResults.every(t => t.status !== "failed")).length
  console.log([red + broken === 0 ? "ok" : "FAIL", `${r.numTotalTestSuites} suites, ${r.numTotalTests} tests, ${red} red, ${flakes} flaky (green alone), ${broken} suites that did not run`].join("\t"))
' "$OUTDIR/jest.json" "$OUTDIR/reruns.tsv" 2>/dev/null || printf 'FAIL\tno jest.json (see jest.log)')
check jest "${JEST%%	*}" "${JEST#*	}"
[ "$(cat "$OUTDIR/typegen.rc" 2>/dev/null)" = 0 ] && T=ok || T=FAIL
check typegen $T
[ "$(cat "$OUTDIR/tsc.rc" 2>/dev/null)" = 0 ] && T=ok || T=FAIL
check tsc $T "$(grep -c 'error TS' "$OUTDIR/tsc.log" 2>/dev/null) errors"
LINT=$(node -e '
  const r = require(process.argv[1]); let e = 0, w = 0
  for (const f of r) { e += f.errorCount; w += f.warningCount }
  console.log(`${e === 0 ? "ok" : "FAIL"}\t${r.length} files, ${e} errors, ${w} warnings`)
' "$OUTDIR/eslint.json" 2>/dev/null || printf 'FAIL\tno eslint.json (see eslint.log)')
check eslint "${LINT%%	*}" "${LINT#*	}"
cat "$OUTDIR/gates.log"
G=$(cat "$OUTDIR/gates.rc" 2>/dev/null || echo 99)
echo "l1: $((FAILS + G)) failed ($FAILS checks, $G gates); $OUTDIR ($(cat "$OUTDIR/start" 2>/dev/null) → $(cat "$OUTDIR/end" 2>/dev/null))"
exit $((FAILS + G))
