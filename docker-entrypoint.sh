#!/bin/sh
set -e

cd /app

echo "Building site..."
VIDEO_DIR="${VIDEO_DIR:-/data/videos}" \
BASE_URL="${BASE_URL:-http://localhost}" \
SITE_TITLE="${SITE_TITLE:-My Videos}" \
OUTPUT_DIR="/usr/share/nginx/html" \
node build.js

echo "Starting nginx..."
exec nginx -g 'daemon off;'
