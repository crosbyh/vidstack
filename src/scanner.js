const fs = require('fs/promises');
const path = require('path');
const { VIDEO_EXTENSIONS, MIME_TYPES, formatDate, formatDuration } = require('./scan-utils');
const { scanTvshow } = require('./scanner-tvshow');

function extractVideoId(folderName) {
  const match = folderName.match(/\[([^\]]+)\]$/);
  return match ? match[1] : null;
}

async function scanVideo(folderPath, folderName, library) {
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

  // Use video file mtime as "added" timestamp
  const videoFilePath = path.join(folderPath, videoFile);
  const stat = await fs.stat(videoFilePath);
  const addedAt = stat.mtime.toISOString();

  return {
    id: videoId,
    library: library.slug,
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
    addedAt,
    originalUrl: info.webpage_url || null,
    viewCount: info.view_count || null,
    likeCount: info.like_count || null,
    // Absolute paths for symlink creation
    _videoFilePath: videoFilePath,
    _thumbFilePath: thumbFile ? path.join(folderPath, thumbFile) : null,
    _thumbExt: thumbFile ? path.extname(thumbFile) : null,
    _subtitlePath: null,
  };
}

// "flat" layout: one Title [videoId]/ folder per video with a .info.json.
async function scanFlat(library) {
  const resolvedDir = path.resolve(library.path);
  const entries = await fs.readdir(resolvedDir, { withFileTypes: true });
  const videos = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const folderPath = path.join(resolvedDir, entry.name);
    const video = await scanVideo(folderPath, entry.name, library);
    if (video) videos.push(video);
  }

  // Sort by upload date descending (newest first)
  videos.sort((a, b) => (b.uploadDate || '').localeCompare(a.uploadDate || ''));
  return videos;
}

// Dispatch to the adapter for a library's layout.
async function scanLibrary(library) {
  if (library.layout === 'tvshow') return scanTvshow(library);
  return scanFlat(library);
}

// Back-compat alias for the original single-folder entry point.
async function scanVideos(videoDir) {
  return scanFlat({ slug: 'library', path: videoDir, layout: 'flat' });
}

module.exports = { scanLibrary, scanVideos };
