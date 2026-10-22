# Sourced (never run) by checks-cycle.sh, rerun.sh and lanes/lanes-env.sh, with E set to this folder:
# where everything is, the module checkout and its checks, the database, the pass's secret, the app
# servers' environment and which servers are these scripts' own. It never reads the app's .env.
APP=$(dirname "$E")
O=$E/.out
mkdir -p "$O"
# regress.sh, when regress-lanes.sh or rerun.sh runs it from a copy in .out, finds this folder by it.
export E2E_DIR="$E"

# ---- The module checkout ----
# SENDING_STONE_MODULE (absolute; by default fvtt-sending-stone beside this checkout) at the commit
# that matches this one, with `npm ci` and `npm run test:setup` done in it. The suites take its
# stand-ins through e2e/fvtt, a link to its test/fvtt that this makes, and run it as the module under
# test unless a run names another (MODULE or MODULE_DIR: SKEW runs, skew.sh).
SENDING_STONE_MODULE=${SENDING_STONE_MODULE:-$(dirname "$APP")/fvtt-sending-stone}
export SENDING_STONE_MODULE
module_ready() {
  M=$SENDING_STONE_MODULE
  grep -qE '"id": *"sending-stone"' "$M/module.json" 2>/dev/null \
    || { echo "no Sending Stone module checkout at $M: set SENDING_STONE_MODULE (e2e/README.md)" >&2; return 1; }
  [ -f "$M/test/fvtt/stub.mjs" ] || { echo "$M has no test/fvtt: check out the module's commit that matches this one" >&2; return 1; }
  [ -d "$M/node_modules/jsdom" ] || { echo "$M has no node_modules: run npm ci there" >&2; return 1; }
  for dir in "${DND5E5_DIR:-$M/.cache/dnd5e/release-5.3.3}" "${DND5E6_DIR:-$M/.cache/dnd5e/release-6.0.5}"; do
    [ -f "$dir/module/dice/d20-roll.mjs" ] || { echo "no dnd5e at $dir: run npm run test:setup in $M, or set DND5E5_DIR and DND5E6_DIR" >&2; return 1; }
  done
  ln -sfn "$M/test/fvtt" "$E/fvtt"
}
heads() {
  echo "app: $(git -C "$APP" log --oneline -1 2>/dev/null | cut -c1-72)$(git -C "$APP" status --porcelain 2>/dev/null | grep -q . && echo ' (uncommitted changes)')"
  echo "module: $(git -C "$SENDING_STONE_MODULE" log --oneline -1 2>/dev/null | cut -c1-72)$(git -C "$SENDING_STONE_MODULE" status --porcelain 2>/dev/null | grep -q . && echo ' (uncommitted changes)') at $SENDING_STONE_MODULE"
}

# ---- The database ----
# E2E_DATABASE_URL: an admin URL on the e2e's Postgres (a role that may create databases). The e2e's
# own databases are made beside it: sending_stone_e2e for the serial run, sending_stone_e2e_N for lane N.
# Never the database the app is developed on.
need_db() {
  [ -n "$E2E_DATABASE_URL" ] || { echo "E2E_DATABASE_URL is unset: an admin URL for the e2e's Postgres, e.g. postgresql://admin:password@localhost:5432/postgres (e2e/README.md)" >&2; return 1; }
}
db_url() {
  base=${E2E_DATABASE_URL%%\?*}
  echo "${base%/*}/$1${E2E_DATABASE_URL#"$base"}"
}
make_db() {
  [ "$(psql "$E2E_DATABASE_URL" -qAtc "select 1 from pg_database where datname = '$1'")" = 1 ] \
    || psql "$E2E_DATABASE_URL" -qc "create database $1" || { echo "could not create database $1" >&2; return 1; }
}

# ---- The pass's secret ----
# E2E_AUTH_SECRET signs the suites' session cookies (env.mjs) and is the servers' BETTER_AUTH_SECRET. A pass
# makes its own unless one is given; it lives in the pass's environment only, never in a file or a log.
new_secret() {
  [ -n "$E2E_AUTH_SECRET" ] || E2E_AUTH_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")
  export E2E_AUTH_SECRET
}
need_secret() {
  [ -n "$E2E_AUTH_SECRET" ] || { echo "E2E_AUTH_SECRET is unset: run checks-lanes.sh or checks-cycle.sh, or export the secret the servers were started with (e2e/README.md)" >&2; return 1; }
}

