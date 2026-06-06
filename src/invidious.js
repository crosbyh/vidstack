// Builds "Watch on Invidious" URLs for YouTube-sourced videos.
//
// Invidious only proxies YouTube, so we gate on the source actually being
// YouTube (derived from the original webpage_url) and reuse the canonical
// 11-char video id rather than blindly trusting the folder-bracket id, which
// can come from other yt-dlp extractors.

function youtubeId(video) {
  const url = video.originalUrl || '';
  const m = url.match(
    /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/
  );
  return m ? m[1] : null;
}

// Returns the Invidious watch URL for a video, or null when Invidious is not
// configured or the video is not a YouTube video.
function invidiousWatchUrl(video, invidiousUrl) {
  if (!invidiousUrl) return null;
  const id = youtubeId(video);
  if (!id) return null;
  return `${invidiousUrl}/watch?v=${id}`;
}

module.exports = { invidiousWatchUrl, youtubeId };
