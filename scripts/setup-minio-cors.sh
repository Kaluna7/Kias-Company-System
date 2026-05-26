#!/bin/sh
# Run on VPS once after MinIO is up (requires mc in PATH or use minio/mc container).
set -e
ENDPOINT="${MINIO_ENDPOINT:-http://localhost:9000}"
USER="${MINIO_ROOT_USER:-minioadmin}"
PASS="${MINIO_ROOT_PASSWORD:-minioadmin}"
BUCKET="${MINIO_BUCKET:-evidence}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

mc alias set kias "$ENDPOINT" "$USER" "$PASS"
mc mb -p "kias/$BUCKET" 2>/dev/null || true
mc cors set "$SCRIPT_DIR/../infra/minio-cors.json" "kias/$BUCKET"
echo "Bucket $BUCKET ready with CORS."
