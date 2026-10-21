#!/bin/sh
# regress.sh on the lanes lanes-up.sh started, the lanes at once: every run of regress.sh (read from
# it, with its own run(), so new runs and want counts are picked up), each on fresh data from that
# lane's own reset, each suite's variants together on one lane in regress.sh's order. Lanes take the
# suites pinned to them in lanes.conf, then the others, longest first, as they come free.
# Suites on lanes.conf's `solo` line run after the lanes, one at a time, alone on lane 0 with the other
# lanes idle, in regress.sh's order (#245). `SOLO=0` runs them in the lanes like the rest.
#   ONLY=suite1,suite2   only these suites (every variant of each)
#   NO_MIDI=1            leave out the runs with MIDI=1 (midi's own first run among them)
#   DRY_RUN=1            only print which runs would go where
#   SOLO=0               run lanes.conf's solo suites in the lanes like the rest, not alone afterwards
#   RETRY=1              afterwards, run each failed run again, alone on lane 0 with the other lanes
#                        idle; the result lines show the second try, a RETRIED line the first, whose
#                        log is kept as <log>.try1 (off by default: a failure is a failure)
#   LANES=3 PORT_BASE=3000 LANES_CONF=lanes.conf LOGS=e2e/.out/logs
# Prints regress.sh's "name exit=… oks=… want=…" lines in regress.sh's order, the lanes, the wall time;
# progress goes to stderr as "# lane …" lines. Each log keeps its regress.sh name, in $LOGS.
# Exits 1 if any run failed (exit not 0, or oks not want), 2 if it could not start. A live pass needs
# the lanes up (lanes-up.sh) and the E2E_DATABASE_URL and E2E_AUTH_SECRET they were started with.
L=$(cd "$(dirname "$0")" && pwd)
. "$L/lanes-env.sh"
CONF=${LANES_CONF:-$L/lanes.conf}
LOGS=${LOGS:-$O/logs}
R=${REGRESS:-$E/regress.sh}

# A live pass owns $O/work (its run list, units, queue and results). A dry run plans in a scratch
# folder of its own, so one started beside a live pass cannot swap that pass's run list for its own.
if [ -n "$DRY_RUN" ] && [ "$DRY_RUN" != 0 ]; then
  W=$(mktemp -d $O/work-dry.XXXXXX) || exit 2
  trap 'rm -rf "$W"' EXIT
else
  W=$O/work
  rm -rf $W
fi
mkdir -p $W/units $LOGS
START=$(date +%s)

# 1. regress.sh taken apart: its header (E, O, LOGS, cd $E), its run(), which writes the log into
#    $LOGS, the header's E2E_LOGS (this pass's logs), and its runs. The lane's APP_URL and E2E_DB_URL
#    reach reset-db.sh and the suites through the environment.
awk '/^run\(\) *\{/ {exit} {print}' $R > $W/lib.sh
awk '/^run\(\) *\{/ {f=1} f {print} f && /^}/ {exit}' $R > $W/run.sh
grep -q '^LOGS=\${E2E_LOGS:-' $W/lib.sh && grep -q '^[[:space:]]*out=\$LOGS/\$name' $W/run.sh \
  || { echo "regress.sh's run() no longer logs into \$LOGS, from E2E_LOGS: teach regress-lanes.sh where its log goes" >&2; exit 2; }
cat $W/run.sh >> $W/lib.sh
cat >> $W/lib.sh <<'EOF'
# One run of regress.sh, by its place in regress.sh: its result line, lane, seconds and log.
runat() {
  idx=$1; shift
  t0=$(date +%s)
  run "$@" > $E2E_WORK/line-$E2E_LANE
  line=$(cat $E2E_WORK/line-$E2E_LANE)
  t=$(( $(date +%s) - t0 ))
  printf '%s\t%s\t%s\t%s\t%s\n' "$idx" "$E2E_LANE" "$t" "$line" "$out" >> $E2E_RESULTS
  echo "# lane $E2E_LANE +$(( $(date +%s) - E2E_START )) s: $line ($t s)" >&2
}
EOF
awk 'f && /^run[ \t]/ {print} /^}/ {f=1}' $R > $W/all-runs.txt
[ -s $W/all-runs.txt ] || { echo "no runs found in $R" >&2; exit 2; }

# 2. The runs of this pass: "place name want variables…".
for s in $(echo "$ONLY" | tr ',' ' '); do
  awk -v s=$s '$2 == s {f=1} END {exit !f}' $W/all-runs.txt || { echo "ONLY: regress.sh has no runs of $s" >&2; exit 2; }
