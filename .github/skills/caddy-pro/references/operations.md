# Operations: Logging, Caching & Monitoring

Target: Caddy v2.9+

## Access Logging

- Enable access logs per site with the `log` directive:

  ```caddyfile
  example.com {
      log
      reverse_proxy localhost:8080
  }
  ```

- Configure output, format, and log level:

  ```caddyfile
  example.com {
      log {
          output file /var/log/caddy/access.log
          format json
          level INFO
      }
  }
  ```

- Available output modules:
  - `output stderr` — standard error (default)
  - `output stdout` — standard output
  - `output discard` — drop all logs
  - `output file <path>` — write to file with rotation
  - `output net <address>` — write to network address

## Log File Rotation

- Configure rotation to prevent disk exhaustion:

  ```caddyfile
  log {
      output file /var/log/caddy/access.log {
          roll_size 100MiB
          roll_keep 5
          roll_keep_for 720h
          roll_uncompressed
          roll_local_time
      }
  }
  ```

- Key rotation options:
  - `roll_size` — max file size before rotation (default: 100MiB)
  - `roll_keep` — number of rotated files to retain (default: 10)
  - `roll_keep_for` — max age of rotated files (default: 2160h / 90 days)
  - `roll_uncompressed` — disable gzip compression of rotated files
  - `roll_local_time` — use local timestamps in filenames (default: UTC)
  - `roll_at` — roll at specific times of day (e.g., `00:00 12:00`)

## Log Formats

- **JSON** format (recommended for structured logging / log aggregation):

  ```caddyfile
  log {
      format json
  }
  ```

- **Console** format (human-readable, for development):

  ```caddyfile
  log {
      format console
  }
  ```

- **Filter** format (transform/redact fields):

  ```caddyfile
  log {
      format filter {
          wrap json
          fields {
              request>remote_ip ip_mask {
                  ipv4 24
                  ipv6 32
              }
          }
      }
  }
  ```

## Skip Logging for Specific Paths

- Exclude paths from access logs (e.g., static assets, health checks):

  ```caddyfile
  example.com {
      log
      log_skip /static*
      log_skip /health
      file_server
  }
  ```

## Append Custom Fields to Logs

- Add context to log entries using `log_append`:

  ```caddyfile
  example.com {
      log

      handle /api/* {
          log_append area "api"
          reverse_proxy localhost:9000
      }

      handle {
          log_append area "static"
          file_server
      }
  }
  ```

- Log reverse proxy upstream details:

  ```caddyfile
  reverse_proxy node1:80 node2:80 {
      lb_policy round_robin
  }
  log_append upstream_host {rp.upstream.host}
  log_append upstream_duration_ms {rp.upstream.duration_ms}
  ```

## Global Logging

- Configure default logging in the global options block:

  ```caddyfile
  {
      log default {
          output stdout
          format json
          include http.log.access admin.api
      }
  }
  ```

## Log Sampling

- Reduce log volume per interval:

  ```caddyfile
  log {
      sampling {
          interval 1s
          first 100
          thereafter 100
      }
  }
  ```

## Caching (cache-handler plugin)

- Requires the `caddyserver/cache-handler` module. Must be explicitly ordered:

  ```caddyfile
  {
      order cache before reverse_proxy
      cache {
          ttl 120s
          stale 60s
      }
  }

  example.com {
      cache
      reverse_proxy backend:8080
  }
  ```

- Per-route cache configuration:

  ```caddyfile
  @cacheable path /api/public/*

  handle @cacheable {
      cache {
          ttl 300s
          default_cache_control "public, max-age=300"
      }
      reverse_proxy backend:8080
  }
  ```

- Customize cache key generation:

  ```caddyfile
  {
      cache {
          ttl 300s
          key {
              disable_host
              headers Authorization Content-Type
          }
          cache_keys {
              .*\.css {
                  disable_body
                  disable_query
              }
          }
      }
  }
  ```

- Supported storage backends: in-memory (default), Badger, NutsDB, Redis, Etcd, Olric.

  ```caddyfile
  {
      cache {
          ttl 120s
          redis {
              url 127.0.0.1:6379
          }
      }
  }
  ```

- Exclude paths from caching:

  ```caddyfile
  {
      cache {
          ttl 120s
          regex {
              exclude /api/private.*
          }
      }
  }
  ```

## Metrics (Prometheus)

- Enable the Prometheus metrics endpoint:

  ```caddyfile
  example.com {
      metrics /metrics
  }
  ```

- The `metrics` directive exposes Caddy's internal metrics in Prometheus format.

## Admin API

- The admin API is enabled by default on `localhost:2019`. Query upstream status:

  ```bash
  curl "http://localhost:2019/reverse_proxy/upstreams" | jq
  ```

- Disable the admin API in production if not needed:

  ```caddyfile
  {
      admin off
  }
  ```

- Restrict admin API to a specific address:

  ```caddyfile
  {
      admin localhost:2019
  }
  ```

## Common Mistakes

- Not enabling `log` directive — Caddy does not emit access logs by default. You must explicitly enable them per site block.

- Using `format console` in production log pipelines — structured log aggregators (ELK, Loki, Datadog) expect JSON. Use `format json`.

- Forgetting to order the `cache` plugin:

  ```caddyfile
  # Before (cache has no default order — silently ignored)
  example.com {
      cache
      reverse_proxy backend:8080
  }

  # After
  {
      order cache before reverse_proxy
  }
  example.com {
      cache
      reverse_proxy backend:8080
  }
  ```

- Leaving the admin API open on `0.0.0.0` — the admin API allows full config rewrite. Keep it on `localhost` or disable it.
