# Patterns

Rules for build context management, monorepo patterns, environment variable design, and production deployment workflows.

## Build Context in Monorepos

- In a monorepo, set the build context to the repo root and use `dockerfile` to point to the specific service's Dockerfile. This allows `COPY` to access shared packages.

  ```yaml
  # compose.yaml
  services:
    api:
      build:
        context: .
        dockerfile: apps/api/Dockerfile
    web:
      build:
        context: .
        dockerfile: apps/web/Dockerfile
  ```

  ```dockerfile
  # apps/api/Dockerfile
  # syntax=docker/dockerfile:1
  FROM node:22-alpine AS deps
  WORKDIR /app
  COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
  COPY apps/api/package.json ./apps/api/
  COPY libs/shared/package.json ./libs/shared/
  RUN corepack enable && pnpm install --frozen-lockfile

  FROM deps AS build
  COPY libs/shared/ ./libs/shared/
  COPY apps/api/ ./apps/api/
  RUN pnpm --filter @myapp/api build

  FROM node:22-alpine AS runtime
  RUN addgroup -S app && adduser -S app -G app
  WORKDIR /app
  COPY --from=build --chown=app:app /app/apps/api/dist ./dist
  COPY --from=build --chown=app:app /app/node_modules ./node_modules
  COPY --from=build --chown=app:app /app/apps/api/node_modules ./apps/api/node_modules
  USER app
  CMD ["node", "dist/main.js"]
  ```

- Use `.dockerignore` at the repo root to exclude everything except necessary files.

  ```dockerignore
  # Exclude everything
  *

  # Include needed paths
  !package.json
  !pnpm-lock.yaml
  !pnpm-workspace.yaml
  !apps/api/
  !libs/shared/
  !tsconfig*.json

  # Re-exclude unnecessary files within included paths
  **/node_modules
  **/.git
  **/dist
  **/*.test.*
  **/*.spec.*
  ```

  **Why:** In monorepos, the build context can be very large. A restrictive `.dockerignore` prevents sending gigabytes of unrelated code to the daemon.

## Multi-App .dockerignore Pattern

- When different services need different `.dockerignore` rules, use Dockerfile-specific ignore files (BuildKit feature):

  ```text
  apps/api/Dockerfile.dockerignore    # Used when building with apps/api/Dockerfile
  apps/web/Dockerfile.dockerignore    # Used when building with apps/web/Dockerfile
  ```

  The naming convention is `<Dockerfile-name>.dockerignore`.

## Environment Variable Design

- Separate build-time configuration (`ARG`) from runtime configuration (`ENV`).

  ```dockerfile
  # Build-time only (not in final image)
  ARG BUILD_VERSION=dev

  # Runtime (visible in container)
  ENV NODE_ENV=production \
      PORT=3000
  ```

- For Compose, use variable interpolation from `.env` for defaults, and `environment` for overrides.

  ```text
  # .env
  APP_PORT=8000
  REDIS_HOST=redis
  ```

  ```yaml
  # compose.yaml
  services:
    api:
      ports:
        - '${APP_PORT}:3000'
      environment:
        REDIS_HOST: ${REDIS_HOST}
  ```

- Never put real secrets in `.env` files that are committed to version control. Use `.env.example` with placeholder values.

  ```text
  # .env.example (committed)
  DATABASE_URL=postgres://user:password@localhost:5432/mydb
  API_KEY=your-api-key-here

  # .env (gitignored, real values)
  DATABASE_URL=postgres://prod-user:real-password@db:5432/prod
  API_KEY=sk-1234567890
  ```

## Production Compose Patterns

- Use separate Compose files for development and production, with shared base services.

  ```yaml
  # compose.yaml (base — shared configuration)
  services:
    api:
      image: myapp/api:${TAG:-latest}
      restart: unless-stopped
      healthcheck:
        test: ['CMD', 'curl', '-f', 'http://localhost:3000/health']
        interval: 30s
        timeout: 5s
        retries: 3

    db:
      image: postgres:16
      volumes:
        - db-data:/var/lib/postgresql/data
      healthcheck:
        test: ['CMD', 'pg_isready']
        interval: 10s
        timeout: 5s
        retries: 5

  volumes:
    db-data:
  ```

  ```yaml
  # compose.override.yaml (development — auto-loaded)
  services:
    api:
      build: .
      volumes:
        - ./src:/app/src
      environment:
        NODE_ENV: development
      ports:
        - '127.0.0.1:3000:3000'
        - '127.0.0.1:9229:9229' # debugger

    db:
      ports:
        - '127.0.0.1:5432:5432'
      environment:
        POSTGRES_PASSWORD: devpassword
  ```

  ```yaml
  # compose.prod.yaml (production — explicit load)
  services:
    api:
      cap_drop:
        - ALL
      security_opt:
        - no-new-privileges:true
      read_only: true
      tmpfs:
        - /tmp
      deploy:
        resources:
          limits:
            cpus: '2.0'
            memory: 1G

    db:
      environment:
        POSTGRES_PASSWORD_FILE: /run/secrets/db-password
      secrets:
        - db-password

  secrets:
    db-password:
      file: ./secrets/db-password.txt
  ```

  ```console
  # Development (uses compose.yaml + compose.override.yaml)
  $ docker compose up

  # Production (uses compose.yaml + compose.prod.yaml, skips override)
  $ docker compose -f compose.yaml -f compose.prod.yaml up -d
  ```

## CI/CD Build Patterns

- Use registry-based caching in CI to speed up builds across pipeline runs.

  ```console
  $ docker buildx build --push -t registry/app:latest \
      --cache-from type=registry,ref=registry/app:buildcache \
      --cache-to type=registry,ref=registry/app:buildcache,mode=max .
  ```

- For branch-based caching, fall back to the main branch's cache.

  ```console
  $ docker buildx build --push -t registry/app:$BRANCH \
      --cache-from type=registry,ref=registry/app:$BRANCH \
      --cache-from type=registry,ref=registry/app:main \
      --cache-to type=registry,ref=registry/app:$BRANCH .
  ```

- Use GitHub Actions cache backend for GitHub-hosted runners.

  ```yaml
  - uses: docker/build-push-action@v6
    with:
      push: true
      tags: user/app:latest
      cache-from: type=gha
      cache-to: type=gha,mode=max
  ```

## Tagging Strategy

- Tag images with both a version and a commit SHA. Never deploy `latest` in production.

  ```console
  $ docker build -t myapp:1.2.3 -t myapp:$(git rev-parse --short HEAD) .
  ```

- Use semantic versioning tags: `1.2.3`, `1.2`, `1`.

## Init Process

- Use `--init` or Tini as PID 1 to handle zombie process reaping and signal forwarding.

  ```yaml
  # compose.yaml
  services:
    api:
      init: true
  ```

  ```console
  $ docker run --init myapp
  ```

  **Why:** Without an init process, orphaned child processes accumulate and signals like SIGTERM may not reach the application process.

## Graceful Shutdown

- Set `stop_grace_period` to allow services time to drain connections before being killed.

  ```yaml
  services:
    api:
      stop_grace_period: 30s
  ```

- Ensure your application handles `SIGTERM` for graceful shutdown. Using exec-form `CMD`/`ENTRYPOINT` ensures the app is PID 1 and receives the signal directly.
