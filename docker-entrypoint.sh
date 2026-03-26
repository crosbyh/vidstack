#!/bin/sh
set -e

cd /app

export VIDEO_DIR="${VIDEO_DIR:-/data/videos}"
export BASE_URL="${BASE_URL:-http://localhost}"
export SITE_TITLE="${SITE_TITLE:-My Videos}"
export OUTPUT_DIR="/usr/share/nginx/html"

# Initial build
echo "Building site..."
node build.js
echo "Build complete."

# Cron job to rebuild every minute
echo "* * * * * cd /app && node build.js && nginx -s reload" | crontab -
crond

echo "Starting nginx..."
exec nginx -g 'daemon off;'
