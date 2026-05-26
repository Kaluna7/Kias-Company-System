#!/bin/sh
# MinIO Community Edition: per-bucket CORS (mc cors set) is NOT supported.
# Use global API CORS instead. Run from repo root on VPS:
#
#   sh scripts/setup-minio-cors.sh
#
# Or:
#   ORIGIN=http://76.13.20.134:3001 sh scripts/setup-minio-cors.sh
set -e

NETWORK="${MINIO_DOCKER_NETWORK:-kias-company-system_default}"
ENDPOINT="${MINIO_ENDPOINT:-http://minio:9000}"
MC_USER="${MINIO_ROOT_USER:-minioadmin}"
MC_PASS="${MINIO_ROOT_PASSWORD:-minioadmin}"
BUCKET="${MINIO_BUCKET:-evidence}"
# Comma-separated origins, or * for all (dev only)
ORIGIN="${CORS_ALLOW_ORIGIN:-*}"

run_mc() {
  docker run --rm --network "$NETWORK" \
    --entrypoint /bin/sh \
    minio/mc -c "$1"
}

echo "Setting MinIO global CORS (cors_allow_origin=$ORIGIN)..."

run_mc "
  mc alias set kias $ENDPOINT $MC_USER $MC_PASS &&
  mc mb -p kias/$BUCKET 2>/dev/null || true &&
  mc admin config set kias api cors_allow_origin=$ORIGIN &&
  mc admin service restart kias
"

echo "Done. Wait ~10s for MinIO to restart, then test evidence upload."
echo "To allow only your app: ORIGIN=http://YOUR_IP:3001 sh scripts/setup-minio-cors.sh"
