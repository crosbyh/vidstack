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
# Cron runs in a clean env, so we pass all config inline
cat <<CRON | crontab -
* * * * * cd /app && VIDEO_DIR="${VIDEO_DIR}" BASE_URL="${BASE_URL}" SITE_TITLE="${SITE_TITLE}" OUTPUT_DIR="${OUTPUT_DIR}" node build.js && nginx -s reload 2>&1 | logger -t vidstack
CRON
crond

echo "Starting nginx..."
exec nginx -g 'daemon off;'
