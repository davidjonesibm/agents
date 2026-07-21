# Request Matchers

Target: Caddy v2.9+

## Matcher Types

Caddy has three matcher syntaxes: **inline (path) matchers**, **named matchers**, and **CEL expression matchers**.

## Inline Path Matchers

- The simplest form — a path token placed directly after a directive:

  ```caddyfile
  reverse_proxy /api/* localhost:8080
  ```

- Matches on the request URI path. The `*` is a wildcard for any path segment.

## Named Matchers

- Defined with `@name` and referenced by directives:

  ```caddyfile
  @api path /api/*
  reverse_proxy @api localhost:8080
  ```

- Named matchers support multiple criteria (AND logic — all must match):

  ```caddyfile
  @post-api {
      method POST
      path /api/*
  }
  reverse_proxy @post-api localhost:8080
  ```

## Available Matcher Modules

- **`path`** — Match by URI path (supports wildcards and multiple values). Multiple values are OR-ed:

  ```caddyfile
  @static path /static/* /assets/*
  ```

- **`path_regexp`** — Match by regex on the path. Supports capture groups accessible via `{re.name.group}`:

  ```caddyfile
  @assets path_regexp static \.(css|js|svg|png|jpg|woff2?)$
  header @assets Cache-Control "public, max-age=31536000, immutable"
  ```

- **`host`** — Match by Host header:

  ```caddyfile
  @app host app.example.com
  handle @app {
      reverse_proxy localhost:3000
  }
  ```

- **`method`** — Match by HTTP method (multiple values are OR-ed):

  ```caddyfile
  @get method GET
  @mutating method POST PUT PATCH DELETE
  ```

- **`header`** — Match by request header value. Supports `*` wildcards:

  ```caddyfile
  @websockets {
      header Connection *Upgrade*
      header Upgrade websocket
  }
  reverse_proxy @websockets localhost:6001
  ```

- **`header_regexp`** — Match by regex on a header value. Capture groups are accessible:

  ```caddyfile
  @login header_regexp Cookie login_([a-f0-9]+)
  ```

- **`query`** — Match by query string parameters:

  ```caddyfile
  @debug query debug=true
  ```

- **`remote_ip`** — Match by client IP (CIDR notation):

  ```caddyfile
  @internal remote_ip 10.0.0.0/8 172.16.0.0/12 192.168.0.0/16
  ```

- **`not`** — Negate a matcher:

  ```caddyfile
  @not-static {
      not path /static/*
  }
  ```

- **`expression`** (CEL) — Boolean expressions for complex matching logic:

  ```caddyfile
  @weekend expression `{time.now.weekday} in [0, 6]`
  ```

## Wildcard Matcher (`*`)

- Use `*` to explicitly match all requests when a directive's first argument could be confused for a path matcher:

  ```caddyfile
  # Wrong — /srv is treated as a path matcher
  root /srv

  # Right — wildcard matches all requests
  root * /srv
  ```

## Matcher Sorting Rules

- When the same directive appears multiple times, Caddy sorts by matcher specificity:
  1. **Single path matcher** — highest priority, sorted by path length (longest first).
  2. `/foobar` is more specific than `/foo`.
  3. `/foo` is more specific than `/foo*`.
  4. `/foo/*` is more specific than `/foo*`.
  5. **Named matchers and multi-value path matchers** — sorted by appearance order.
  6. **No matcher** (matches all) — sorted last.

## Response Matchers

- Used inside directives like `reverse_proxy`'s `handle_response` to match on upstream responses:

  ```caddyfile
  reverse_proxy localhost:8080 {
      @error status 5xx
      handle_response @error {
          respond "Backend error" 502
      }
  }
  ```

## Common Mistakes

- Forgetting that named matcher criteria are AND-ed. For OR logic across different matcher types, use `expression`:

  ```caddyfile
  # Wrong — this requires BOTH paths to match simultaneously (impossible)
  @pages {
      path /about
      path /contact
  }

  # Right — multiple values in a single path are OR-ed
  @pages path /about /contact

  # Also right — CEL expression with OR
  @pages expression `path('/about') || path('/contact')`
  ```

- Using `path` when `path_regexp` is needed for dynamic segments:

  ```caddyfile
  # Wrong — Caddy's `*` wildcard only matches a single path segment
  @user path /users/*/profile

  # Right — use regex for dynamic segments
  @user path_regexp /users/[0-9]+/profile
  ```
