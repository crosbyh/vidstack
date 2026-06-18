// Library configuration parsing.
//
// vidstack can serve multiple libraries (shown as top-level tabs). Libraries are
// configured via the LIBRARIES env var, a JSON array of { name, path, layout }
// objects where layout is "flat" (Title [videoId]/ folders + .info.json) or
// "tvshow" (Channel/Season <YYYY>/episode.{mp4,nfo,...}).
//
// Backwards compatibility: when LIBRARIES is unset, a single flat library is
// derived from VIDEO_DIR / SITE_TITLE, producing output identical to the
// original single-folder behaviour.

const LAYOUTS = ['flat', 'tvshow'];

function slugify(name) {
  const slug = String(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'library';
}

// The first (default) library lives at the site root with the legacy paths so
// existing deploys keep their URLs; others are namespaced under their slug.
function normalizeLibrary(lib, isDefault) {
  if (!lib || !lib.name || !lib.path) {
    throw new Error(`Each library needs a "name" and "path": ${JSON.stringify(lib)}`);
  }
  const layout = lib.layout || 'flat';
  if (!LAYOUTS.includes(layout)) {
    throw new Error(`Library "${lib.name}" has invalid layout "${layout}" (expected one of: ${LAYOUTS.join(', ')})`);
  }
  const slug = lib.slug ? slugify(lib.slug) : slugify(lib.name);

  return {
    slug,
    name: lib.name,
    path: lib.path,
    layout,
    isDefault: !!isDefault,
    indexPath: isDefault ? '' : slug,
    manifestUrl: isDefault ? '/api/videos.json' : `/${slug}/api/videos.json`,
    feedFile: isDefault ? 'feed.xml' : `${slug}.xml`,
    feedUrl: isDefault ? '/feed.xml' : `/${slug}.xml`,
    href: isDefault ? '/' : `/${slug}/`,
  };
}

function parseLibraries(env = process.env) {
  let raw;
  if (env.LIBRARIES) {
    try {
      raw = JSON.parse(env.LIBRARIES);
    } catch (e) {
      throw new Error(`LIBRARIES is not valid JSON: ${e.message}`);
    }
    if (!Array.isArray(raw) || raw.length === 0) {
      throw new Error('LIBRARIES must be a non-empty JSON array of { name, path, layout }');
    }
  } else {
    // Legacy single-library fallback.
    raw = [{
      name: env.SITE_TITLE || 'My Videos',
      path: env.VIDEO_DIR || './videos',
      layout: 'flat',
    }];
  }

  const libraries = raw.map((lib, i) => normalizeLibrary(lib, i === 0));

  // Guard against duplicate slugs colliding on output paths.
  const seen = new Set();
  for (const lib of libraries) {
    if (seen.has(lib.slug)) {
      throw new Error(`Duplicate library slug "${lib.slug}" — give libraries distinct names`);
    }
    seen.add(lib.slug);
  }
  return libraries;
}

module.exports = { parseLibraries, normalizeLibrary, slugify };
