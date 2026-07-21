# TLS Configuration

Target: Caddy v2.9+

## Automatic HTTPS (Default Behavior)

- Caddy automatically provisions and renews TLS certificates for any site with a qualifying hostname (i.e., a public domain name or IP). **This is on by default.**
- Automatic HTTPS also creates HTTP→HTTPS redirects automatically.
- Requirements: Caddy must be reachable on ports 80 and 443 for the ACME HTTP challenge.

## Global TLS Options

- Set the ACME email for certificate registration:

  ```caddyfile
  {
      email admin@example.com
  }
  ```

- Use the Let's Encrypt staging endpoint for testing:

  ```caddyfile
  {
      acme_ca https://acme-staging-v02.api.letsencrypt.org/directory
  }
  ```

- Specify a custom ACME CA root certificate:

  ```caddyfile
  {
      acme_ca_root /path/to/ca/root.pem
  }
  ```

- Force all certificates to be issued by the internal CA (dev/test only):

  ```caddyfile
  {
      local_certs
  }
  ```

## Per-Site TLS Directive

- Custom certificate and key files:

  ```caddyfile
  example.com {
      tls cert.pem key.pem
  }
  ```

- Use the internal CA (Caddy's built-in PKI):

  ```caddyfile
  example.com {
      tls internal
  }
  ```

- Custom internal CA options:

  ```caddyfile
  example.com {
      tls {
          issuer internal {
              ca foo
              lifetime 24h
          }
      }
  }
  ```

## DNS Challenge

- Required for wildcard certificates and when ports 80/443 are not available:

  ```caddyfile
  *.example.com {
      tls {
          dns cloudflare {env.CLOUDFLARE_API_TOKEN}
      }
  }
  ```

- DNS providers are Caddy plugins. Install the provider module, e.g., `caddy-dns/cloudflare`.

## On-Demand TLS

- Provisions certificates at request time during the TLS handshake. Use only with the `ask` endpoint or `permission` module to prevent abuse:

  ```caddyfile
  {
      on_demand_tls {
          ask https://auth.example.com/check-domain
      }
  }

  https:// {
      tls {
          on_demand
      }
  }
  ```

- **Never enable on-demand TLS without an `ask` endpoint on a publicly accessible server** — attackers can exhaust your ACME account rate limits.

## Client Authentication (mTLS)

- Require clients to present a valid certificate:

  ```caddyfile
  example.com {
      tls {
          client_auth {
              mode require_and_verify
              trust_pool file /path/to/client-ca.pem
          }
      }
  }
  ```

- Client auth modes: `request`, `require`, `verify_if_given`, `require_and_verify` (default when trust pool is set).

## Disabling Automatic HTTPS

- Disable entirely (not recommended):

  ```caddyfile
  {
      auto_https disable_redirects
  }
  ```

- Disable for specific sites by using `http://` prefix:

  ```caddyfile
  http://internal.example.com {
      respond "No TLS here"
  }
  ```

- Disable just the redirects but keep certificate management:

  ```caddyfile
  {
      auto_https disable_redirects
  }
  ```

## Certificate Renewal

- Caddy renews certificates automatically before expiry — no cron jobs needed.
- Control the renewal window with `renewal_window_ratio` (0-1, fraction of certificate lifetime). Default triggers renewal at ~1/3 of remaining lifetime.

## Common Mistakes

- Disabling automatic HTTPS without a valid reason. Caddy's auto-HTTPS is a security feature, not a convenience — keep it enabled.

- Using `tls_insecure_skip_verify` in production (see `references/reverse-proxy.md`).

- Enabling on-demand TLS without an `ask` endpoint:

  ```caddyfile
  # Before (dangerous — any domain can trigger certificate issuance)
  https:// {
      tls {
          on_demand
      }
  }

  # After (safe — validates domains before issuing)
  {
      on_demand_tls {
          ask https://auth.example.com/check
      }
  }
  https:// {
      tls {
          on_demand
      }
  }
  ```

- Forgetting that wildcard certificates require the DNS challenge — the HTTP challenge cannot validate `*.example.com`.
