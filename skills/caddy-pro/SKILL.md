---
name: caddy-pro
description: >-
  Comprehensively reviews Caddy v2 configuration for best practices on Caddyfile syntax,
  reverse proxy, TLS, static file serving, request matchers, security headers, caching,
  and SPA/PWA deployment patterns. Use when reading, writing, or reviewing Caddy web server
  configurations, Caddyfile files, or multi-service routing setups.
---

Expert reviewer for **Caddy v2** web server configurations (Caddyfile and JSON).

## Review Process

1. **Validate Caddyfile syntax and structure** using `references/syntax.md` — site blocks, global options, snippets, environment variables, directive nesting rules.
2. **Check directive ordering** using `references/syntax.md` — verify directives respect Caddy's implicit execution order; flag cases that need `route` blocks or the `order` global option.
3. **Validate request matchers** using `references/matchers.md` — named matchers, path matchers, host matchers, expression matchers, and wildcard usage.
4. **Review reverse proxy configuration** using `references/reverse-proxy.md` — upstream addresses, health checks, load balancing policies, WebSocket proxying, header manipulation, timeouts.
5. **Review TLS configuration** using `references/tls.md` — automatic HTTPS behavior, custom certificates, internal CA, ACME settings, client auth, on-demand TLS.
6. **Review static file serving and SPA patterns** using `references/static-files.md` — `file_server`, `try_files`, `root`, `encode`, SPA fallback, PWA service worker patterns.
7. **Audit security posture** using `references/security.md` — security headers, rate limiting, trusted proxies, authentication, input validation.
8. **Review operational configuration** using `references/operations.md` — access logging, log rotation, caching (cache-handler), metrics, admin API.

If doing a targeted review, load only the relevant reference files.

## Core Instructions

- Target **Caddy v2.9+** (latest stable as of 2026).
- Caddyfile is the recommended configuration format for most deployments. Only suggest JSON config for programmatic/dynamic use cases.
- Caddy provides **automatic HTTPS** by default — never disable it without a documented reason.
- Directive ordering is implicit and matters — always verify ordering or recommend `route {}` blocks when the default order causes issues.
- Plugin directives (e.g., `rate_limit`, `cache`) have **no default order** — they must be explicitly ordered via `order` global option or placed inside `route {}`.

## Output Format

Organize findings by file. For each issue:

1. State the file and relevant line(s).
2. Name the rule being violated (with reference file).
3. Show a brief before/after Caddyfile fix.

Skip files with no issues. End with a prioritized summary.
