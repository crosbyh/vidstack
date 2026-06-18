const fs = require('fs/promises');
const path = require('path');
const { VIDEO_EXTENSIONS, MIME_TYPES, formatDuration } = require('./scan-utils');

// Decode the small set of XML/HTML entities ytdl-sub writes into .nfo files.
// &amp; is decoded last so e.g. "&amp;#39;" doesn't get expanded twice.
function decodeEntities(s) {
  if (!s) return s;
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

// Read the text content of a flat child element, e.g. <title>...</title>.
function tag(xml, name) {
  const m = xml.match(new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)</${name}>`, 'i'));
  return m ? decodeEntities(m[1].trim()) : null;
}

// Read <uniqueid type="youtube" ...>ID</uniqueid>, falling back to any uniqueid.
function youtubeUniqueId(xml) {
  const typed = xml.match(/<uniqueid\b[^>]*\btype="youtube"[^>]*>([\s\S]*?)<\/uniqueid>/i);
  if (typed) return decodeEntities(typed[1].trim());
  return tag(xml, 'uniqueid');
}

// Parse a single <episodedetails> .nfo into the fields we care about.
function parseNfo(xml) {
  return {
    title: tag(xml, 'title'),
    showtitle: tag(xml, 'showtitle'),
    plot: tag(xml, 'plot'),
    aired: tag(xml, 'aired'),
    genre: tag(xml, 'genre'),
    youtubeId: youtubeUniqueId(xml),
  };
}

async function readDir(dir) {
  try {
    return await fs.readdir(dir, { withFileTypes: true });
  } catch (e) {
    console.warn(`Cannot read directory: ${dir}`, e.message);
    return [];
  }
}

// Build one video object from an episode video file + its sibling metadata.
async function scanEpisode(seasonPath, videoFile, library) {
  const ext = path.extname(videoFile).toLowerCase();
  const base = videoFile.slice(0, -ext.length);
  const videoFilePath = path.join(seasonPath, videoFile);

  const nfoPath = path.join(seasonPath, `${base}.nfo`);
  let meta;
  try {
    meta = parseNfo(await fs.readFile(nfoPath, 'utf-8'));
  } catch (e) {
    console.warn(`No .nfo for episode, skipping: ${videoFile}`);
    return null;
  }

  if (!meta.youtubeId) {
    console.warn(`No youtube uniqueid in .nfo, skipping: ${videoFile}`);
    return null;
  }

  // Sibling thumbnail (<base>-thumb.jpg) and subtitles (<base>.en.srt).
  const thumbName = `${base}-thumb.jpg`;
  const thumbPath = path.join(seasonPath, thumbName);
  const hasThumb = await fs.access(thumbPath).then(() => true, () => false);

  const srtPath = path.join(seasonPath, `${base}.en.srt`);
  const hasSrt = await fs.access(srtPath).then(() => true, () => false);

  const stat = await fs.stat(videoFilePath);
  const id = meta.youtubeId;

  return {
    id,
    library: library.slug,
    title: meta.title || base,
    uploadDate: meta.aired ? meta.aired.slice(0, 10) : null,
    duration: 0,
    durationString: formatDuration(0),
    channel: meta.showtitle || 'Unknown',
    tags: [],
    categories: meta.genre ? [meta.genre] : [],
    description: meta.plot || '',
    videoExt: ext.slice(1),
    mimeType: MIME_TYPES[ext] || 'video/mp4',
    resolution: null,
    fps: null,
    vcodec: null,
    acodec: null,
    addedAt: stat.mtime.toISOString(),
    // Synthesize a YouTube URL so Invidious links and "View on YouTube" work.
    originalUrl: `https://www.youtube.com/watch?v=${id}`,
    viewCount: null,
    likeCount: null,
    _videoFilePath: videoFilePath,
    _thumbFilePath: hasThumb ? thumbPath : null,
    _thumbExt: hasThumb ? '.jpg' : null,
    _subtitlePath: hasSrt ? srtPath : null,
  };
}

// "tvshow" layout: <root>/<Channel>/Season <YYYY>/<episode>.{mp4,nfo,...}
async function scanTvshow(library) {
  const resolvedDir = path.resolve(library.path);
  const videos = [];

  for (const channel of await readDir(resolvedDir)) {
    if (!channel.isDirectory()) continue;
    const channelPath = path.join(resolvedDir, channel.name);

    for (const season of await readDir(channelPath)) {
      if (!season.isDirectory()) continue;
      const seasonPath = path.join(channelPath, season.name);

      for (const entry of await readDir(seasonPath)) {
        if (!entry.isFile()) continue;
        if (!VIDEO_EXTENSIONS.includes(path.extname(entry.name).toLowerCase())) continue;
        const video = await scanEpisode(seasonPath, entry.name, library);
        if (video) videos.push(video);
      }
    }
  }

  // Sort by upload date descending (newest first)
  videos.sort((a, b) => (b.uploadDate || '').localeCompare(a.uploadDate || ''));
  return videos;
}

module.exports = { scanTvshow, parseNfo };
