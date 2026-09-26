#!/bin/bash

BACKUP_DIR="/opt/server-api/backups"
BACKUP_DATAS_GLADYS="/var/lib/gladysassistant"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="$BACKUP_DIR/backup.log"
#chmod -R 775 "$BACKUP_DIR"
# Create timestamp directory
BACKUP_PATH="$BACKUP_DIR/$TIMESTAMP"
mkdir -p "$BACKUP_PATH"
echo "[$(date)] Starting Docker backup" >> "$LOG_FILE"

# Backup container persistent datas gladys
    echo "[$(date)] Exporting datas: $BACKUP_DATAS_GLADYS" >> "$LOG_FILE"
    tar -cvzf "$BACKUP_DIR"/datas.tar.gz "$BACKUP_DATAS_GLADYS"  2>> "$LOG_FILE"
    cp  "$BACKUP_DIR"/datas.tar.gz  "$BACKUP_PATH"/datas.tar.gz
# Compress backup directory
echo "[$(date)] Compressing backup" >> "$LOG_FILE"
cd "$BACKUP_DIR"
tar czf "${TIMESTAMP}.tar.gz" "$TIMESTAMP"
rm -rf "$TIMESTAMP"

# Calculate size
SIZE=$(du -sh "${TIMESTAMP}.tar.gz" | cut -f1)
echo "[$(date)] Backup completed. Size: $SIZE" >> "$LOG_FILE"

# Keep only last 5 backups
find "$BACKUP_DIR" -maxdepth 1 -name "*.tar.gz" -type f -mtime +5 -delete

# Verify backup
ls -lh /opt/server-api/backups/
