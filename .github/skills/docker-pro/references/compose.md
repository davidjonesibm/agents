# Docker Compose v2

Rules for service design, networking, volumes, profiles, watch mode, secrets, and `depends_on` in Docker Compose v2 (`docker compose` CLI plugin).

## File Naming

- Use `compose.yaml` as the primary filename. `docker-compose.yml` is legacy and still supported but the modern convention is `compose.yaml`.

  ```text
  # Before
  docker-compose.yml
  docker-compose.override.yml

  # After
  compose.yaml
  compose.override.yaml
  ```

## Service Dependencies

- Always use `depends_on` with `condition` instead of bare `depends_on` lists. Bare `depends_on` only waits for the container to start, not for the service to be ready.

  ```yaml
  # Before (only waits for container start)
  services:
    api:
      depends_on:
        - db

  # After (waits for db to pass health check)
  services:
    api:
      depends_on:
        db:
          condition: service_healthy
  ```

  Available conditions: `service_started`, `service_healthy`, `service_completed_successfully`.

## Health Checks

- Define health checks for any service that other services depend on. Use `CMD` or `CMD-SHELL` form.

  ```yaml
  services:
    db:
      image: postgres:16
      healthcheck:
        test: ['CMD', 'pg_isready', '-U', 'postgres']
        interval: 10s
        timeout: 5s
        retries: 5
        start_period: 30s
        start_interval: 5s

    redis:
      image: redis:7-alpine
      healthcheck:
        test: ['CMD', 'redis-cli', 'ping']
        interval: 5s
        timeout: 3s
        retries: 5
        start_period: 10s
  ```

  - `start_period`: grace period before health checks count as failures (for slow-starting services).
  - `start_interval`: interval between checks during the start period (Compose v2.20+).

- To disable an inherited health check:

  ```yaml
  healthcheck:
    disable: true
  ```

## Profiles

- Use `profiles` to conditionally activate services. Services without `profiles` are always started. Services with `profiles` are only started when that profile is active.

  ```yaml
  services:
    api:
      image: myapp/api
      # No profiles — always active

    debug-tools:
      image: debug-tools
      profiles:
        - debug

    test-db:
      image: postgres:16
      profiles:
        - test
        - integration

    monitoring:
      image: prometheus
      profiles:
        - monitoring
        - production
  ```

  ```console
  # Default services only
  $ docker compose up

  # With debug profile
  $ docker compose --profile debug up

  # Multiple profiles
  $ docker compose --profile test --profile monitoring up
  ```

  **Why:** Profiles prevent dev-only tooling (adminer, mailhog, debug shells) from running in production without needing separate Compose files.

## Watch Mode (Development)

- Use `develop.watch` for live-reload development workflows. Three actions are available:
  - `sync` — syncs files into the container (hot reload).
  - `sync+restart` — syncs files then restarts the container (for config changes).
  - `rebuild` — rebuilds the image and recreates the container.

  ```yaml
  services:
    web:
      build: .
      command: npm start
      develop:
        watch:
          - action: sync
            path: ./src
            target: /app/src
            ignore:
              - node_modules/
          - action: sync+restart
            path: ./config/nginx.conf
            target: /etc/nginx/conf.d/default.conf
          - action: rebuild
            path: package.json
  ```

  ```console
  $ docker compose watch
  # or
  $ docker compose up --watch
  ```

  **Why:** Watch mode replaces bind-mount-based dev setups with explicit sync rules, avoiding file permission issues and inotify limits.

## Networks

- Use custom bridge networks to isolate service groups. Services on different networks cannot communicate.

  ```yaml
  services:
    frontend:
      image: nginx
      networks:
        - frontend-net
      ports:
        - '80:80'

    api:
      image: myapi:latest
      networks:
        - frontend-net
        - backend-net

    db:
      image: postgres:16
      networks:
        - backend-net
      volumes:
        - db-data:/var/lib/postgresql/data

  networks:
    frontend-net:
      driver: bridge
    backend-net:
      driver: bridge
      internal: true # no external access
  ```

  **Why:** `internal: true` prevents the database network from reaching the internet, reducing attack surface.

