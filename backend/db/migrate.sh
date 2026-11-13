#!/bin/sh
# Applies pending SQL migrations from /db/migrations, in filename order.
# Each migration runs in its own transaction and is recorded in
# public.schema_migrations, so re-running this script is safe.
#
# If any migrations are pending, a pg_dump backup is written to
# $BACKUP_DIR (default /backups) first. The migration aborts if it fails.
#
# Connection settings come from the standard libpq env vars:
#   PGHOST, PGUSER, PGPASSWORD, PGDATABASE
set -eu

umask 077

DB_DIR=/db
MIGRATIONS_DIR="$DB_DIR/migrations"
BACKUP_DIR="${BACKUP_DIR:-/backups}"


run_psql() { psql -X -v ON_ERROR_STOP=1 -q "$@"; }
query()    { psql -X -tA -v ON_ERROR_STOP=1 -c "$1"; }

run_psql -c "CREATE TABLE IF NOT EXISTS public.schema_migrations (
  version    text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);"

# Collect pending migrations into the positional parameters ("$@") so paths
# containing spaces or other special characters stay intact.
# Version strings never get spliced into SQL text: they are passed as psql
# variables and quoted by psql with :'v'.
applied=$(query "SELECT version FROM public.schema_migrations")
set --
for f in "$MIGRATIONS_DIR"/*.sql; do
  [ -e "$f" ] || continue
  v=$(basename "$f" .sql)
  if ! printf '%s\n' "$applied" | grep -Fxq -- "$v"; then
    set -- "$@" "$f"
  fi
done

if [ "$#" -eq 0 ]; then
  echo "No pending migrations"
  exit 0
fi

# Back up before touching anything. Write to a temp name and rename on
# success so a partial dump is never mistaken for a good one.
first=$(basename "$1" .sql)
backup="$BACKUP_DIR/${PGDATABASE}_$(date -u +%Y%m%dT%H%M%SZ)_pre-${first}.dump"
echo "Backing up database to $backup"
pg_dump -Fc -f "$backup.partial"
mv "$backup.partial" "$backup"
echo "Backup complete ($(du -h "$backup" | cut -f1))"

applied_count=0
for f in "$@"; do
  v=$(basename "$f" .sql)
  echo "Applying migration $v"
  # -1 wraps the file and the bookkeeping insert in a single transaction.
  # The insert is read from stdin (-f -) because psql does not substitute
  # variables inside -c strings.
  run_psql -1 -v v="$v" -f "$f" -f - <<'SQL'
INSERT INTO public.schema_migrations (version) VALUES (:'v');
SQL
  applied_count=$((applied_count + 1))
done

echo "Migrations complete ($applied_count applied)"
