#!/bin/sh
set -e

cd /app

run_build() {
  echo "Building site..."
  VIDEO_DIR="${VIDEO_DIR:-/data/videos}" \
  BASE_URL="${BASE_URL:-http://localhost}" \
  SITE_TITLE="${SITE_TITLE:-My Videos}" \
  OUTPUT_DIR="/usr/share/nginx/html" \
  node build.js
  echo "Build complete."
}

# Initial build
run_build

# Watch for new videos in background
VIDEO_DIR="${VIDEO_DIR:-/data/videos}"
if command -v inotifywait >/dev/null 2>&1; then
  echo "Watching ${VIDEO_DIR} for changes..."
  (
    while inotifywait -r -e create,delete,moved_to "${VIDEO_DIR}" 2>/dev/null; do
      echo "Change detected, rebuilding in 5s..."
      sleep 5
      run_build
      nginx -s reload
    done
  ) &
else
  echo "inotifywait not found, skipping file watch."
fi

echo "Starting nginx..."
exec nginx -g 'daemon off;'
