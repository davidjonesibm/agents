# Caddyfile Syntax & Structure

Target: Caddy v2.9+

## Site Blocks

- Every Caddyfile is organized around **site blocks**. A site block starts with an address and is followed by `{ }` containing directives.

  ```caddyfile
  example.com {
      reverse_proxy localhost:8080
  }
  ```

- If only one site block exists, the curly braces are optional:

  ```caddyfile
  localhost

  reverse_proxy localhost:8080
  file_server
  ```

- Multiple domains can share a block by listing them comma-separated:

  ```caddyfile
  example.com, www.example.com {
      respond "Hello!"
  }
  ```

## Addresses

- A **hostname** enables automatic HTTPS: `example.com { }`.
- A **bare port** disables automatic HTTPS: `:8080 { }`.
- Prefix with `http://` to explicitly disable HTTPS: `http://example.com { }`.
- Prefix with `https://` to force HTTPS even on non-standard ports: `https://:8443 { }`.
- Wildcard subdomains require the DNS challenge for certificate automation: `*.example.com { }`.

## Global Options Block

- The global options block is a special block at the top of the Caddyfile with no address:

  ```caddyfile
  {
      email admin@example.com
      acme_ca https://acme-staging-v02.api.letsencrypt.org/directory
      log default {
          output stdout
          format json
      }
  }

  example.com {
      respond "Hello"
  }
  ```

- Key global options: `email`, `acme_ca`, `acme_ca_root`, `local_certs`, `order`, `servers`, `admin`, `log`, `default_bind`, `http_port`, `https_port`.

## Directive Ordering (Critical)

- Caddy auto-sorts directives by a **hard-coded default order**. The physical order in your Caddyfile generally does NOT matter — Caddy reorders them.
- The default order (top = runs first):

  ```
  tracing
  map
  vars
  fs
  root
  log_append
  log_skip
  log_name
  header
  request_body
  redir
  method
  rewrite
  uri
  try_files
  basic_auth
  forward_auth
  request_header
  encode
  push
  intercept
  templates
  invoke
  handle
  handle_path
  route
  abort
  error
  respond
  metrics
  reverse_proxy
  php_fastcgi
  file_server
  acme_server
  ```

- **Plugin directives have no default order.** They must be ordered with the `order` global option or placed inside a `route {}` block.

  ```caddyfile
  # Before (broken — rate_limit has no default position)
  rate_limit { ... }
  reverse_proxy localhost:8080

  # After (explicit ordering)
  {
      order rate_limit before reverse_proxy
  }
  ```

- To **override** the default ordering, use a `route {}` block — directives inside execute in the order written:

  ```caddyfile
  # Before (file_server runs after redir due to default order)
  example.com {
      file_server /specific.html
      redir https://other.com{uri}
  }

  # After (route preserves written order)
  example.com {
      route {
          file_server /specific.html
          redir https://other.com{uri}
      }
  }
  ```

## Snippets

- Define reusable configuration blocks with parenthesized names, then import them:

  ```caddyfile
  (security-headers) {
      header {
          Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
          X-Content-Type-Options nosniff
          X-Frame-Options DENY
      }
  }

  example.com {
      import security-headers
      reverse_proxy localhost:8080
  }
  ```

- Snippets support arguments with `{args[0]}`, `{args[1]}`, etc.:

  ```caddyfile
  (proxy) {
      reverse_proxy {args[0]}
  }

  example.com {
      import proxy localhost:8080
  }
  ```

## Environment Variables

- **Build-time substitution** uses `{$VAR}` syntax — replaced when the Caddyfile is parsed:

  ```caddyfile
  {$DOMAIN:localhost} {
      respond "Hello"
  }
  ```

  The `:localhost` is a default value if `$DOMAIN` is unset.

- **Runtime substitution** uses `{env.VAR}` placeholder syntax — replaced at request time (the directive/module must support placeholders):

  ```caddyfile
  {
      acme_dns cloudflare {env.CLOUDFLARE_API_TOKEN}
  }
  ```

- Prefer `{$VAR}` for addresses and structural config. Use `{env.VAR}` only when the directive supports runtime placeholders.

## handle vs handle_path

- `handle` groups directives into mutually exclusive blocks — only the first matching handle runs:

  ```caddyfile
  example.com {
      handle /api/* {
          reverse_proxy localhost:9000
      }
      handle {
          file_server
      }
  }
  ```

- `handle_path` is identical but **strips the matched path prefix**:

  ```caddyfile
  # These are equivalent:
  handle_path /prefix/* {
      reverse_proxy localhost:9000
  }

  handle /prefix/* {
      uri strip_prefix /prefix
      reverse_proxy localhost:9000
  }
  ```

## JSON Config vs Caddyfile

- The Caddyfile is a **configuration adapter** — it gets converted to Caddy's native JSON format.
- Use **Caddyfile** for: human-authored configs, simple-to-moderate complexity, version-controlled infrastructure.
- Use **JSON** for: programmatic config generation, dynamic config via the admin API, complex routing that exceeds Caddyfile expressiveness.
- Inspect the generated JSON with: `caddy adapt --config Caddyfile --pretty`.

## Common Mistakes

- Never nest directives inside other directives (except inside `handle`, `handle_path`, `route`, and `handle_errors`):

  ```caddyfile
  # Wrong — reverse_proxy can't contain file_server
  reverse_proxy localhost:8080 {
      file_server
  }

  # Right — use handle blocks
  handle /api/* {
      reverse_proxy localhost:8080
  }
  handle {
      file_server
  }
  ```

- Use `root * /srv` with the wildcard matcher `*` to disambiguate from a path matcher:

  ```caddyfile
  # Wrong — /srv is treated as a path matcher
  root /srv

  # Right — wildcard matches all requests
  root * /srv
  ```
