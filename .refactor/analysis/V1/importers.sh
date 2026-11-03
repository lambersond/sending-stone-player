#!/usr/bin/env bash
# For each file in V1's area: its exports and its importers outside the area (cross-area edges).
# Usage: importers.sh [app-dir]  (read-only)
set -uo pipefail
APP=${1:-/home/user/sending-stone-player}
cd "$APP/src"
AREA_RE='^(components/game-table/|hooks/use-(table-view|table-api|end-turn|turn-undo|waiting-prompts|fullscreen)\.|utils/(table-pages|end-turn)\.)'
files=$( { find components/game-table -type f ! -name '*.test.tsx' ; ls hooks/use-{table-view,table-api,end-turn,turn-undo,waiting-prompts,fullscreen}.ts utils/{table-pages,end-turn}.ts; } | sort)
for f in $files; do
  mod="@/${f%.*}"; mod="${mod%/index}"
  echo "== $f ($(wc -l <"$f") lines)"
  echo "  exports: $(grep -oE '^export (const|function|type|async function|class|interface|\{[^}]*\}) ?[A-Za-z_]*' "$f" | sed -E 's/^export (const|function|type|async function|class|interface) ?//' | tr '\n' ' ')"
  # importers by alias, and relative imports inside game-table
  base=$(basename "${f%.*}")
  grep -rlE "from '${mod}'|from '\./${base}'|jest\.mock\('${mod}'|jest\.mock\('\./${base}'" --include=*.ts --include=*.tsx . 2>/dev/null | sed 's#^\./##' | sort | while read -r imp; do
    if [[ "$imp" =~ $AREA_RE ]]; then side=in; else side=OUT; fi
    # relative imports only count from the same folder
    if grep -qE "from '\./${base}'|jest\.mock\('\./${base}'" "$imp" && [[ "$(dirname "$imp")" != "$(dirname "$f")" ]] && ! grep -qE "from '${mod}'|jest\.mock\('${mod}'" "$imp"; then continue; fi
    names=$(grep -hE "from '${mod}'|from '\./${base}'" -B12 "$imp" | tr '\n' ' ' | grep -oE "import (type )?\{[^}]*\} from '(${mod}|\./${base})'" | sed -E "s/import (type )?\{([^}]*)\}.*/\2/" | tr -s ' ' | tr '\n' ';' )
    mocked=$(grep -qE "jest\.mock\('(${mod}|\./${base})'" "$imp" && echo " [jest.mock]" || true)
    echo "  $side $imp:${names}${mocked}"
  done
done