done
only=" $(echo "$ONLY" | tr ',' ' ') "
i=0
: > $W/runs.txt
while read -r cmd name rest; do
  i=$((i + 1))
  if [ -n "$ONLY" ]; then case $only in *" $name "*) ;; *) continue;; esac; fi
  if [ -n "$NO_MIDI" ] && [ "$NO_MIDI" != 0 ]; then case " $rest " in *" MIDI=1 "*) continue;; esac; fi
  echo "$i $name $rest" >> $W/runs.txt
done < $W/all-runs.txt
[ -s $W/runs.txt ] || { echo "no runs left to run" >&2; exit 2; }

# 3. A unit per suite, every variant of it in regress.sh's order; pinned to a lane, or queued.
#    A suite on lanes.conf's solo line goes to solo.txt instead, in regress.sh's order, to run alone
#    after the lanes (#245); solo wins over a pin, and a solo name with no runs in this pass is ignored.
awk '!seen[$2]++ {print $2}' $W/runs.txt > $W/suites.txt
for n in $(lanes); do : > $W/pinned-$n.txt; : > $W/results-$n.tsv; : > $W/took-$n.txt; done
: > $W/queue.in
solo=
[ "$SOLO" = 0 ] || solo=" $(awk '!/^#/ && $1 == "solo" {for (i = 2; i <= NF; i++) printf "%s ", $i}' $CONF)"
: > $W/solo.txt; : > $W/took-solo.txt
order=0
for u in $(cat $W/suites.txt); do
  order=$((order + 1))
  { echo ". $W/lib.sh"; awk -v u=$u '$2 == u {i = $1; $1 = ""; print "runat " i $0}' $W/runs.txt; } > $W/units/$u.sh
  case $solo in *" $u "*) echo $u >> $W/solo.txt; continue;; esac
  set -- $(awk -v u=$u '!/^#/ && $1 == u {print $2, $3; exit}' $CONF)
  est=${1:-600}
  pin=${2:-}
  case $pin in ''|*[!0-9]*) pin=;; esac
  if [ -n "$pin" ] && [ $pin -lt $LANES ]; then echo $u >> $W/pinned-$pin.txt
  else echo "$est $order $u" >> $W/queue.in; fi
done
sort -k1,1nr -k2,2n $W/queue.in | awk '{print $3}' > $W/queue.txt

if [ -n "$DRY_RUN" ] && [ "$DRY_RUN" != 0 ]; then
  for n in $(lanes); do echo "lane $n $(lane_url $n) $(lane_db $n): pinned $(tr '\n' ' ' < $W/pinned-$n.txt)"; done
  echo "then, longest first: $(tr '\n' ' ' < $W/queue.txt)"
  [ -s $W/solo.txt ] && echo "then alone on lane 0: $(tr '\n' ' ' < $W/solo.txt)"
  awk '{print "run " $2 " " $3}' $W/runs.txt | sed 's/^/  /'
  exit 0
fi
need_db && need_secret || exit 2
for n in $(lanes); do
  lane_is_up $n || { echo "lane $n: no lane server on $(lane_url $n) over $(lane_db $n): run lanes-up.sh first" >&2; exit 2; }
  server_has_secret $(lane_pid $n) || { echo "lane $n: its server was started with another E2E_AUTH_SECRET: export that one, or up the lanes again" >&2; exit 2; }
done

# 4. The lanes, at once.
claim() { flock $W/queue.lock sh -c 'head -n 1 "$1"; sed -i 1d "$1"' claim $W/queue.txt; }
worker() {
  export E2E_LANE=$1 APP_URL=$(lane_url $1) E2E_DB_URL=$(lane_db_url $1) E2E_LOGS=$LOGS E2E_WORK=$W E2E_START=$START \
    E2E_RESULTS=$W/results-$1.tsv
  for u in $(cat $W/pinned-$1.txt); do echo $u >> $W/took-$1.txt; sh $W/units/$u.sh; done
  while u=$(claim) && [ -n "$u" ]; do echo $u >> $W/took-$1.txt; sh $W/units/$u.sh; done
}
tree() { echo $1; for c in $(pgrep -P $1); do tree $c; done; }
stop() { trap - INT TERM; for p in $workers; do kill $(tree $p) 2>/dev/null; done; echo "regress-lanes: stopped" >&2; exit 130; }
trap stop INT TERM
echo "# $(wc -l < $W/runs.txt) runs of $(wc -l < $W/suites.txt) suites on $LANES lanes; logs in $LOGS" >&2
workers=
for n in $(lanes); do worker $n & workers="$workers $!"; done
wait
# The solo suites, once every lane is idle: one at a time on lane 0. In the background and waited for,
# so INT and TERM (whose trap runs only once a foreground command ends) stop them too.
if [ -s $W/solo.txt ]; then
  echo "# alone on lane 0, the other lanes idle: $(tr '\n' ' ' < $W/solo.txt)" >&2
  : > $W/results-solo.tsv
  (export E2E_LANE=0 APP_URL=$(lane_url 0) E2E_DB_URL=$(lane_db_url 0) E2E_LOGS=$LOGS E2E_WORK=$W E2E_START=$START \
     E2E_RESULTS=$W/results-solo.tsv
   for u in $(cat $W/solo.txt); do echo $u >> $W/took-solo.txt; sh $W/units/$u.sh; done) &
  workers="$!"
  wait
