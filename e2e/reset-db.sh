#!/bin/sh
# A run's fresh data, in the database E2E_DB_URL names (a lane's own, or the serial run's; never the one
# the app is developed on): emptied, migrated to the app's current schema, and given seed.sql's synthetic
# users and sessions. Prints the migration's last line, which lanes-up.sh checks.
E=$(cd "$(dirname "$0")" && pwd)
U=$E2E_DB_URL
[ -n "$U" ] || { echo "E2E_DB_URL is unset: the database to reset (README.md)" >&2; exit 2; }
export DB_URL="$U" DIRECT_DATABASE_URL="$U"
psql "$U" -qc 'drop schema public cascade' -c 'create schema public' >/dev/null 2>&1
(cd "$(dirname "$E")" && npx prisma migrate deploy 2>&1 | tail -1)
psql "$U" -q -v ON_ERROR_STOP=1 -f "$E/seed.sql" >/dev/null || { echo "seed.sql did not load into $U" >&2; exit 1; }
