#!/bin/sh
# Down the lanes: stops every lane server lanes-up.sh started (each carries E2E_LANE_DB=sending_stone_e2e_N),
# by its process group, whatever LANES it was started with; no other server.
L=$(cd "$(dirname "$0")" && pwd)
. "$L/lanes-env.sh"
left=0
for p in $(pgrep -f '[n]ext-server'); do
  case $(server_db $p) in
    sending_stone_e2e_[0-9]*) stop_server $p || { echo "lanes: the lane server $p is still running"; left=1; } ;;
  esac
done
[ $left = 0 ] || exit 1
echo "lanes down: no lane server running"
