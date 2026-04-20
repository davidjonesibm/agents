# Image Optimization

Rules for base image selection, .dockerignore, layer minimization, and final image size reduction.

## Base Image Selection

- Choose the smallest base image that meets your runtime requirements.

  | Base                  | Size      | Use Case                              | Notes                                                 |
  | --------------------- | --------- | ------------------------------------- | ----------------------------------------------------- |
  | `scratch`             | 0 MB      | Static Go/Rust binaries               | No shell, no package manager                          |
  | `gcr.io/distroless/*` | ~2-20 MB  | Java, Node, Python runtimes           | No shell, no package manager. Minimal attack surface  |
  | `*-alpine`            | ~5-7 MB   | Most applications                     | musl libc — may cause issues with some native modules |
  | `*-slim`              | ~25-80 MB | Apps needing glibc or Debian packages | Good balance of size and compatibility                |
  | `*:bookworm` (Debian) | ~120+ MB  | Apps needing full package ecosystem   | Last resort for production                            |

- **Alpine vs Debian-slim trade-offs:**
  - Alpine uses `musl` libc. Some Node.js native modules, Python C extensions, or JNI libraries may not compile or behave correctly with musl.
  - If native module builds fail on Alpine, switch to `*-slim` (Debian-based).
  - Alpine uses `apk`, Debian uses `apt-get`.

- Use `scratch` for statically compiled binaries (Go with `CGO_ENABLED=0`, Rust).

  ```dockerfile
  # syntax=docker/dockerfile:1
  FROM golang:1.23-alpine AS build
  WORKDIR /app
  COPY . .
  RUN CGO_ENABLED=0 go build -o /server .

  FROM scratch
  COPY --from=build /server /server
  COPY --from=build /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
  ENTRYPOINT ["/server"]
  ```

  **Why:** Scratch images have zero OS overhead, zero CVEs from OS packages, and the smallest possible size.

- Use distroless for interpreted languages that need a runtime but not a shell.

  ```dockerfile
  FROM gcr.io/distroless/nodejs22-debian12
  COPY --from=build /app/dist /app
  COPY --from=build /app/node_modules /app/node_modules
  WORKDIR /app
  CMD ["main.js"]
  ```

## .dockerignore

- Always create a `.dockerignore` file. Without it, the entire build context (including `.git/`, `node_modules/`, secrets) is sent to the Docker daemon.

  ```dockerignore
  # Version control
  .git/
  .gitignore

  # Dependencies (rebuilt in container)
  node_modules/
  vendor/
  .venv/

  # Build outputs
  dist/
  build/
  out/
  coverage/

  # Environment and secrets
  .env
  .env.*
  !.env.example
  *.pem
  *.key
  secrets/

  # IDE and OS
  .vscode/
  .idea/
  .DS_Store
  Thumbs.db

  # Docker files (prevent recursive context)
  Dockerfile*
  .dockerignore
  compose*.yaml
  compose*.yml
  docker-compose*.yml

  # Documentation
  README.md
  CHANGELOG.md
  docs/

  # Tests (if not needed at build time)
  __tests__/
  *.test.*
  *.spec.*
  ```

- For monorepos, use a root `.dockerignore` that excludes everything except the needed workspace and shared packages. See `references/patterns.md`.

- **Exception negation:** Use `!` to re-include specific files from excluded patterns.

  ```dockerignore
  *.env*
  !.env.example
  !.env.production
  ```

## Layer Minimization

- Merge related `RUN` commands to reduce layer count. Each `RUN` creates a new layer.

  ```dockerfile
  # Before (3 layers)
  RUN apt-get update
  RUN apt-get install -y curl
  RUN rm -rf /var/lib/apt/lists/*

  # After (1 layer)
  RUN apt-get update && \
      apt-get install -y --no-install-recommends curl && \
      rm -rf /var/lib/apt/lists/*
  ```

- Always clean package manager caches in the same `RUN` layer as the install.

  ```dockerfile
  # Alpine
  RUN apk add --no-cache curl bash

  # Debian
  RUN apt-get update && \
      apt-get install -y --no-install-recommends curl && \
      rm -rf /var/lib/apt/lists/*

  # Python
  RUN pip install --no-cache-dir -r requirements.txt
  ```

  **Why:** If you `rm` in a separate layer, the deleted files still exist in the previous layer and contribute to image size.

- Remove build dependencies after compilation in the same layer.

  ```dockerfile
  # Alpine: install build deps, build, remove build deps in one layer
  RUN apk add --no-cache --virtual .build-deps gcc musl-dev && \
      pip install --no-cache-dir -r requirements.txt && \
      apk del .build-deps
  ```

## Production Dependencies Only

- Install only production dependencies in the runtime stage.

  ```dockerfile
  # Node.js
  RUN npm ci --omit=dev

  # Python
  RUN pip install --no-cache-dir --no-deps -r requirements.txt

  # Go (compiled — no runtime deps by default)
  ```

## Avoid Installing Unnecessary Packages

- Use `--no-install-recommends` with `apt-get` to skip suggested packages.

  ```dockerfile
  RUN apt-get update && \
      apt-get install -y --no-install-recommends \
        curl \
        ca-certificates && \
      rm -rf /var/lib/apt/lists/*
  ```

## Image Size Debugging

- Use `docker image history` to identify large layers.

  ```console
  $ docker image history myapp:latest
  ```

- Use `docker scout` or `dive` to inspect image contents layer by layer.

  ```console
  $ dive myapp:latest
  ```
