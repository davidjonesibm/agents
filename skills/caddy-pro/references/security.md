# Security

Target: Caddy v2.9+

## Security Headers

- Apply a standard set of security headers using a `header` block or snippet:

  ```caddyfile
  header {
      # HSTS — enforce HTTPS for 1 year, include subdomains
      Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"

      # Prevent MIME type sniffing
      X-Content-Type-Options nosniff

      # Clickjacking protection
      X-Frame-Options DENY

      # Disable FLoC/Topics tracking
      Permissions-Policy "interest-cohort=()"

      # XSS protection (legacy, but low cost to include)
      X-XSS-Protection "1; mode=block"

      # Referrer policy
      Referrer-Policy strict-origin-when-cross-origin

      # Remove server identification
      -Server
  }
  ```

- Use a **snippet** for reuse across multiple site blocks:

  ```caddyfile
  (security-headers) {
      header {
          Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
          X-Content-Type-Options nosniff
          X-Frame-Options DENY
          Permissions-Policy "interest-cohort=()"
          Referrer-Policy strict-origin-when-cross-origin
          -Server
      }
  }

  example.com {
      import security-headers
      reverse_proxy localhost:8080
  }
  ```

## Content-Security-Policy (CSP)

- Set CSP as a header. Tailor the policy to your application's needs:

  ```caddyfile
  header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' https://api.example.com; frame-ancestors 'none'"
  ```

- Use `?` prefix for default values (set only if not already set by the upstream):

  ```caddyfile
  header ?Content-Security-Policy "default-src 'self'"
  ```

## Header Operators

- **Set** (overwrite): `<field> <value>`
- **Add** (append): `+<field> <value>`
- **Delete**: `-<field>`
- **Default** (set only if not present): `?<field> <value>`
- **Defer** (set after upstream writes its headers): `><field> <value>`
- **Replace** (regex): `<field> <find> <replace>`

  ```caddyfile
  header {
      # Override upstream's cache header
      >Cache-Control "no-store"

      # Set default if upstream didn't set it
      ?X-Content-Type-Options nosniff

      # Remove upstream's server header
      -Server
  }
  ```

## Deferred Headers

- Use the `>` prefix or `defer` subdirective when you need headers set **after** an upstream writes its own response headers:

  ```caddyfile
  # Override cache headers set by the upstream
  header >Cache-Control "no-store"
  reverse_proxy localhost:8080
  ```

  Without `>`, the `header` directive runs before `reverse_proxy` writes its response.

## Rate Limiting (caddy-ratelimit plugin)

- Requires the `mholt/caddy-ratelimit` module. Plugin directives have **no default order** — must be explicitly ordered:

  ```caddyfile
  {
      order rate_limit before reverse_proxy
  }

  example.com {
      rate_limit {
          zone api {
              match {
                  path /api/*
              }
              key {remote_host}
              window 1m
              events 100
          }
      }

      reverse_proxy localhost:8080
  }
  ```

- Key options per zone:
  - `key` — identifier for rate limiting (e.g., `{remote_host}`, `static`, a header value)
  - `window` — sliding time window
  - `events` — max events per window
  - `match` — request matchers scoping the zone

- Multiple zones for different rate limits:

  ```caddyfile
  rate_limit {
      zone api_endpoints {
          match {
              path /api/*
          }
          key {remote_host}
          window 1m
          events 100
      }
      zone auth_endpoints {
          match {
              path /auth/*
          }
          key {remote_host}
          window 1m
          events 10
      }
  }
  ```

- Distributed rate limiting across multiple Caddy instances:

  ```caddyfile
  rate_limit {
      zone main {
          key {remote_host}
          window 1m
          events 100
      }
      distributed {
          read_interval 5s
          write_interval 5s
      }
  }
  ```

- Add jitter to prevent thundering herd on `Retry-After`:

  ```caddyfile
  rate_limit {
      zone main {
          key {remote_host}
          window 5s
          events 10
      }
      jitter 0.2
  }
  ```

- Custom error handling for rate-limited requests:

  ```caddyfile
  handle_errors {
      @rate_limited expression {http.error.status_code} == 429
      respond @rate_limited "Rate limit exceeded" 429
  }
  ```

## Trusted Proxies

- When behind a CDN/load balancer, configure `trusted_proxies` to correctly parse `X-Forwarded-For`:

  ```caddyfile
  {
      servers {
          trusted_proxies static private_ranges
          trusted_proxies_strict
      }
  }
  ```

- `trusted_proxies_strict` enables right-to-left parsing (prevents IP spoofing). Required for proxies like AWS ALB, Cloudflare.

## Basic Authentication

- Protect routes with HTTP Basic Auth:

  ```caddyfile
  example.com {
      basic_auth /admin/* {
          admin $2a$14$...hashed_password...
      }
  }
  ```

- Generate password hashes with: `caddy hash-password`.

## Forward Authentication

- Delegate auth to an external service (e.g., Authelia, Authentik):

  ```caddyfile
  example.com {
      forward_auth authelia:9091 {
          uri /api/authz/forward-auth
          copy_headers Remote-User Remote-Groups Remote-Email
      }
      reverse_proxy localhost:8080
  }
  ```

## Common Mistakes

- Not setting security headers — Caddy doesn't add HSTS, CSP, or X-Frame-Options by default. Use a snippet and `import` it into every site block.

- Using `header` without `>` (defer) when trying to override upstream response headers:

  ```caddyfile
  # Before (header runs before reverse_proxy writes — no effect)
  header Cache-Control "no-store"
  reverse_proxy localhost:8080

  # After (deferred — runs after upstream sets headers)
  header >Cache-Control "no-store"
  reverse_proxy localhost:8080
  ```

- Not ordering the `rate_limit` plugin — it has no default position in the directive chain, so it silently does nothing without explicit `order`.
