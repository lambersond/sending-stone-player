#!/bin/sh
# Up the lanes: one build of the app (BUILD=1 always builds, BUILD=0 never does; unset, it builds only
# when .next is missing or older than the sources), a fresh database per lane, and one `next start` per
# lane: lane N on localhost:PORT_BASE+N with its own DB_URL, DIRECT_DATABASE_URL and BETTER_AUTH_URL,
# and the pass's E2E_AUTH_SECRET as BETTER_AUTH_SECRET, on the command line (../env.sh), so no .env is
# read for them. Needs E2E_DATABASE_URL, E2E_AUTH_SECRET (checks-lanes.sh makes one) and the module
# checkout; extracts the SKEW runs' older modules (../skew.sh). Run it under flock -o e2e/.out/e2e.lock.
# Lane servers left from an earlier pass are stopped first; a lane port held by anything else is refused.
L=$(cd "$(dirname "$0")" && pwd)
. "$L/lanes-env.sh"
need_db && need_secret && module_ready || exit 1
for n in $(lanes); do free_port $(lane_port $n) || exit 1; done

need=$BUILD
if [ -z "$need" ]; then
  need=0
  build_needed && need=1
fi
if [ "$need" = 1 ]; then
  build_app "$(lane_db_url 0)" "$(lane_url 0)" "$O/build.out" || exit 1
else
  [ -f "$APP/.next/BUILD_ID" ] || { echo "no build in $APP/.next: run with BUILD=1"; exit 1; }
  echo "build: reusing $APP/.next from $(date -r "$APP/.next/BUILD_ID" '+%F %T')"
fi
heads
sh "$E/skew.sh" || exit 1

# A database per lane, made once (E2E_DATABASE_URL's role may create databases), then reset.
for n in $(lanes); do make_db $(lane_db $n) || exit 1; done
for n in $(lanes); do
  E2E_DB_URL=$(lane_db_url $n) sh "$E/reset-db.sh" > "$O/reset-$n.out" 2>&1 &
done
wait
for n in $(lanes); do
  grep -qE 'migrations have been successfully applied|No pending migrations' "$O/reset-$n.out" \
    || { echo "lane $n: reset of $(lane_db $n) failed:"; cat "$O/reset-$n.out"; exit 1; }
done

for n in $(lanes); do
  start_server "$(lane_db_url $n)" $(lane_port $n) $(lane_db $n) "$O/server-$n.log"
done
t0=$(date +%s)
for n in $(lanes); do
  for i in $(seq 1 120); do lane_is_up $n && break; sleep 0.5; done
  lane_is_up $n || { echo "lane $n: no 200 from $(lane_url $n)/login in 60 s:"; tail -20 "$O/server-$n.log"; exit 1; }
  echo "lane $n: $(lane_url $n) over $(lane_db $n), /login 200 after $(( $(date +%s) - t0 )) s (pid $(lane_pid $n), log $O/server-$n.log)"
done
