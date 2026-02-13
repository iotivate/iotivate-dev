#!/usr/bin/env bash
#
# Database Backup Script for iotivate.dev
#
# Dumps the PostgreSQL database to a gzipped file with a timestamped filename.
# Old backups are cleaned up based on a configurable retention period.
#
# Environment variables:
#   DATABASE_URL           — PostgreSQL connection string (required)
#   BACKUP_DIR             — Directory to store backups (default: ./backups)
#   BACKUP_RETENTION_DAYS  — Delete backups older than N days (default: 30)
#
# Usage:
#   ./scripts/backup.sh
#
# Cron setup (daily at 2am):
#   0 2 * * * cd /path/to/backend && ./scripts/backup.sh >> /var/log/iotivate-backup.log 2>&1
#
# For managed databases (e.g., AWS RDS, DigitalOcean, Supabase):
#   Most managed PostgreSQL providers offer automated backups with point-in-time
#   recovery. If you're using one, you may not need this script. Check your
#   provider's backup settings instead.
#

set -euo pipefail

if [ -z "${DATABASE_URL:-}" ]; then
    echo "ERROR: DATABASE_URL is not set" >&2
    exit 1
fi

BACKUP_DIR="${BACKUP_DIR:-./backups}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
FILENAME="iotivate_backup_${TIMESTAMP}.sql.gz"

mkdir -p "$BACKUP_DIR"

echo "Starting backup at $(date -Iseconds)"
echo "  Database: ${DATABASE_URL%%@*}@***"
echo "  Output:   ${BACKUP_DIR}/${FILENAME}"

pg_dump "$DATABASE_URL" | gzip > "${BACKUP_DIR}/${FILENAME}"

FILESIZE=$(du -h "${BACKUP_DIR}/${FILENAME}" | cut -f1)
echo "  Size:     ${FILESIZE}"
echo "Backup complete."

# Clean up old backups
DELETED=$(find "$BACKUP_DIR" -name "iotivate_backup_*.sql.gz" -mtime +"$BACKUP_RETENTION_DAYS" -print -delete | wc -l)
if [ "$DELETED" -gt 0 ]; then
    echo "Deleted ${DELETED} backup(s) older than ${BACKUP_RETENTION_DAYS} days."
fi

echo "Done at $(date -Iseconds)"
