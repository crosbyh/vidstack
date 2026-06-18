// Shared helpers used by the scanner adapters (flat + tvshow).

const VIDEO_EXTENSIONS = ['.webm', '.mp4', '.mkv', '.mov', '.avi', '.flv'];

const MIME_TYPES = {
  '.webm': 'video/webm',
  '.mp4': 'video/mp4',
  '.mkv': 'video/x-matroska',
  '.mov': 'video/quicktime',
  '.avi': 'video/x-msvideo',
  '.flv': 'video/x-flv',
};

// yt-dlp upload_date is "YYYYMMDD"; produce "YYYY-MM-DD".
function formatDate(yyyymmdd) {
  if (!yyyymmdd || yyyymmdd.length !== 8) return null;
  return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;
}

function formatDuration(seconds) {
  if (!seconds) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

module.exports = { VIDEO_EXTENSIONS, MIME_TYPES, formatDate, formatDuration };
