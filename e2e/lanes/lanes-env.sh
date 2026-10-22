# Sourced (never run) by lanes-up.sh, lanes-down.sh, regress-lanes.sh and checks-lanes.sh, with L set to
# this folder. Lane N (0 .. LANES-1) is one app server on http://localhost:$((PORT_BASE+N)) over its own
# database sending_stone_e2e_N, on E2E_DATABASE_URL's server; the suites find both through APP_URL and
# E2E_DB_URL (../README.md). The rest (the module checkout, the database, the secret, the servers) is
# ../env.sh's.
E=$(dirname "$L")
. "$E/env.sh"
LANES=${LANES:-3}
PORT_BASE=${PORT_BASE:-3000}

lanes() { seq 0 $((LANES - 1)); }
lane_port() { echo $((PORT_BASE + $1)); }
# localhost, never 127.0.0.1: the app tells http from https by a localhost host.
lane_url() { echo "http://localhost:$(lane_port $1)"; }
lane_db() { echo "sending_stone_e2e_$1"; }
lane_db_url() { db_url "$(lane_db $1)"; }
# The app server listening on a lane's port, if any.
lane_pid() { port_pid $(lane_port $1); }
# Is a lane's port served by that lane's own server (started by lanes-up.sh, marked in its env)?
lane_is_up() { server_up $(lane_port $1) $(lane_db $1); }

case $LANES in ''|*[!0-9]*|0) echo "LANES must be a whole number from 1" >&2; exit 2;; esac
for n in $(lanes); do
  # 3999 is gmerr's "unreachable app": nothing may listen there.
  [ $(lane_port $n) -ne 3999 ] || { echo "lane $n would listen on 3999, gmerr's unreachable app: change PORT_BASE or LANES" >&2; exit 2; }
done
