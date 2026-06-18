# vidstack

A self-hosted static site for browsing and streaming videos downloaded with [yt-dlp](https://github.com/yt-dlp/yt-dlp). Point it at a folder of videos and get a searchable, embeddable video library served by nginx.

## Features

- **Multiple libraries** — serve several video folders as top-level tabs (e.g. "Watch Later" + "Channels"), each with its own grid and RSS feed
- **Searchable index** — filter by title, channel, or tags; sort by date, duration, or title
- **Tag browser** — browse all tags and categories at `/tags.html`
- **Watch pages** — HTML5 video player with metadata, description, and stats
- **Embed codes** — each video provides iframe, `<video>` tag, and direct link embed codes for use in Obsidian, wikis, etc.
- **Auto-rebuild** — watches the video folder for changes and rebuilds automatically via inotifywait
- **Zero JS dependencies** — the Node.js build script uses only built-in modules

## Quick Start

### With Docker (recommended)

Pull the image from GHCR:

```bash
docker run -d \
  -v /path/to/your/videos:/data/videos:ro \
  -e BASE_URL=http://localhost:8080 \
  -e SITE_TITLE="My Videos" \
  -p 8080:80 \
  ghcr.io/crosbyh/vidstack:latest
```

Or use Docker Compose — create a `.env` file:

```env
VIDEO_DIR=/path/to/your/videos
BASE_URL=https://videos.example.com
SITE_TITLE=My Videos
PORT=8080
```

Then run:

```bash
docker compose up -d
```

### Without Docker

```bash
VIDEO_DIR=./videos BASE_URL=http://localhost:8080 node build.js
python3 -m http.server 8080 -d dist
```

## Expected Video Folder Structure

vidstack expects the folder structure that yt-dlp produces with `--write-info-json --write-description --write-thumbnail`:

```
videos/
  Video Title [videoId]/
    Video Title [videoId].webm        # or .mp4, .mkv, etc.
    Video Title [videoId].info.json
    Video Title [videoId].description
    Video Title [videoId].webp        # or .jpg, .png
```

The video ID is extracted from the bracket suffix in the folder name (e.g., `[dQw4w9WgXcQ]`).

A recommended yt-dlp command:

```bash
yt-dlp --write-info-json --write-description --write-thumbnail \
  -o '%(title)s [%(id)s]/%(title)s [%(id)s].%(ext)s' \
  <url>
```

## Multiple Libraries

vidstack can serve several libraries as top-level tabs. Each library has a **layout**:

- `flat` — the `Title [videoId]/` + `.info.json` structure above (the default).
- `tvshow` — a Jellyfin / [ytdl-sub](https://github.com/jmbannon/ytdl-sub) TV-show tree
  with XML `.nfo` metadata:

  ```
  channels/
    Channel Name/
      Season 2025/
        s2025e0220 - Episode Title.mp4
        s2025e0220 - Episode Title.nfo        # XML; <uniqueid type="youtube"> provides the ID
        s2025e0220 - Episode Title-thumb.jpg
        s2025e0220 - Episode Title.en.srt      # optional; shown as captions
  ```

Configure libraries with the `LIBRARIES` env var — a JSON array of `{ name, path, layout }`.
The **first** entry is the default library, served at the site root (`/`, `/feed.xml`,
`/api/videos.json`); others are namespaced under their slug (`/channels/`, `/channels.xml`,
`/channels/api/videos.json`).

```env
LIBRARIES=[{"name":"Watch Later","path":"/data/videos","layout":"flat"},{"name":"Channels","path":"/data/channels","layout":"tvshow"}]
```

When `LIBRARIES` is unset, a single flat library is built from `VIDEO_DIR` / `SITE_TITLE`
(the original behaviour — existing setups need no changes).

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `VIDEO_DIR` | `./videos` | Path to yt-dlp video folders (default library when `LIBRARIES` is unset) |
| `LIBRARIES` | _(unset)_ | JSON array of `{ name, path, layout }` libraries (`layout`: `flat` or `tvshow`). First entry is the default/root library. Overrides `VIDEO_DIR`/`SITE_TITLE` |
| `BASE_URL` | `http://localhost` | Public URL used in embed codes |
| `SITE_TITLE` | `My Videos` | Default library name when `LIBRARIES` is unset |
| `INVIDIOUS_URL` | _(unset)_ | Invidious instance (e.g. `https://yewtu.be`). When set, YouTube videos get a "Watch on Invidious" link in the watch page and RSS items |
| `PORT` | `8080` | Host port (Docker Compose) |

## Pages

| Path | Description |
|------|-------------|
| `/` | Searchable video grid (default library) |
| `/<slug>/` | Searchable video grid for an additional library |
| `/tags.html` | Tag and category browser (default library) |
| `/watch/{id}.html` | Video player with metadata and embed codes |
| `/embed/{id}.html` | Minimal embed player (for iframes) |
| `/api/videos.json` | JSON manifest (default library; `/<slug>/api/videos.json` for others) |
| `/feed.xml` | RSS feed (default library; `/<slug>.xml` for others) |

## Auto-Rebuild

The Docker container runs a cron job every minute that rebuilds the site and reloads nginx. When you add or remove videos from the mounted folder, the changes will appear within a minute — no restart needed.

## Reverse Proxy

vidstack works behind any reverse proxy. For Traefik, add labels to the service in your compose file:

```yaml
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.vidstack.rule=Host(`videos.example.com`)"
  - "traefik.http.routers.vidstack.entrypoints=websecure"
  - "traefik.http.routers.vidstack.tls.certresolver=letsencrypt"
  - "traefik.http.services.vidstack.loadbalancer.server.port=80"
```

## License

MIT
