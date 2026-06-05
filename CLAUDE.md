# vidstack

Static site generator for self-hosted yt-dlp video libraries.

## Architecture

- **Build:** Node.js script (zero npm dependencies) scans yt-dlp video folders, generates static HTML
- **Player:** Plain HTML5 `<video>` (structured for future Video.js upgrade)
- **Server:** nginx serves static HTML + symlinked video files
- **Deploy:** Docker container, designed for Traefik reverse proxy

## Project Structure

- `build.js` — Entry point, reads env config
- `src/scanner.js` — Scans video directories, parses .info.json metadata
- `src/builder.js` — Generates HTML pages, videos.json manifest, symlinks
- `src/feed.js` — Generates RSS 2.0 + Media RSS feed (`dist/feed.xml`)
- `src/templates/` — HTML templates (index, watch, embed)
- `static/` — CSS and client-side JS (search/filter)
- `dist/` — Generated output (gitignored)

## Key Patterns

- Video ID extracted from folder name: `Title [videoId]` via regex `/\[([^\]]+)\]$/`
- Templates use `{{placeholder}}` syntax, rendered with simple string replace
- Videos/thumbnails served via symlinks in `dist/` pointing to mounted volume
- Index page loads `api/videos.json` for client-side search/filter
- Embed pages are self-contained (inline styles, no external deps)
- `feed.xml` lists videos newest-added first; uses `BASE_URL` for absolute links
- Feed playback comes from the `<enclosure>` (readers like Miniflux render a
  native player from it). `content:encoded` holds only a watch link + description
  — do NOT also embed a `<video>` there, or Miniflux shows two players. Iframes
  are useless here: Miniflux strips self-hosted iframes (fixed host allowlist).
  - Known limitation: the enclosure player only plays browser-decodable formats
    (`.mp4` H.264/AAC, `.webm`). Non-playable scans (`.mkv`/`.avi`/`.mov`/`.flv`)
    render a dead player. Possible revisit: gate the player to playable formats
    and fall back to thumbnail + link for the rest.

## Environment Variables

- `VIDEO_DIR` — Path to yt-dlp video folders (default: `./videos`)
- `BASE_URL` — Public URL for embed codes (default: `http://localhost`)
- `SITE_TITLE` — Site title (default: `My Videos`)
- `OUTPUT_DIR` — Build output directory (default: `./dist`)

## Commands

- `node build.js` — Build the site
- `npx serve dist/` — Local dev server
- `docker compose up --build` — Run in Docker

## Docker

- Videos mounted read-only at `/data/videos`
- Build runs at container startup (entrypoint)
- Traefik labels configured via `DOMAIN` env var
