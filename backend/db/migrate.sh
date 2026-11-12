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

DB_DIR=/db
MIGRATIONS_DIR="$DB_DIR/migrations"
BACKUP_DIR="${BACKUP_DIR:-/backups}"


run_psql() { psql -X -v ON_ERROR_STOP=1 -q "$@"; }
query()    { psql -X -tA -v ON_ERROR_STOP=1 -c "$1"; }

run_psql -c "CREATE TABLE IF NOT EXISTS public.schema_migrations (
  version    text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);"

# A brand-new database gets schema.sql, which already reflects every
# migration, so all existing migrations are recorded as applied.
if [ "$(query "SELECT to_regclass('public.users') IS NULL")" = "t" ]; then
  echo "Empty database detected: applying schema.sql as baseline"
  run_psql -1 -f "$DB_DIR/schema.sql"
  for f in "$MIGRATIONS_DIR"/*.sql; do
    [ -e "$f" ] || continue
    v=$(basename "$f" .sql)
    run_psql -c "INSERT INTO public.schema_migrations (version) VALUES ('$v') ON CONFLICT DO NOTHING;"
  done
  echo "Baseline complete"
  exit 0
fi

# Collect pending migrations.
pending=""
for f in "$MIGRATIONS_DIR"/*.sql; do
  [ -e "$f" ] || continue
  v=$(basename "$f" .sql)
  if [ "$(query "SELECT 1 FROM public.schema_migrations WHERE version = '$v'")" != "1" ]; then
    pending="$pending $f"
  fi
done

if [ -z "$pending" ]; then
  echo "No pending migrations"
  exit 0
fi

# Back up before touching anything. Write to a temp name and rename on
# success so a partial dump is never mistaken for a good one.
first=$(basename $(echo $pending | cut -d' ' -f1) .sql)
backup="$BACKUP_DIR/${PGDATABASE}_$(date -u +%Y%m%dT%H%M%SZ)_pre-${first}.dump"
echo "Backing up database to $backup"
pg_dump -Fc -f "$backup.partial"
mv "$backup.partial" "$backup"
echo "Backup complete ($(du -h "$backup" | cut -f1))"

applied_count=0
for f in $pending; do
  v=$(basename "$f" .sql)
  echo "Applying migration $v"
  # -1 wraps the file and the bookkeeping insert in a single transaction.
  run_psql -1 \
    -f "$f" \
    -c "INSERT INTO public.schema_migrations (version) VALUES ('$v');"
  applied_count=$((applied_count + 1))
done

echo "Migrations complete ($applied_count applied)"
