# Security Hardening

Rules for running containers with minimal privileges, managing secrets, and reducing attack surface.

## Non-Root User

- Always create and switch to a non-root user in the final stage of the Dockerfile. Never run production containers as root.

  ```dockerfile
  # Before (runs as root)
  FROM node:22-alpine
  WORKDIR /app
  COPY . .
  CMD ["node", "app.js"]

  # After (runs as non-root user)
  FROM node:22-alpine
  RUN addgroup -S app && adduser -S app -G app
  WORKDIR /app
  COPY --chown=app:app . .
  USER app
  CMD ["node", "app.js"]
  ```

- For Debian/Ubuntu-based images:

  ```dockerfile
  ARG UID=10001
  RUN adduser \
      --disabled-password \
      --gecos "" \
      --home "/nonexistent" \
      --shell "/sbin/nologin" \
      --no-create-home \
      --uid "${UID}" \
      appuser
  USER appuser
  ```

  **Why:** `--no-create-home` and `--shell /sbin/nologin` further harden the user — no home directory to write to, no interactive shell.

- Use `--no-log-init` with `useradd` to prevent potential disk exhaustion from sparse files in large UID ranges.

  ```dockerfile
  RUN groupadd -r postgres && useradd --no-log-init -r -g postgres postgres
  ```

## Drop All Capabilities

- Drop all Linux capabilities and add back only what's needed.

  ```yaml
  # compose.yaml
  services:
    api:
      cap_drop:
        - ALL
      cap_add:
        - NET_BIND_SERVICE # only if binding to ports < 1024
  ```

  ```console
  # docker run equivalent
  $ docker run --cap-drop ALL --cap-add NET_BIND_SERVICE myapp
  ```

  **Why:** By default, Docker grants a broad set of capabilities. Dropping ALL and adding back selectively follows the principle of least privilege.

## No New Privileges

- Prevent processes from gaining additional privileges via setuid/setgid binaries.

  ```yaml
  # compose.yaml
  services:
    api:
      security_opt:
        - no-new-privileges:true
  ```

  ```console
  $ docker run --security-opt no-new-privileges myapp
  ```

## Read-Only Root Filesystem

- Mount the root filesystem as read-only. Use `tmpfs` for directories that need write access.

  ```yaml
  # compose.yaml
  services:
    api:
      read_only: true
      tmpfs:
        - /tmp
        - /var/run
  ```

  **Why:** Prevents an attacker from modifying binaries or writing web shells to the filesystem, even after container compromise.

## Combined Security Profile

- Apply all hardening options together for production services.

  ```yaml
  services:
    api:
      image: myapp:1.2.3
      read_only: true
      cap_drop:
        - ALL
      security_opt:
        - no-new-privileges:true
      tmpfs:
        - /tmp
      user: '10001:10001'
      deploy:
        resources:
          limits:
            cpus: '1.0'
            memory: 512M
  ```

  Kubernetes-equivalent `securityContext`:

  ```yaml
  securityContext:
    runAsUser: 10001
    runAsNonRoot: true
    allowPrivilegeEscalation: false
    readOnlyRootFilesystem: true
    seccompProfile:
      type: RuntimeDefault
    capabilities:
      drop:
        - ALL
  ```

## Build-Time Secrets

- Never pass secrets via `ARG` — they are visible in `docker history` and image metadata. Use `--mount=type=secret`.

  ```dockerfile
  # Before (INSECURE — secret in build history)
  ARG NPM_TOKEN
  RUN echo "//registry.npmjs.org/:_authToken=${NPM_TOKEN}" > .npmrc
  RUN npm ci
  RUN rm .npmrc

  # After (secret available only during RUN, not persisted)
  RUN --mount=type=secret,id=npmrc,target=/root/.npmrc \
      npm ci --omit=dev
  ```

- Mount secrets as environment variables:

  ```dockerfile
  RUN --mount=type=secret,id=aws_key_id,env=AWS_ACCESS_KEY_ID \
      --mount=type=secret,id=aws_secret_key,env=AWS_SECRET_ACCESS_KEY \
      aws s3 cp s3://my-bucket/file .
  ```

## Runtime Secrets

- Use Docker Compose secrets (mounted at `/run/secrets/`) instead of environment variables for sensitive data.

  ```yaml
  # Before (secret visible in docker inspect, process listing, logs)
  services:
    db:
      environment:
        POSTGRES_PASSWORD: "my-secret-pw"

  # After (secret in file, not in env)
  services:
    db:
      environment:
        POSTGRES_PASSWORD_FILE: /run/secrets/db-password
      secrets:
        - db-password

  secrets:
    db-password:
      file: ./secrets/db-password.txt
  ```

  **Why:** Environment variables can leak through `docker inspect`, `/proc/<pid>/environ`, error logs, and crash dumps.

## Image Scanning

- Scan images for vulnerabilities before deploying. Use `docker scout` (built-in), Trivy, Snyk, or Grype.

  ```console
  $ docker scout cves myapp:latest
  $ trivy image myapp:latest
  ```

- Pin images by digest in CI for supply chain security.

  ```dockerfile
  FROM node:22-alpine@sha256:abc123def456...
  ```

## Network Isolation

- Use `internal: true` on backend networks to prevent containers from reaching the internet.

  ```yaml
  networks:
    backend-net:
      driver: bridge
      internal: true
  ```

  See also `references/compose.md` for full network isolation patterns.

## Filesystem and Privilege Checklist

| Setting             | Purpose                    | Default      | Recommended         |
| ------------------- | -------------------------- | ------------ | ------------------- |
| `USER`              | Run as non-root            | `root`       | Named user or UID   |
| `read_only`         | Immutable root FS          | `false`      | `true` + tmpfs      |
| `cap_drop`          | Remove capabilities        | Many granted | `ALL`               |
| `cap_add`           | Restore capabilities       | N/A          | Only what's needed  |
| `no-new-privileges` | Block privilege escalation | `false`      | `true`              |
| `privileged`        | Full host access           | `false`      | Never in production |
