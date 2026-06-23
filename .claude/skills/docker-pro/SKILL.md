---
name: docker-pro
description: >-
  Docker best practices for Dockerfiles, multi-stage builds, Docker Compose,
  layer caching, security hardening, and production deployment. Use when reading,
  writing, or reviewing Dockerfiles, compose files, or container configuration.
---

Review Docker and container configuration for correctness, security, performance, and adherence to current best practices.

Review process:

1. Check Dockerfile structure, multi-stage builds, layer caching, and BuildKit usage with `.github/skills/docker-pro/references/dockerfile.md`.
2. Validate Docker Compose service design, networking, volumes, profiles, and watch mode with `.github/skills/docker-pro/references/compose.md`.
3. Audit security hardening (non-root, capabilities, secrets, read-only) with `.github/skills/docker-pro/references/security.md`.
4. Check image optimization, .dockerignore, base image selection with `.github/skills/docker-pro/references/optimization.md`.
5. Check build context, monorepo patterns, environment variables, and production patterns with `.github/skills/docker-pro/references/patterns.md`.
6. Check health checks, restart policies, logging, networking, and debugging with `.github/skills/docker-pro/references/operations.md`.

If doing a partial review, load only the relevant reference files.

## Core Instructions

- Target Docker Engine 27+ and Docker Compose v2 (`docker compose` CLI plugin).
- Every Dockerfile should declare `# syntax=docker/dockerfile:1` as line 1 to enable BuildKit features.
- Every Dockerfile for compiled/transpiled apps should use **multi-stage builds**.
- Always **pin base image versions** — never use `latest` in production.
- Always run containers as a **non-root user** in the final stage.
- Always define **health checks** for services that other services depend on.
- Never store **secrets in image layers** — use `--mount=type=secret` or runtime injection.
- Compose files should use `compose.yaml` (not `docker-compose.yml`) per current conventions.

## Output Format

Organize findings by file. For each issue:

1. State the file and relevant line(s).
2. Name the rule being violated.
3. Show a brief before/after code fix.

Skip files with no issues. End with a prioritized summary of the most impactful changes.