fi
trap - INT TERM

# 5. The results in regress.sh's order; a run that left no result counts as failed.
failed() { awk -F'\t' '{split($4, a, " "); if (a[2] != "exit=0" || substr(a[3], 5) != substr(a[4], 6)) print}' "$@"; }
cat $W/results-*.tsv | sort -n -k1,1 > $W/first.tsv
: > $W/retry.tsv
if [ "$RETRY" = 1 ] && [ -n "$(failed $W/first.tsv)" ]; then
  failed $W/first.tsv | cut -f1 > $W/retry-idx.txt
  echo "# retrying $(wc -l < $W/retry-idx.txt) failed runs one at a time, alone on lane 0" >&2
  failed $W/first.tsv | cut -f5 | while read -r log; do mv "$log" "$log.try1"; done
  { echo ". $W/lib.sh"; awk 'FILENAME == ARGV[1] {want[$1]; next} $1 in want {i = $1; $1 = ""; print "runat " i $0}' $W/retry-idx.txt $W/runs.txt; } > $W/units/retry.sh
  (export E2E_LANE=0 APP_URL=$(lane_url 0) E2E_DB_URL=$(lane_db_url 0) E2E_LOGS=$LOGS E2E_WORK=$W E2E_START=$START \
     E2E_RESULTS=$W/retry.tsv; sh $W/units/retry.sh)
fi
END=$(date +%s)
# The second try, where there was one, else the first.
awk -F'\t' 'FILENAME == ARGV[1] {retry[$1] = $0; next} {if ($1 in retry) print retry[$1]; else print}' $W/retry.tsv $W/first.tsv > $W/results.tsv
awk -F'\t' 'FILENAME == ARGV[1] {line[$1] = $4; next} {split($0, a, " "); if (a[1] in line) print line[a[1]]; else print a[2] " exit=missing oks=0 want=" a[3]}' \
  $W/results.tsv $W/runs.txt > $LOGS/regress-lanes.out
cat $LOGS/regress-lanes.out
cut -f1-3,5 $W/first.tsv > $LOGS/times.tsv
for n in $(lanes); do
  awk -F'\t' -v n=$n -v url=$(lane_url $n) -v took="$(tr '\n' ' ' < $W/took-$n.txt)" \
    '$2 == n {runs++; secs += $3} END {printf "lane %s %s: %d runs, %d s: %s\n", n, url, runs, secs, took}' $W/first.tsv
done
[ -s $W/solo.txt ] && awk -F'\t' -v took="$(tr '\n' ' ' < $W/took-solo.txt 2>/dev/null)" \
  '{runs++; secs += $3} END {printf "alone on lane 0: %d runs, %d s: %s\n", runs, secs, took}' $W/results-solo.tsv
awk -F'\t' 'FILENAME == ARGV[1] {retry[$1] = $4; next} ($1 in retry) {print "RETRIED: " $4 " (lane " $2 ", log " $5 ".try1), then alone: " retry[$1]}' $W/retry.tsv $W/first.tsv
bad=0
while read -r name e o w; do
  [ "$e" = exit=0 ] && [ "${o#oks=}" = "${w#want=}" ] && continue
  bad=$((bad + 1))
done < $LOGS/regress-lanes.out
failed $W/results.tsv | awk -F'\t' '{print "FAILED: " $4 " (lane " $2 ", log " $5 ")"}'
echo "logs: $LOGS (results in regress-lanes.out, seconds per run in times.tsv)"
wall=$((END - START))
echo "wall time: $wall s ($((wall / 60))m$((wall % 60))s) for $(wc -l < $W/runs.txt) runs on $LANES lanes; $bad failed$([ -s $W/retry.tsv ] && echo ", $(wc -l < $W/retry.tsv) retried")"
[ $bad -eq 0 ]
