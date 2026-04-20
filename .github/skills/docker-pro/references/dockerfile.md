# Dockerfile Best Practices

Rules for Dockerfile syntax, multi-stage builds, layer caching, BuildKit features, and `COPY`/`RUN` instruction design.

## Syntax Declaration

- Always declare `# syntax=docker/dockerfile:1` as the very first line. This enables BuildKit frontend features (cache mounts, secret mounts, heredocs) and auto-updates the parser.

  ```dockerfile
  # Before
  FROM node:22-alpine
  RUN npm install

  # After
  # syntax=docker/dockerfile:1
  FROM node:22-alpine
  RUN npm install
  ```

## Multi-Stage Builds

- Always use multi-stage builds for compiled or transpiled applications. Separate into `deps`, `build`, and `runtime` stages.

  ```dockerfile
  # Before (single stage — bloated image with build tools and source)
  FROM node:22
  WORKDIR /app
  COPY . .
  RUN npm install
  RUN npm run build
  CMD ["node", "dist/main.js"]

  # After (multi-stage — minimal runtime image)
  # syntax=docker/dockerfile:1
  FROM node:22-alpine AS deps
  WORKDIR /app
  COPY package.json package-lock.json ./
  RUN npm ci

  FROM deps AS build
  COPY . .
  RUN npm run build

  FROM node:22-alpine AS runtime
  RUN addgroup -S app && adduser -S app -G app
  WORKDIR /app
  COPY --from=build --chown=app:app /app/dist ./dist
  COPY --from=deps --chown=app:app /app/node_modules ./node_modules
  USER app
  EXPOSE 3000
  CMD ["node", "dist/main.js"]
  ```

  **Why:** The final image contains only the runtime, compiled output, and production dependencies — no source code, build tools, or dev dependencies.

- Never copy source code into the final `runtime` stage — only compiled output and production dependencies.

  ```dockerfile
  # Before (source code in production image)
  COPY --from=build /app ./

  # After (only dist and node_modules)
  COPY --from=build /app/dist ./dist
  COPY --from=deps /app/node_modules ./node_modules
  ```

- Use `AS <name>` to name every stage. Reference stages by name in `COPY --from=<name>`, never by index number.

  ```dockerfile
  # Before
  COPY --from=0 /app/build /usr/share/nginx/html

  # After
  FROM node:22-alpine AS build
  # ...build steps...
  FROM nginx:alpine AS runtime
  COPY --from=build /app/build /usr/share/nginx/html
  ```

- Use a shared base stage when multiple stages need the same foundation.

  ```dockerfile
  FROM alpine AS base
  RUN apk add --no-cache openssl

  FROM base AS service-a
  # ...

  FROM base AS service-b
  # ...
  ```

## Layer Caching and Ordering

- Copy dependency manifests first, install, then copy source. This prevents reinstalling dependencies when only source code changes.

  ```dockerfile
  # Before (cache busted on every source change)
  COPY . .
  RUN npm install

  # After (dependencies cached unless manifests change)
  COPY package.json package-lock.json ./
  RUN npm ci --omit=dev
  COPY . .
  ```

  This pattern applies to all ecosystems:
  - **Node.js:** `package.json` + lockfile → `npm ci`
  - **Python:** `requirements.txt` → `pip install`
  - **Go:** `go.mod` + `go.sum` → `go mod download`
  - **Java/Maven:** `pom.xml` → `mvn dependency:resolve`
  - **Rust:** `Cargo.toml` + `Cargo.lock` → `cargo build --release`

- Order instructions from least-frequently-changing to most-frequently-changing: base image → system packages → dependency manifests → dependency install → source code → build.

- Combine `apt-get update && apt-get install` in a single `RUN` layer. Always clean up caches.

  ```dockerfile
  # Before (update cached, install fails with stale index)
  RUN apt-get update
  RUN apt-get install -y curl

  # After (single layer, cache cleaned)
  RUN apt-get update && apt-get install -y --no-install-recommends \
      curl \
      && rm -rf /var/lib/apt/lists/*
  ```

- For Alpine, use `--no-cache` to avoid storing the apk index.

  ```dockerfile
  RUN apk add --no-cache bash curl
  ```

## BuildKit Cache Mounts

- Use `--mount=type=cache` to persist package manager caches across builds. This dramatically speeds up dependency installs.

  ```dockerfile
  # Go
  RUN --mount=type=cache,target=/go/pkg/mod \
      --mount=type=cache,target=/root/.cache/go-build \
      go build -o /app/hello

  # Node.js (npm)
  RUN --mount=type=cache,target=/root/.npm \
      npm ci --omit=dev

  # Python (pip)
  RUN --mount=type=cache,target=/root/.cache/pip \
      pip install --no-cache-dir -r requirements.txt

  # .NET (NuGet)
  RUN --mount=type=cache,target=/root/.nuget/packages \
      dotnet publish -c Release -o /app

  # Java (Maven)
  RUN --mount=type=cache,target=/root/.m2 \
      mvn package -DskipTests
  ```

