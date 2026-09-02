#!/usr/bin/env bash

# ====================================================================
# scripts/prod-backup.sh
# سكريبت الأتمتة والنسخ الاحتياطي السحابي المشفّر (AES-256-CBC Encrypted Production Backup Engine)
# نظام إدارة الأشغال والخدمات الهندسية - بلدية كفرنجة الجديدة v4.0 Enterprise
# ====================================================================

set -euo pipefail

# 1. إعداد المتغيرات والمسارات الرئيسية
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="${PROJECT_ROOT}/backups"
LOG_FILE="${PROJECT_ROOT}/logs/backup-ops.log"
PASSPHRASE="${BACKUP_ENCRYPTION_KEY:-KafrInjaEnterprise2026SecureKey}"

# بيانات اتصال قاعدة البيانات
PGHOST="${PGHOST:-localhost}"
PGPORT="${PGPORT:-5432}"
PGUSER="${PGUSER:-postgres}"
PGDATABASE="${PGDATABASE:-kafr_inja_engineering}"

# تضمن وجود مجلد النسخ الاحتياطي والسجلات
mkdir -p "${BACKUP_DIR}" "$(dirname "${LOG_FILE}")"

log_message() {
    local LEVEL="$1"
    local MSG="$2"
    local ISO_TIME
    ISO_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    echo "{\"timestamp\":\"${ISO_TIME}\",\"level\":\"${LEVEL}\",\"category\":\"BACKUP_OPS\",\"message\":\"${MSG}\"}" >> "${LOG_FILE}"
    echo "[${ISO_TIME}] [${LEVEL}] ${MSG}"
}

log_message "INFO" "⚡ Starting Production Backup & Encryption Task..."

# 2. إنشاء نسخة احتياطية (PG Dump أو أخذ الملفات المحلية)
DUMP_FILE="${BACKUP_DIR}/pms_backup_${TIMESTAMP}.sql"
TAR_FILE="${BACKUP_DIR}/pms_backup_${TIMESTAMP}.tar.gz"
ENC_FILE="${BACKUP_DIR}/pms_backup_${TIMESTAMP}.enc"

if command -v pg_dump >/dev/null 2>&1; then
    log_message "INFO" "Exporting PostgreSQL database dump..."
    PGPASSWORD="${PGPASSWORD:-postgres}" pg_dump -h "${PGHOST}" -p "${PGPORT}" -U "${PGUSER}" -d "${PGDATABASE}" -F c -b -v -f "${DUMP_FILE}" || true
fi

# في حال تعثر pg_dump أو العمل المحلي، يتم تجميع ملفات JSON و Access
if [ ! -f "${DUMP_FILE}" ] || [ ! -s "${DUMP_FILE}" ]; then
    log_message "WARN" "pg_dump unavailable or empty. Creating archive of local database files..."
    tar -czf "${TAR_FILE}" -C "${PROJECT_ROOT}" database uploads || true
else
    tar -czf "${TAR_FILE}" -C "${BACKUP_DIR}" "$(basename "${DUMP_FILE}")"
    rm -f "${DUMP_FILE}"
fi

# 3. التشفير المزدوج باستخدام AES-256-CBC و PBKDF2
if [ -f "${TAR_FILE}" ]; then
    log_message "INFO" "Encrypting backup archive using AES-256-CBC..."
    openssl enc -aes-256-cbc -pbkdf2 -salt -in "${TAR_FILE}" -out "${ENC_FILE}" -k "${PASSPHRASE}"
    rm -f "${TAR_FILE}"
    log_message "INFO" "🔒 Backup file encrypted successfully: $(basename "${ENC_FILE}")"
else
    log_message "ERROR" "❌ Failed to create backup archive."
    exit 1
fi

# 4. الرفع التلقائي إلى البيئة السحابية الآمنة (S3 Bucket / Remote Server)
S3_BUCKET="${BACKUP_S3_BUCKET:-s3://kafr-inja-engineering-backups}"

if command -v aws >/dev/null 2>&1; then
    log_message "INFO" "Uploading encrypted backup to AWS S3 (${S3_BUCKET})..."
    aws s3 cp "${ENC_FILE}" "${S3_BUCKET}/" --only-show-errors && \
    log_message "INFO" "✅ Backup uploaded successfully to AWS S3."
elif command -v rclone >/dev/null 2>&1; then
    log_message "INFO" "Uploading encrypted backup via rclone..."
    rclone copy "${ENC_FILE}" remote:kafr-inja-backups && \
    log_message "INFO" "✅ Backup uploaded successfully via rclone."
else
    log_message "WARN" "No Cloud CLI (aws/rclone) detected. Backup is stored securely locally at ${ENC_FILE}"
fi

# 5. تنظيف النسخ الاحتياطية القديمة (أكثر من 30 يوم)
find "${BACKUP_DIR}" -type f -name "*.enc" -mtime +30 -exec rm -f {} \;
log_message "INFO" "✅ Backup job finished successfully."

exit 0