# ---- The app's servers ----
# The environment `npm run build` and `next start` get, on their command line, so that it wins over any
# .env and a checkout without one builds and serves: run it in the subshell that starts them.
app_env() {
  export DB_URL="$1" DIRECT_DATABASE_URL="$1" BETTER_AUTH_URL="$2" BETTER_AUTH_SECRET="$E2E_AUTH_SECRET" \
    AUTH_GOOGLE_ENABLED=false AUTH_DISCORD_ENABLED=false
}
# Whether .next is missing or older than the sources.
build_needed() {
  [ ! -f "$APP/.next/BUILD_ID" ] \
    || [ -n "$(cd "$APP" && find src prisma public package.json package-lock.json next.config.ts tsconfig.json postcss.config.mjs -newer .next/BUILD_ID -type f 2>/dev/null | head -1)" ]
}
# npm run build with a server's environment (database URL, address), its output in the file named.
build_app() {
  t0=$(date +%s)
  (app_env "$1" "$2"; cd "$APP" && npm run build) > "$3" 2>&1 || { echo BUILD FAILED; tail -30 "$3"; return 1; }
  echo "build errors: $(grep -cE 'P1001|Error' "$3") ($(( $(date +%s) - t0 )) s, $3)"
}
# The app server (next-server) listening on a port, if any: its socket from /proc/net/tcp (lsof sees no
# sockets here). port_taken says whether anything at all listens there.
port_inode() {
  awk -v h=$(printf '%04X' $1) '$4 == "0A" && $2 ~ (":" h "$") {print $10; exit}' /proc/net/tcp /proc/net/tcp6 2>/dev/null
}
port_taken() { [ -n "$(port_inode $1)" ]; }
port_pid() {
  inode=$(port_inode $1)
  [ -n "$inode" ] || return 0
  for p in $(pgrep -f '[n]ext-server'); do
    ls -l /proc/$p/fd 2>/dev/null | grep -q "socket:\[$inode\]" && { echo $p; return 0; }
  done
}
# The database a server these scripts started serves (E2E_LANE_DB, which every one of them carries in its
# environment); nothing for any other server.
server_db() { tr '\0' '\n' < /proc/$1/environ 2>/dev/null | sed -n 's/^E2E_LANE_DB=//p'; }
# Whether a server was started with this pass's secret.
server_has_secret() { tr '\0' '\n' < /proc/$1/environ 2>/dev/null | grep -qxF "BETTER_AUTH_SECRET=$E2E_AUTH_SECRET"; }
# Stop one server these scripts started, by its process group (setsid gave it its own), and wait for it.
stop_server() {
  pgid=$(ps -o pgid= -p $1 2>/dev/null | tr -d ' ')
  [ -n "$pgid" ] && kill -TERM -$pgid 2>/dev/null
  for i in $(seq 1 30); do kill -0 $1 2>/dev/null || return 0; sleep 0.5; done
  kill -KILL -$pgid 2>/dev/null
  sleep 0.5
  ! kill -0 $1 2>/dev/null
}
# A port these scripts may listen on: free, or held by a server they started earlier, which is stopped.
# Held by anything else, it is refused.
free_port() {
  pid=$(port_pid $1)
  if [ -n "$pid" ] && [ -n "$(server_db $pid)" ]; then
    stop_server $pid || { echo "port $1: could not stop this e2e's earlier server (pid $pid)" >&2; return 1; }
  fi
  ! port_taken $1 || { echo "port $1 is taken by something these scripts didn't start: stop it, or move the e2e (PORT_BASE, e2e/README.md)" >&2; return 1; }
}
# Start one app server: database URL, port, its database's name (its E2E_LANE_DB), log file.
start_server() {
  (app_env "$1" "http://localhost:$2"; export E2E_LANE_DB="$3"; cd "$APP" && setsid nohup npx next start -p $2 > "$4" 2>&1 &)
}
server_up() {
  pid=$(port_pid $1)
  [ -n "$pid" ] && [ "$(server_db $pid)" = "$2" ] \
    && [ "$(curl -s -o /dev/null -w '%{http_code}' http://localhost:$1/login)" = 200 ]
}

# ---- The serial run: one server on :3000 over sending_stone_e2e ----
SERIAL_PORT=3000
SERIAL_DB=sending_stone_e2e
serial_up() {
  U=$(db_url $SERIAL_DB)
  make_db $SERIAL_DB || return 1
  E2E_DB_URL="$U" sh "$E/reset-db.sh" > "$O/reset-serial.out" 2>&1
  grep -qE 'migrations have been successfully applied|No pending migrations' "$O/reset-serial.out" \
    || { echo "reset of $SERIAL_DB failed:"; cat "$O/reset-serial.out"; return 1; }
  start_server "$U" $SERIAL_PORT $SERIAL_DB "$O/server-serial.log"
  for i in $(seq 1 60); do server_up $SERIAL_PORT $SERIAL_DB && break; sleep 0.5; done
  server_up $SERIAL_PORT $SERIAL_DB || { echo "no 200 from localhost:$SERIAL_PORT/login in 30 s:"; tail -20 "$O/server-serial.log"; return 1; }
  echo "serial: http://localhost:$SERIAL_PORT over $SERIAL_DB (pid $(port_pid $SERIAL_PORT), log $O/server-serial.log)"
}
serial_down() {
  pid=$(port_pid $SERIAL_PORT)
  [ -n "$pid" ] && [ "$(server_db $pid)" = $SERIAL_DB ] && stop_server $pid
  echo "serial server down"
}
