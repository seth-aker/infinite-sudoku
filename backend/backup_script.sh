#! /bin/bash

set -e

DATE=$(date +%Y-%m-%d_%H-%M-%S)
BACKUP_DIR="$HOME/backups/sudoku"
CONTAINER_NAME=sudoku_postgres
PG_USER=saker132
DATABASE_NAME=sudoku_db

BACKUP_FILE="${BACKUP_DIR}/${DATABASE_NAME}_backup_${DATE}.sql"
CLOUD_BACKUP_LOCATION="gs://sudoku-postgres-backup"
echo " "
echo "${date}: STARTING SUDOKU BACKUP"

echo "${date}: Dumping database in ${CONTAINER_NAME} to ${BACKUP_FILE}"
/usr/bin/docker exec "$CONTAINER_NAME" pg_dump -U "$PG_USER" -d "$DATABASE_NAME" > "$BACKUP_FILE"

/usr/bin/gcloud storage cp "${BACKUP_FILE}" "${CLOUD_BACKUP_LOCATION}"

echo "${date} Removing local backups older than 7 days"

find "$BACKUP_DIR" -type f -name "*.sql" -mtime +7 -exec rm {} \;

echo " "
echo "${date}: BACKUP COMPLETE"
