#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="/etc/961-media-backup.env"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE" >&2
  exit 1
fi

# shellcheck disable=SC1090
source "$ENV_FILE"

: "${PGDATABASE:?PGDATABASE is required}"
: "${PGUSER:?PGUSER is required}"
: "${PGHOST:=127.0.0.1}"
: "${WASABI_BUCKET:?WASABI_BUCKET is required}"
: "${WASABI_REGION:?WASABI_REGION is required}"
: "${WASABI_ENDPOINT:?WASABI_ENDPOINT is required}"
: "${WASABI_ACCESS_KEY_ID:?WASABI_ACCESS_KEY_ID is required}"
: "${WASABI_SECRET_ACCESS_KEY:?WASABI_SECRET_ACCESS_KEY is required}"

export AWS_ACCESS_KEY_ID="$WASABI_ACCESS_KEY_ID"
export AWS_SECRET_ACCESS_KEY="$WASABI_SECRET_ACCESS_KEY"
export AWS_DEFAULT_REGION="$WASABI_REGION"

STAMP="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT
DUMP_FILE="$TMP_DIR/961-media-${STAMP}.dump"

pg_dump --format=custom --file="$DUMP_FILE" --host="$PGHOST" --username="$PGUSER" "$PGDATABASE"

aws s3 cp "$DUMP_FILE" \
  "s3://${WASABI_BUCKET}/backups/postgres/daily/961-media-${STAMP}.dump" \
  --endpoint-url "$WASABI_ENDPOINT" \
  --only-show-errors

# Keep a dated local copy for fast recovery. Remote retention is handled by Wasabi lifecycle rules.
install -d -m 0750 /var/backups/961-media
cp "$DUMP_FILE" "/var/backups/961-media/961-media-${STAMP}.dump"
find /var/backups/961-media -type f -name '*.dump' -mtime +7 -delete
