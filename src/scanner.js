const fs = require('fs/promises');
const path = require('path');

const VIDEO_EXTENSIONS = ['.webm', '.mp4', '.mkv', '.mov', '.avi', '.flv'];
const MIME_TYPES = {
  '.webm': 'video/webm',
  '.mp4': 'video/mp4',
  '.mkv': 'video/x-matroska',
  '.mov': 'video/quicktime',
  '.avi': 'video/x-msvideo',
  '.flv': 'video/x-flv',
};

function extractVideoId(folderName) {
  const match = folderName.match(/\[([^\]]+)\]$/);
  return match ? match[1] : null;
}

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

async function scanVideo(folderPath, folderName) {
  const videoId = extractVideoId(folderName);
  if (!videoId) return null;

  const entries = await fs.readdir(folderPath);

  // Find files by extension
  const infoFile = entries.find(f => f.endsWith('.info.json'));
  const descFile = entries.find(f => f.endsWith('.description'));
  const thumbFile = entries.find(f => f.endsWith('.webp') || f.endsWith('.jpg') || f.endsWith('.png'));
  const videoFile = entries.find(f => VIDEO_EXTENSIONS.includes(path.extname(f).toLowerCase()));

  if (!videoFile) {
    console.warn(`No video file found in: ${folderName}`);
    return null;
  }

  // Parse info.json
  let info = {};
  if (infoFile) {
    try {
      const raw = await fs.readFile(path.join(folderPath, infoFile), 'utf-8');
      info = JSON.parse(raw);
    } catch (e) {
      console.warn(`Failed to parse info.json in: ${folderName}`, e.message);
    }
  }

  // Read description file
  let description = '';
  if (descFile) {
    try {
      description = await fs.readFile(path.join(folderPath, descFile), 'utf-8');
    } catch (e) {
      description = info.description || '';
    }
  } else {
    description = info.description || '';
  }

  const ext = path.extname(videoFile).toLowerCase();

  // Use video file mtime as "added" date
  const videoFilePath = path.join(folderPath, videoFile);
  const stat = await fs.stat(videoFilePath);
  const addedDate = stat.mtime.toISOString().slice(0, 10);

  return {
    id: videoId,
    title: info.title || folderName.replace(/\s*\[[^\]]+\]$/, ''),
    uploadDate: formatDate(info.upload_date) || null,
    duration: info.duration || 0,
    durationString: info.duration_string || formatDuration(info.duration),
    channel: info.channel || info.uploader || 'Unknown',
    tags: info.tags || [],
    categories: info.categories || [],
    description,
    videoExt: ext.slice(1),
    mimeType: MIME_TYPES[ext] || 'video/mp4',
    resolution: info.resolution || null,
    fps: info.fps || null,
    vcodec: info.vcodec || null,
    acodec: info.acodec || null,
    addedDate,
    originalUrl: info.webpage_url || null,
    viewCount: info.view_count || null,
    likeCount: info.like_count || null,
    // Absolute paths for symlink creation
    _videoFilePath: videoFilePath,
    _thumbFilePath: thumbFile ? path.join(folderPath, thumbFile) : null,
    _thumbExt: thumbFile ? path.extname(thumbFile) : null,
  };
}

async function scanVideos(videoDir) {
  const resolvedDir = path.resolve(videoDir);
  const entries = await fs.readdir(resolvedDir, { withFileTypes: true });
  const videos = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const folderPath = path.join(resolvedDir, entry.name);
    const video = await scanVideo(folderPath, entry.name);
    if (video) videos.push(video);
  }

  // Sort by upload date descending (newest first)
  videos.sort((a, b) => (b.uploadDate || '').localeCompare(a.uploadDate || ''));
  return videos;
}

module.exports = { scanVideos };
