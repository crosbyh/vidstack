const fs = require('fs/promises');
const path = require('path');

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

async function buildSite(videos, config) {
  const { outputDir, baseUrl, siteTitle } = config;

  // Create directories
  await Promise.all([
    ensureDir(path.join(outputDir, 'watch')),
    ensureDir(path.join(outputDir, 'embed')),
    ensureDir(path.join(outputDir, 'api')),
    ensureDir(path.join(outputDir, 'thumbs')),
    ensureDir(path.join(outputDir, 'videos')),
  ]);

  // Load templates
  const templatesDir = path.join(__dirname, 'templates');
  const [indexTpl, watchTpl, embedTpl] = await Promise.all([
    fs.readFile(path.join(templatesDir, 'index.html'), 'utf-8'),
    fs.readFile(path.join(templatesDir, 'watch.html'), 'utf-8'),
    fs.readFile(path.join(templatesDir, 'embed.html'), 'utf-8'),
  ]);

  // Copy static assets
  const staticDir = path.join(__dirname, '..', 'static');
  const staticFiles = await fs.readdir(staticDir);
  await Promise.all(
    staticFiles.map(f => fs.copyFile(path.join(staticDir, f), path.join(outputDir, f)))
  );

  // Process each video
  for (const video of videos) {
    // Symlink video file
    const videoLink = path.join(outputDir, 'videos', `${video.id}.${video.videoExt}`);
    await symlink(video._videoFilePath, videoLink);

    // Symlink thumbnail
    if (video._thumbFilePath) {
      const thumbLink = path.join(outputDir, 'thumbs', `${video.id}${video._thumbExt}`);
      await symlink(video._thumbFilePath, thumbLink);
    }

    const thumbExt = video._thumbExt || '.webp';
    const iframeEmbed = escapeHtml(`<iframe src="${baseUrl}/embed/${video.id}" width="560" height="315" frameborder="0" allowfullscreen></iframe>`);
    const videoEmbed = escapeHtml(`<video src="${baseUrl}/videos/${video.id}.${video.videoExt}" controls width="560"></video>`);

    // Stats HTML
    const stats = [];
    if (video.viewCount) stats.push(`${formatNumber(video.viewCount)} views`);
    if (video.likeCount) stats.push(`${formatNumber(video.likeCount)} likes`);
    const statsHtml = stats.length ? stats.join(' · ') : '';

    // Tags HTML
    let tagsHtml = '';
    if (video.tags && video.tags.length > 0) {
      const tagPills = video.tags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('');
      tagsHtml = `<div class="tags">${tagPills}</div>`;
    }

    // Original URL HTML
    let originalUrlHtml = '';
    if (video.originalUrl) {
      originalUrlHtml = `<div class="original-link"><a href="${escapeHtml(video.originalUrl)}" target="_blank" rel="noopener">View on YouTube →</a></div>`;
    }

    const vars = {
      ...video,
      thumbExt,
      siteTitle,
      baseUrl,
      descriptionHtml: linkifyText(video.description),
      iframeEmbed,
      videoEmbed,
      statsHtml,
      tagsHtml,
      originalUrlHtml,
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

  // Write videos.json (exclude descriptions and internal paths)
  const manifest = {
    siteTitle,
    generatedAt: new Date().toISOString(),
    videos: videos.map(v => ({
      id: v.id,
      title: v.title,
      channel: v.channel,
      uploadDate: v.uploadDate,
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
    path.join(outputDir, 'api', 'videos.json'),
    JSON.stringify(manifest, null, 2)
  );

  // Write index page
  await fs.writeFile(
    path.join(outputDir, 'index.html'),
    render(indexTpl, { siteTitle })
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
