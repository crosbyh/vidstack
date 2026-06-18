const fs = require('fs/promises');
const path = require('path');
const { buildFeed } = require('./feed');
const { invidiousWatchUrl } = require('./invidious');
const { srtToVtt } = require('./srt2vtt');

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function linkifyText(text) {
  return escapeHtml(text).replace(
    /(https?:\/\/[^\s<]+)/g,
    '<a href="$1" target="_blank" rel="noopener">$1</a>'
  );
}

function render(template, vars) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '');
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function buildSite(scanned, config) {
  const { outputDir, baseUrl, siteTitle, invidiousUrl, libraries } = config;
  const libBySlug = Object.fromEntries(libraries.map(l => [l.slug, l]));

  // Render the library tab bar; activeSlug highlights the current library.
  function buildTabs(activeSlug) {
    return libraries.map(l => {
      const active = l.slug === activeSlug ? ' nav-link--active' : '';
      return `<a href="${l.href}" class="nav-link${active}">${escapeHtml(l.name)}</a>`;
    }).join('');
  }

  // Shared, id-keyed output (media + per-video pages) lives at the site root so
  // libraries never collide and the default library keeps its legacy URLs.
  await Promise.all([
    ensureDir(path.join(outputDir, 'watch')),
    ensureDir(path.join(outputDir, 'embed')),
    ensureDir(path.join(outputDir, 'thumbs')),
    ensureDir(path.join(outputDir, 'videos')),
    ensureDir(path.join(outputDir, 'subs')),
  ]);
  await Promise.all(libraries.map(l => ensureDir(path.join(outputDir, l.indexPath, 'api'))));

  // Load templates
  const templatesDir = path.join(__dirname, 'templates');
  const [indexTpl, watchTpl, embedTpl, tagsTpl] = await Promise.all([
    fs.readFile(path.join(templatesDir, 'index.html'), 'utf-8'),
    fs.readFile(path.join(templatesDir, 'watch.html'), 'utf-8'),
    fs.readFile(path.join(templatesDir, 'embed.html'), 'utf-8'),
    fs.readFile(path.join(templatesDir, 'tags.html'), 'utf-8'),
  ]);

  // Copy static assets
  const staticDir = path.join(__dirname, '..', 'static');
  const staticFiles = await fs.readdir(staticDir);
  await Promise.all(
    staticFiles.map(f => fs.copyFile(path.join(staticDir, f), path.join(outputDir, f)))
  );

  // Process every video (shared media + watch/embed pages, keyed by id).
  const allVideos = scanned.flatMap(s => s.videos);
  for (const video of allVideos) {
    const lib = libBySlug[video.library];

    // Symlink video file
    const videoLink = path.join(outputDir, 'videos', `${video.id}.${video.videoExt}`);
    await symlink(video._videoFilePath, videoLink);

    // Symlink thumbnail
    if (video._thumbFilePath) {
      const thumbLink = path.join(outputDir, 'thumbs', `${video.id}${video._thumbExt}`);
      await symlink(video._thumbFilePath, thumbLink);
    }

    // Subtitles: convert .srt -> .vtt and expose a <track> (browsers need VTT).
    let trackHtml = '';
    if (video._subtitlePath) {
      try {
        const vtt = srtToVtt(await fs.readFile(video._subtitlePath, 'utf-8'));
        await fs.writeFile(path.join(outputDir, 'subs', `${video.id}.vtt`), vtt);
        trackHtml = `<track kind="subtitles" srclang="en" label="English" src="/subs/${video.id}.vtt" default>`;
      } catch (e) {
        console.warn(`Failed to convert subtitles for ${video.id}:`, e.message);
      }
    }

    const thumbExt = video._thumbExt || '.webp';
    const iframeEmbed = escapeHtml(`<iframe src="${baseUrl}/embed/${video.id}.html" width="560" height="315" frameborder="0" allowfullscreen></iframe>`);
    const videoEmbed = escapeHtml(`<video src="${baseUrl}/videos/${video.id}.${video.videoExt}" controls width="560"></video>`);

    // Stats HTML
    const stats = [];
    if (video.viewCount) stats.push(`${formatNumber(video.viewCount)} views`);
    if (video.likeCount) stats.push(`${formatNumber(video.likeCount)} likes`);
    const statsHtml = stats.length ? stats.join(' · ') : '';

    // Tags HTML
    let tagsHtml = '';
    const allTags = [...(video.tags || []), ...(video.categories || [])];
    if (allTags.length > 0) {
      const tagPills = allTags.map(t => `<a href="/tags.html?tag=${encodeURIComponent(t)}" class="tag">${escapeHtml(t)}</a>`).join('');
      tagsHtml = `<div class="tags">${tagPills}</div>`;
    }

    // External link HTML
    let originalUrlHtml = '';
    if (video.originalUrl) {
      originalUrlHtml = `<div class="original-link"><a href="${escapeHtml(video.originalUrl)}" target="_blank" rel="noopener">View on YouTube →</a></div>`;
    }

    // "Watch on Invidious" link (only for YouTube videos, when configured)
    let invidiousUrlHtml = '';
    const invUrl = invidiousWatchUrl(video, invidiousUrl);
    if (invUrl) {
      invidiousUrlHtml = `<div class="original-link"><a href="${escapeHtml(invUrl)}" target="_blank" rel="noopener">Watch on Invidious →</a></div>`;
    }

    const vars = {
      ...video,
      thumbExt,
      siteTitle: lib ? lib.name : siteTitle,
      baseUrl,
      tabsHtml: buildTabs(video.library),
      libraryHref: lib ? lib.href : '/',
      trackHtml,
      descriptionHtml: linkifyText(video.description),
      iframeEmbed,
      videoEmbed,
      statsHtml,
      tagsHtml,
      originalUrlHtml,
      invidiousUrlHtml,
    };

    // Write watch page
    await fs.writeFile(
      path.join(outputDir, 'watch', `${video.id}.html`),
      render(watchTpl, vars)
    );

    // Write embed page
    await fs.writeFile(
      path.join(outputDir, 'embed', `${video.id}.html`),
      render(embedTpl, vars)
    );
  }

  // Per-library manifest, feed, and index page.
  for (const { library, videos } of scanned) {
    const manifest = {
      siteTitle: library.name,
      library: library.slug,
      generatedAt: new Date().toISOString(),
      videos: videos.map(v => ({
        id: v.id,
        title: v.title,
        channel: v.channel,
        uploadDate: v.uploadDate,
        addedAt: v.addedAt,
        duration: v.duration,
        durationString: v.durationString,
        tags: v.tags,
        categories: v.categories,
        resolution: v.resolution,
        videoExt: v.videoExt,
        thumbExt: v._thumbExt || '.webp',
      })),
    };
    await fs.writeFile(
      path.join(outputDir, library.indexPath, 'api', 'videos.json'),
      JSON.stringify(manifest, null, 2)
    );

    await fs.writeFile(
      path.join(outputDir, library.feedFile),
      buildFeed(videos, { ...config, siteTitle: library.name, feedFile: library.feedFile })
    );

    await fs.writeFile(
      path.join(outputDir, library.indexPath, 'index.html'),
      render(indexTpl, {
        siteTitle: library.name,
        tabsHtml: buildTabs(library.slug),
        manifestUrl: library.manifestUrl,
        feedUrl: library.feedUrl,
      })
    );
  }

  // Tags page (single, driven by the default library's manifest).
  await fs.writeFile(
    path.join(outputDir, 'tags.html'),
    render(tagsTpl, { siteTitle, tabsHtml: buildTabs(null) })
  );
}

async function symlink(target, linkPath) {
  try {
    await fs.unlink(linkPath);
  } catch (e) {
    // doesn't exist yet, fine
  }
  await fs.symlink(target, linkPath);
}

function formatNumber(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

module.exports = { buildSite };
