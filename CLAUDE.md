# vidstack

Static site generator for self-hosted yt-dlp video libraries.

## Architecture

- **Build:** Node.js script (zero npm dependencies) scans yt-dlp video folders, generates static HTML
- **Player:** Plain HTML5 `<video>` (structured for future Video.js upgrade)
- **Server:** nginx serves static HTML + symlinked video files
- **Deploy:** Docker container, designed for Traefik reverse proxy

## Project Structure

- `build.js` — Entry point, reads env config, scans each library, builds once
- `src/config.js` — Parses the `LIBRARIES` env (or falls back to `VIDEO_DIR`) into normalized library objects
- `src/scanner.js` — `scanLibrary(library)` dispatch; `flat` adapter (Title [videoId]/ + .info.json)
- `src/scanner-tvshow.js` — `tvshow` adapter (Channel/Season/episode + XML `.nfo`); includes `parseNfo`
- `src/scan-utils.js` — Shared scan helpers (MIME types, extensions, date/duration formatting)
- `src/srt2vtt.js` — Minimal SubRip → WebVTT converter for subtitle `<track>`s
- `src/builder.js` — Generates HTML pages, per-library videos.json manifest + feed, tabs, symlinks
- `src/feed.js` — Generates RSS 2.0 + Media RSS feed (per library)
- `src/templates/` — HTML templates (index, watch, embed, tags)
- `static/` — CSS and client-side JS (search/filter)
- `dist/` — Generated output (gitignored)

## Key Patterns

- **Libraries:** `LIBRARIES` env (JSON `[{name,path,layout}]`, `layout` ∈ `flat`|`tvshow`)
  defines tabs. First library is the default — served at root (`/`, `/feed.xml`,
  `/api/videos.json`); others are namespaced (`/<slug>/`, `/<slug>.xml`,
  `/<slug>/api/videos.json`). Unset → single flat library from `VIDEO_DIR`/`SITE_TITLE`
  (byte-stable with the original behaviour). See `src/config.js`.
- **Shared media namespace:** `watch/ embed/ videos/ thumbs/ subs/` are flat and shared
  across libraries, keyed by the (globally-unique) YouTube id — only manifests, feeds,
  and index pages are per-library. Adapters emit the SAME per-video object shape plus a
  `library` (slug) field and internal `_subtitlePath`.
- **tvshow layout:** ID/metadata come from the sibling XML `.nfo` (`<uniqueid type="youtube">`,
  `<showtitle>`=channel, `<plot>`=description, `<aired>`=date). No duration in `.nfo` → cards
  show `0:00`. `originalUrl` is synthesized from the YouTube id so Invidious links work.
- Video ID extracted from folder name: `Title [videoId]` via regex `/\[([^\]]+)\]$/` (flat layout)
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

- `LIBRARIES` — JSON array of `{name, path, layout}` libraries (`layout`: `flat` |
  `tvshow`). First entry is the default/root library; others get tabs + namespaced
  output. When unset, falls back to a single flat library from `VIDEO_DIR`/`SITE_TITLE`.
- `VIDEO_DIR` — Path to yt-dlp video folders (default: `./videos`); used only when
  `LIBRARIES` is unset
- `BASE_URL` — Public URL for embed codes (default: `http://localhost`)
- `SITE_TITLE` — Site title (default: `My Videos`)
- `OUTPUT_DIR` — Build output directory (default: `./dist`)
- `INVIDIOUS_URL` — Invidious instance URL (e.g. `https://yewtu.be`); when set,
  YouTube videos get a "Watch on Invidious" link in the watch page and RSS items.
  Empty/unset disables the link. Only emitted for YouTube-sourced videos
  (detected from `webpage_url`); see `src/invidious.js`.

## Commands

- `node build.js` — Build the site
- `npx serve dist/` — Local dev server
- `docker compose up --build` — Run in Docker

## Docker

- Videos mounted read-only at `/data/videos`
- Build runs at container startup (entrypoint)
- Traefik labels configured via `DOMAIN` env var
