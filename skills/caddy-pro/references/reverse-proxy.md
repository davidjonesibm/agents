# Reverse Proxy

Target: Caddy v2.9+

## Basic Configuration

- Proxy all requests to a single upstream:

  ```caddyfile
  example.com {
      reverse_proxy localhost:8080
  }
  ```

- Proxy only specific paths:

  ```caddyfile
  example.com {
      reverse_proxy /api/* localhost:8080
  }
  ```

- Multiple upstreams for load balancing:

  ```caddyfile
  example.com {
      reverse_proxy node1:80 node2:80 node3:80
  }
  ```

## Load Balancing Policies

- Set with the `lb_policy` subdirective. Default is `random`:

  ```caddyfile
  reverse_proxy node1:80 node2:80 {
      lb_policy round_robin
  }
  ```

- Available policies: `random`, `round_robin`, `least_conn`, `ip_hash`, `uri_hash`, `first`, `header`, `cookie`, `random_choose`.

- Header-based selection with fallback:

  ```caddyfile
  reverse_proxy node1:80 node2:80 {
      lb_policy header X-Upstream {
          fallback first
      }
  }
  ```

## Active Health Checks

- Periodically probe upstreams in the background:

  ```caddyfile
  reverse_proxy node1:80 node2:80 node3:80 {
      health_uri /healthz
      health_interval 10s
      health_timeout 5s
      health_status 200
  }
  ```

- Full active health check options:

  ```caddyfile
  reverse_proxy node1:80 node2:80 {
      health_uri /health
      health_port 8081
      health_interval 30s
      health_timeout 5s
      health_method GET
      health_passes 2
      health_fails 3
      health_headers {
          User-Agent "Caddy Health Check"
      }
  }
  ```

- Hold requests until a healthy backend is available:

  ```caddyfile
  reverse_proxy node1:80 node2:80 node3:80 {
      health_uri /healthz
      lb_try_duration 5s
  }
  ```

## Passive Health Checks

- Monitor actual proxied requests for failures. Enable with `fail_duration > 0`:

  ```caddyfile
  reverse_proxy node1:80 node2:80 {
      fail_duration 30s
      max_fails 3
      unhealthy_status 5xx
      unhealthy_latency 5s
      unhealthy_request_count 100
  }
  ```

- `unhealthy_request_count` limits concurrent requests per backend — useful for overload protection.

## WebSocket Proxying

- Caddy transparently proxies WebSocket connections — no special configuration needed:

  ```caddyfile
  example.com {
      reverse_proxy localhost:8080
  }
  ```

- To route WebSocket traffic to a different backend, use a named matcher:

  ```caddyfile
  example.com {
      @websockets {
          header Connection *Upgrade*
          header Upgrade websocket
      }
      reverse_proxy @websockets localhost:6001
      reverse_proxy localhost:8080
  }
  ```

## Header Manipulation

- Modify headers sent to the upstream (`header_up`) or received from the upstream (`header_down`):

  ```caddyfile
  reverse_proxy localhost:8080 {
      header_up X-Real-IP {remote_host}
      header_up -Accept-Encoding
      header_down -Server
  }
  ```

- As of Caddy v2.11.0, when proxying to an HTTPS upstream, the Host header is automatically set to match the upstream's host.

## Transport Options

- Configure timeouts and connection behavior:

  ```caddyfile
  reverse_proxy localhost:8080 {
      transport http {
          dial_timeout 2s
          response_header_timeout 30s
          tls
          tls_insecure_skip_verify
      }
  }
  ```

- **Never use `tls_insecure_skip_verify` in production.** Prefer HTTP over private networks or proper certificate trust.

## HTTPS Upstreams

- Proxy to an HTTPS backend:

  ```caddyfile
  reverse_proxy https://backend.internal:443
  ```

- Use `transport http { tls }` if the upstream uses a non-standard port:

  ```caddyfile
  reverse_proxy backend:9443 {
      transport http {
          tls
      }
  }
  ```

## Response Handling

- Intercept and handle upstream responses:

  ```caddyfile
  reverse_proxy localhost:8080 {
      @error status 5xx
      handle_response @error {
          respond "Service temporarily unavailable" 503
      }
  }
  ```

- Serve static files via `X-Accel-Redirect`:

  ```caddyfile
  reverse_proxy localhost:8080 {
      @accel header X-Accel-Redirect *
      handle_response @accel {
          root * /path/to/private/files
          rewrite {rp.header.X-Accel-Redirect}
          method GET
          file_server
      }
  }
  ```

## Trusted Proxies

- When behind a load balancer or CDN, configure trusted proxies to preserve the real client IP:

  ```caddyfile
  {
      servers {
          trusted_proxies static private_ranges
          trusted_proxies_strict
      }
  }
  ```

- `trusted_proxies_strict` enables right-to-left parsing of `X-Forwarded-For`, required for proxies like AWS ALB or Cloudflare to prevent IP spoofing.

## Available Placeholders

- Inside `reverse_proxy` and after proxying, these placeholders are available:
  - `{rp.upstream.address}` — full upstream address
  - `{rp.upstream.hostport}` — host:port of upstream
  - `{rp.upstream.host}` — host only
  - `{rp.upstream.port}` — port only
  - `{rp.upstream.latency}` — time to first response byte
  - `{rp.upstream.latency_ms}` — latency in milliseconds
  - `{rp.upstream.duration}` — total time proxying, including writing response body
  - `{rp.upstream.duration_ms}` — duration in milliseconds

## Common Mistakes

- Putting `file_server` before `reverse_proxy` and expecting it to work — `reverse_proxy` runs before `file_server` in the default order, so it takes precedence regardless of Caddyfile position:

  ```caddyfile
  # Wrong — reverse_proxy processes ALL requests before file_server
  file_server
  reverse_proxy localhost:8080

  # Right — use matchers or handle blocks
  handle /api/* {
      reverse_proxy localhost:8080
  }
  handle {
      file_server
  }
  ```

- Forgetting `lb_try_duration` when using health checks — without it, if all backends are down, requests immediately fail instead of waiting for a backend to recover.