- Services on user-defined networks can resolve each other by service name (Docker's embedded DNS). The default bridge network does NOT support DNS resolution between containers.

## Volumes

- Prefer named volumes over host bind mounts for data persistence. Named volumes are managed by Docker and portable.

  ```yaml
  # Before (bind mount — host-path dependent)
  volumes:
    - ./data:/var/lib/postgresql/data

  # After (named volume — portable, managed)
  volumes:
    - db-data:/var/lib/postgresql/data

  volumes:
    db-data:
  ```

- Use the long syntax for clarity when specifying volume options.

  ```yaml
  services:
    backend:
      volumes:
        - type: volume
          source: db-data
          target: /data
          volume:
            nocopy: true
        - type: bind
          source: ./config
          target: /app/config
          read_only: true
  ```

- Share named volumes between services.

  ```yaml
  services:
    backend:
      volumes:
        - db-data:/etc/data

    backup:
      volumes:
        - db-data:/var/lib/backup/data:ro

  volumes:
    db-data:
  ```

## Secrets

- Use Compose secrets to inject sensitive data. Secrets are mounted at `/run/secrets/<name>` inside the container.

  ```yaml
  services:
    db:
      image: postgres:16
      environment:
        POSTGRES_PASSWORD_FILE: /run/secrets/db-password
      secrets:
        - db-password

  secrets:
    db-password:
      file: ./secrets/db-password.txt
  ```

- Support for environment-variable-based secrets (Compose v2.6+):

  ```yaml
  secrets:
    api-token:
      environment: 'API_TOKEN'
  ```

- Build-time secrets (injected during build, not persisted in image):

  ```yaml
  services:
    myapp:
      build:
        secrets:
          - npm_token
        context: .

  secrets:
    npm_token:
      environment: NPM_TOKEN
  ```

## Environment Variables

- Prefer `environment` map syntax over list syntax for clarity.

  ```yaml
  # Before (list syntax — easy to miss the = separator)
  environment:
    - NODE_ENV=production
    - PORT=3000

  # After (map syntax — clearer)
  environment:
    NODE_ENV: production
    PORT: "3000"
  ```

- Use `.env` files for shared defaults. Reference with `env_file`.

  ```yaml
  services:
    api:
      env_file:
        - .env
        - .env.local
  ```

  Precedence (highest to lowest):
  1. `environment` in `compose.yaml`
  2. Shell environment variables
  3. `env_file` entries
  4. `.env` file (for Compose variable interpolation)

- Never commit `.env` files with real secrets. Use `.env.example` as a template.

## Resource Limits

- Set CPU and memory limits for services to prevent runaway resource consumption.

  ```yaml
  services:
    api:
      deploy:
        resources:
          limits:
            cpus: '1.0'
            memory: 512M
          reservations:
            cpus: '0.25'
            memory: 128M
  ```

## Restart Policies

- Always set a `restart` policy for production services.

  ```yaml
  services:
    api:
      restart: unless-stopped

    worker:
      restart: on-failure

    one-shot-task:
      restart: 'no'
  ```

  Or via deploy (for Swarm-compatible configs):

  ```yaml
  deploy:
    restart_policy:
      condition: on-failure
      delay: 5s
      max_attempts: 3
      window: 120s
  ```

## Include and Modularization

- Use `include` to split large Compose files into focused modules.

  ```yaml
  # compose.yaml
  include:
    - path: ./infra.yaml

  services:
    web:
      build: .
      depends_on:
        redis:
          condition: service_healthy
  ```

  ```yaml
  # infra.yaml
  services:
    redis:
      image: redis:7-alpine
      volumes:
        - redis-data:/data
      healthcheck:
        test: ['CMD', 'redis-cli', 'ping']
        interval: 5s
        timeout: 3s
        retries: 5

  volumes:
    redis-data:
  ```

## Port Publishing

- Use the long syntax for complex port configurations. Always bind to `127.0.0.1` in development to avoid exposing services externally.

  ```yaml
  # Before (binds to 0.0.0.0 — accessible externally)
  ports:
    - "5432:5432"

  # After (localhost only)
  ports:
    - "127.0.0.1:5432:5432"
  ```

- Use `expose` instead of `ports` for inter-service communication. `expose` makes a port accessible to linked services without publishing it to the host.

## Logging

- Configure logging driver and options per service.

  ```yaml
  services:
    api:
      logging:
        driver: json-file
        options:
          max-size: '10m'
          max-file: '3'
  ```

  **Why:** Without log rotation, `json-file` logs grow unbounded and can fill the disk.