- Use `--mount=type=bind` to temporarily mount files without adding them as layers.

  ```dockerfile
  # Mount go.mod/go.sum for download without COPY
  RUN --mount=type=bind,source=go.mod,target=go.mod \
      --mount=type=bind,source=go.sum,target=go.sum \
      go mod download
  ```

## BuildKit Secret Mounts

- Never use `ARG` or `ENV` for secrets — they persist in image metadata and layer history. Use `--mount=type=secret`.

  ```dockerfile
  # Before (secret baked into image layers)
  ARG NPM_TOKEN
  RUN echo "//registry.npmjs.org/:_authToken=${NPM_TOKEN}" > .npmrc && npm ci

  # After (secret available only during this RUN, not in final image)
  RUN --mount=type=secret,id=npmrc,target=/root/.npmrc \
      npm ci --omit=dev
  ```

  ```dockerfile
  # Mount secrets as environment variables
  RUN --mount=type=secret,id=aws_key_id,env=AWS_ACCESS_KEY_ID \
      --mount=type=secret,id=aws_secret_key,env=AWS_SECRET_ACCESS_KEY \
      aws s3 cp s3://my-bucket/file .
  ```

  Pass secrets at build time:

  ```console
  $ docker build --secret id=npmrc,src=$HOME/.npmrc .
  $ docker build --secret id=aws_key_id,env=AWS_ACCESS_KEY_ID .
  ```

## SSH Forwarding

- Use `--mount=type=ssh` to forward the host SSH agent into the build for private repo access.

  ```dockerfile
  RUN --mount=type=ssh git clone git@github.com:org/private-repo.git
  ```

  ```console
  $ docker build --ssh default .
  ```

## Multi-Platform Builds

- Use `docker buildx build --platform` for multi-architecture images. Use `$BUILDPLATFORM` and `$TARGETARCH` build args in the Dockerfile.

  ```dockerfile
  FROM --platform=$BUILDPLATFORM golang:1.23-alpine AS build
  ARG TARGETARCH
  RUN GOARCH=$TARGETARCH go build -o /app .

  FROM alpine
  COPY --from=build /app /app
  ```

  ```console
  $ docker buildx build --platform linux/amd64,linux/arm64 --push -t myrepo/app:latest .
  ```

## ARG and ENV

- Use `ARG` for build-time configuration. Use `ENV` for runtime environment variables. Use both when the value should be overridable at build time but visible at runtime.

  ```dockerfile
  ARG NODE_ENV=production
  ENV NODE_ENV=$NODE_ENV
  ```

  **Why:** `ARG` values are not present in the final image; `ENV` values are. `ENV` overrides `ARG` of the same name during build.

- Group related `ENV` declarations. Prefer single `ENV` with multiple key=value pairs to reduce layers.

  ```dockerfile
  # Before (multiple layers)
  ENV NODE_ENV=production
  ENV PORT=3000

  # After (single layer)
  ENV NODE_ENV=production \
      PORT=3000
  ```

## Instruction Best Practices

- Prefer `COPY` over `ADD` unless you need URL fetching or tar auto-extraction. `COPY` is explicit and predictable.

- Use `ENTRYPOINT` for the main executable and `CMD` for default arguments.

  ```dockerfile
  ENTRYPOINT ["node"]
  CMD ["dist/main.js"]
  ```

- Always use the exec-form (`["executable", "arg"]`) for `ENTRYPOINT` and `CMD`. Shell-form wraps in `/bin/sh -c` which breaks signal propagation.

  ```dockerfile
  # Before (shell form — PID 1 is sh, not node)
  CMD node dist/main.js

  # After (exec form — node is PID 1, receives SIGTERM)
  CMD ["node", "dist/main.js"]
  ```

- Use `EXPOSE` to document the port(s) the container listens on. This does not publish the port — it serves as documentation.

- Use `WORKDIR` to set the working directory. Never `RUN cd /dir && ...`.

  ```dockerfile
  # Before
  RUN cd /app && npm install

  # After
  WORKDIR /app
  RUN npm install
  ```

- Use `--chown` on `COPY` to avoid a separate `RUN chown` layer.

  ```dockerfile
  # Before (extra layer)
  COPY dist/ /app/dist/
  RUN chown -R app:app /app

  # After (single layer)
  COPY --chown=app:app dist/ /app/dist/
  ```

## Pin Base Image Versions

- Always pin to a specific major.minor tag. Never use `latest` or bare image names.

  ```dockerfile
  # Before
  FROM node:latest
  FROM python

  # After
  FROM node:22-alpine
  FROM python:3.12-slim
  ```

  **Why:** `latest` changes without warning, breaking builds and introducing untested changes.

- For maximum reproducibility (CI, production), pin to digest. For readability (development), pin to version tag.

  ```dockerfile
  # Production CI (fully reproducible)
  FROM node:22-alpine@sha256:abc123...

  # Development (readable, reasonable stability)
  FROM node:22-alpine
  ```
