const { scanVideos } = require('./src/scanner');
const { buildSite } = require('./src/builder');

const config = {
  videoDir: process.env.VIDEO_DIR || './videos',
  outputDir: process.env.OUTPUT_DIR || './dist',
  baseUrl: (process.env.BASE_URL || 'http://localhost').replace(/\/$/, ''),
  siteTitle: process.env.SITE_TITLE || 'My Videos',
};

async function main() {
  console.log(`Scanning videos in: ${config.videoDir}`);
  const videos = await scanVideos(config.videoDir);
  console.log(`Found ${videos.length} videos`);

  await buildSite(videos, config);
  console.log(`Site built to: ${config.outputDir}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
