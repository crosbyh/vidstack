const { scanLibrary } = require('./src/scanner');
const { buildSite } = require('./src/builder');
const { parseLibraries } = require('./src/config');

const libraries = parseLibraries();

const config = {
  outputDir: process.env.OUTPUT_DIR || './dist',
  baseUrl: (process.env.BASE_URL || 'http://localhost').replace(/\/$/, ''),
  siteTitle: process.env.SITE_TITLE || 'My Videos',
  invidiousUrl: (process.env.INVIDIOUS_URL || '').replace(/\/$/, ''),
  libraries,
};

async function main() {
  const scanned = [];
  for (const library of libraries) {
    console.log(`Scanning "${library.name}" (${library.layout}) in: ${library.path}`);
    const videos = await scanLibrary(library);
    console.log(`  Found ${videos.length} videos`);
    scanned.push({ library, videos });
  }

  await buildSite(scanned, config);
  console.log(`Site built to: ${config.outputDir}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
