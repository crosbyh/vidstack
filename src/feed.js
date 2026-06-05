// Generates an RSS 2.0 feed (with Media RSS extensions) of the video library.
// Items are ordered by when each video was added to the library (newest first),
// so subscribers see freshly-downloaded videos at the top.

function escapeXml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function toRfc822(isoOrDate) {
  if (!isoOrDate) return null;
  const d = new Date(isoOrDate);
  if (isNaN(d.getTime())) return null;
  return d.toUTCString();
}

// Wrap HTML in CDATA so it survives as markup in content:encoded.
// Splits any literal "]]>" so it can't close the CDATA section early.
function cdata(html) {
  return `<![CDATA[${String(html || '').replace(/]]>/g, ']]]]><![CDATA[>')}]]>`;
}

// Render a plain-text description into the limited HTML subset Miniflux keeps
// (escaped text, linkified URLs, <br> for newlines).
function descriptionToHtml(text) {
  return escapeXml(text)
    .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>')
    .replace(/\r?\n/g, '<br>\n');
}

// Inline player Miniflux will render: <video>/<source> are on its sanitizer
// allowlist (and it injects `controls`); a self-hosted <iframe> would be stripped.
function playerHtml(video, { videoUrl, thumbUrl, link }) {
  const type = escapeXml(video.mimeType || 'video/mp4');
  const player =
    `<p><video poster="${escapeXml(thumbUrl)}" width="640" preload="none">` +
    `<source src="${escapeXml(videoUrl)}" type="${type}"></video></p>` +
    `<p><a href="${escapeXml(link)}">Watch on site →</a></p>`;
  const desc = video.description ? `<p>${descriptionToHtml(video.description)}</p>` : '';
  return player + desc;
}

function buildFeed(videos, config) {
  const { baseUrl, siteTitle } = config;

  // Newest additions first; fall back to upload date when addedAt is missing.
  const items = [...videos].sort((a, b) =>
    (b.addedAt || b.uploadDate || '').localeCompare(a.addedAt || a.uploadDate || '')
  );

  const lastBuildDate = new Date().toUTCString();

  const itemsXml = items.map(video => {
    const link = `${baseUrl}/watch/${video.id}.html`;
    const videoUrl = `${baseUrl}/videos/${video.id}.${video.videoExt}`;
    const thumbExt = video._thumbExt || '.webp';
    const thumbUrl = `${baseUrl}/thumbs/${video.id}${thumbExt}`;
    const pubDate = toRfc822(video.addedAt) || toRfc822(video.uploadDate);

    const categories = [...(video.categories || []), ...(video.tags || [])]
      .map(c => `      <category>${escapeXml(c)}</category>`)
      .join('\n');

    const lines = [
      '    <item>',
      `      <title>${escapeXml(video.title)}</title>`,
      `      <link>${escapeXml(link)}</link>`,
      `      <guid isPermaLink="true">${escapeXml(link)}</guid>`,
    ];
    if (pubDate) lines.push(`      <pubDate>${pubDate}</pubDate>`);
    if (video.channel) lines.push(`      <dc:creator>${escapeXml(video.channel)}</dc:creator>`);
    lines.push(`      <description>${escapeXml(video.description)}</description>`);
    lines.push(
      `      <enclosure url="${escapeXml(videoUrl)}" type="${escapeXml(video.mimeType || 'video/mp4')}" length="0" />`
    );
    lines.push(`      <media:content url="${escapeXml(videoUrl)}" type="${escapeXml(video.mimeType || 'video/mp4')}" medium="video"${video.duration ? ` duration="${video.duration}"` : ''}>`);
    lines.push(`        <media:title>${escapeXml(video.title)}</media:title>`);
    lines.push(`        <media:thumbnail url="${escapeXml(thumbUrl)}" />`);
    lines.push('      </media:content>');
    lines.push(`      <media:thumbnail url="${escapeXml(thumbUrl)}" />`);
    if (categories) lines.push(categories);
    // Inline HTML player + description for readers like Miniflux.
    lines.push(`      <content:encoded>${cdata(playerHtml(video, { videoUrl, thumbUrl, link }))}</content:encoded>`);
    lines.push('    </item>');
    return lines.join('\n');
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(siteTitle)}</title>
    <link>${escapeXml(baseUrl)}</link>
    <atom:link href="${escapeXml(`${baseUrl}/feed.xml`)}" rel="self" type="application/rss+xml" />
    <description>${escapeXml(`Latest videos from ${siteTitle}`)}</description>
    <language>en</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
${itemsXml}
  </channel>
</rss>
`;
}

module.exports = { buildFeed };
