# Common Patterns & Multi-Service Configuration

Target: Caddy v2.9+

## Multi-Domain / Multi-Service

- Route different domains to different backends:

  ```caddyfile
  app.example.com {
      reverse_proxy localhost:3000
  }

  api.example.com {
      reverse_proxy localhost:8080
  }

  admin.example.com {
      reverse_proxy localhost:9000
  }
  ```

- Wildcard subdomain with per-host routing:

  ```caddyfile
  *.example.com {
      tls {
          dns cloudflare {env.CF_API_TOKEN}
      }

      @app host app.example.com
      handle @app {
          reverse_proxy localhost:3000
      }

      @api host api.example.com
      handle @api {
          reverse_proxy localhost:8080
      }

      # Fallback — reject unknown subdomains
      handle {
          abort
      }
  }
  ```

## Reverse Proxy + Static Files

- Proxy API requests, serve everything else as static files:

  ```caddyfile
  example.com {
      root * /srv
      reverse_proxy /api/* localhost:8080
      file_server
  }
  ```

  Works because `reverse_proxy` runs before `file_server` in the default directive order.

## SPA + API (Complete Pattern)

- Full SPA deployment with API backend, compression, security headers, and cache control:

  ```caddyfile
  (security-headers) {
      header {
          Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
          X-Content-Type-Options nosniff
          X-Frame-Options DENY
          Referrer-Policy strict-origin-when-cross-origin
          -Server
      }
  }

  example.com {
      import security-headers
      encode

      log {
          output file /var/log/caddy/access.log
          format json
      }

      handle /api/* {
          reverse_proxy backend:8080
      }

      handle {
          root * /srv

          @immutable path_regexp \.[a-f0-9]{8,}\.(css|js|woff2?|png|jpg|svg)$
          header @immutable Cache-Control "public, max-age=31536000, immutable"

          route {
              try_files {path} /index.html
              header /index.html Cache-Control "public, max-age=0, must-revalidate"
          }

          file_server
      }
  }
  ```

## PWA Deployment Pattern

- Serve a PWA with correct service worker and manifest headers:

  ```caddyfile
  example.com {
      encode
      root * /srv

      # Service worker — must not be cached
      @sw path /sw.js /service-worker.js
      header @sw Cache-Control "public, max-age=0, must-revalidate"
      header @sw Service-Worker-Allowed /

      # Manifest — no cache
      @manifest path /manifest.webmanifest /manifest.json
      header @manifest Cache-Control "public, max-age=0, must-revalidate"

      # Hashed assets — immutable cache
      @immutable path_regexp \.[a-f0-9]{8,}\.(css|js|woff2?|png|jpg|svg)$
      header @immutable Cache-Control "public, max-age=31536000, immutable"

      # SPA fallback
      try_files {path} /index.html
      file_server
  }
  ```

## www Redirect

- Redirect www to apex:

  ```caddyfile
  www.example.com {
      redir https://example.com{uri}
  }

  example.com {
      respond "Hello"
  }
  ```

- Redirect apex to www:

  ```caddyfile
  example.com {
      redir https://www.example.com{uri}
  }

  www.example.com {
      respond "Hello"
  }
  ```

## Caddy Behind a Load Balancer

- Front (public-facing) Caddy:

  ```caddyfile
  example.com {
      reverse_proxy 10.0.0.1:80
  }
  ```

- Back (internal) Caddy:

  ```caddyfile
  {
      servers {
          trusted_proxies static private_ranges
      }
  }

  http://example.com {
      reverse_proxy app:8080
  }
  ```

  The back instance uses `http://` to accept unencrypted traffic from the front proxy (TLS already terminated).

## Error Handling

- Custom error pages:

  ```caddyfile
  example.com {
      handle_errors {
          @404 expression {http.error.status_code} == 404
          handle @404 {
              root * /srv/errors
              rewrite * /404.html
              file_server
          }
          handle {
              respond "{http.error.status_code} {http.error.status_text}"
          }
      }
  }
  ```

## Multi-Service with handle_path

- Strip path prefix when proxying to a backend that doesn't expect it:

  ```caddyfile
  example.com {
      handle_path /grafana/* {
          reverse_proxy grafana:3000
      }

      handle_path /prometheus/* {
          reverse_proxy prometheus:9090
      }

      handle {
          reverse_proxy app:8080
      }
  }
  ```

## Development / Local HTTPS

- Use Caddy's internal CA for local development (auto-generates self-signed certs):

  ```caddyfile
  {
      local_certs
  }

  app.localhost {
      reverse_proxy localhost:3000
  }

  api.localhost {
      reverse_proxy localhost:8080
  }
  ```

  Caddy attempts to install its root certificate into the system trust store. Run `caddy trust` to install it manually if needed.

## Common Mistakes

- Forgetting to add a fallback `handle` block that `abort`s unknown subdomains in wildcard configs — allows any subdomain to get a response.

- Using `handle_path` when the backend expects the full path — `handle_path` strips the prefix, so `/grafana/api/health` becomes `/api/health`.

- Not using `http://` prefix for backend Caddy instances behind a TLS-terminating proxy — Caddy will try to provision certificates unnecessarily.
