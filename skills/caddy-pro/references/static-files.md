# Static File Serving & SPA Patterns

Target: Caddy v2.9+

## Basic File Server

- Serve static files from a directory:

  ```caddyfile
  example.com {
      root * /srv
      file_server
  }
  ```

- `root * /srv` sets the site root. The `*` wildcard is required to disambiguate from a path matcher.

## File Server Options

- Enable directory browsing:

  ```caddyfile
  file_server browse
  ```

- Serve from a specific subfolder only:

  ```caddyfile
  file_server /static/*
  ```

- Hide sensitive files:

  ```caddyfile
  file_server {
      hide .git .env
  }
  ```

- Serve precompressed files (`.br`, `.zst`, `.gz`) if they exist alongside the original:

  ```caddyfile
  file_server {
      precompressed zstd br gzip
  }
  ```

## Compression (encode)

- Enable response compression with defaults (gzip, zstd):

  ```caddyfile
  example.com {
      root * /srv
      encode
      file_server
  }
  ```

- Specify compression algorithms explicitly:

  ```caddyfile
  encode zstd br gzip
  ```

- The `encode` directive automatically applies only to compressible content types (text, JSON, JS, CSS, SVG, fonts, etc.).

## try_files (SPA Fallback)

- `try_files` checks if files exist on disk and rewrites to the first match. This is the core of SPA support:

  ```caddyfile
  example.com {
      root * /srv
      try_files {path} /index.html
      file_server
  }
  ```

  This tries to serve the requested file; if it doesn't exist, it falls back to `/index.html` for client-side routing.

- The expanded form of `try_files` is:

  ```caddyfile
  @try_files file {path} /index.html
  rewrite @try_files {file_match.relative}
  ```

- `try_files` supports a `policy` for file selection (default: `first_exist`):

  ```caddyfile
  try_files {path} /index.html {
      policy first_exist_fallback
  }
  ```

## SPA with API Backend

- Use `handle` blocks to separate API from SPA routing:

  ```caddyfile
  example.com {
      encode

      handle /api/* {
          reverse_proxy backend:8000
      }

      handle {
          root * /srv
          try_files {path} /index.html
          file_server
      }
  }
  ```

## SPA Cache-Control for index.html

- The `index.html` of a SPA should **never be cached** by browsers (it references hashed asset filenames). Use a `route` block so the `header` directive runs after the `try_files` rewrite:

  ```caddyfile
  example.com {
      root * /srv
      encode

      route {
          try_files {path} /index.html
          header /index.html Cache-Control "public, max-age=0, must-revalidate"
      }

      file_server
  }
  ```

  **Why `route`:** The `header` directive normally runs before `try_files` (per default directive order). Wrapping in `route` forces them to execute in written order.

## PWA / Service Worker Patterns

- Set the correct `Service-Worker-Allowed` header for service worker scope:

  ```caddyfile
  header /sw.js Service-Worker-Allowed /
  ```

- Serve the manifest and service worker with correct cache headers:

  ```caddyfile
  @manifest path /manifest.webmanifest /manifest.json
  header @manifest Cache-Control "public, max-age=0, must-revalidate"

  @sw path /sw.js /service-worker.js
  header @sw Cache-Control "public, max-age=0, must-revalidate"
  ```

## Hashed Asset Caching

- Use `path_regexp` matchers for cache-busted assets with content hashes:

  ```caddyfile
  @immutable path_regexp \.[a-f0-9]{8,}\.(css|js|woff2?|png|jpg|svg)$
  header @immutable Cache-Control "public, max-age=31536000, immutable"
  ```

## Multi-Site Static Hosting

- Host multiple sites from one Caddyfile:

  ```caddyfile
  site-a.example.com {
      root * /srv/site-a
      file_server
  }

  site-b.example.com {
      root * /srv/site-b
      file_server
  }
  ```

## Common Mistakes

- Forgetting `root *` (the wildcard matcher) — without it, `/srv` is treated as a path matcher, not a directory path:

  ```caddyfile
  # Wrong
  root /srv

  # Right
  root * /srv
  ```

- Placing `encode` after `file_server` — `encode` must wrap `file_server` to compress responses, and it does by default due to directive order. If using a `route` block, make sure `encode` comes before `file_server`.

- Not setting `Cache-Control` on SPA `index.html` — stale `index.html` references old hashed assets, causing broken apps.
