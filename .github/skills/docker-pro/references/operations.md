# Operations

Rules for health checks, restart policies, networking, logging, and debugging running containers.

## Health Checks (Dockerfile)

- Define `HEALTHCHECK` in the Dockerfile for services that other containers depend on.

  ```dockerfile
  # HTTP health check
  HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
      CMD ["curl", "-f", "http://localhost:3000/health"]

  # TCP health check (no curl needed)
  HEALTHCHECK --interval=10s --timeout=3s --retries=5 \
      CMD ["sh", "-c", "nc -z localhost 3000 || exit 1"]
  ```

- For Alpine images without curl, use `wget` or `nc`:

  ```dockerfile
  HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
      CMD ["wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3000/health"]
  ```

- Common health check commands per service:

  | Service    | Command                                    |
  | ---------- | ------------------------------------------ |
  | PostgreSQL | `pg_isready -U postgres`                   |
  | Redis      | `redis-cli ping`                           |
  | MySQL      | `mysqladmin ping -h localhost`             |
  | MongoDB    | `mongosh --eval "db.adminCommand('ping')"` |
  | HTTP API   | `curl -f http://localhost:PORT/health`     |
  | NGINX      | `curl -f http://localhost:80/`             |

## Health Check Parameters

- `interval` — Time between checks (default: 30s).
- `timeout` — Max time a check can take before considered failed (default: 30s).
- `start_period` — Grace period for startup — failures during this period don't count toward retries (default: 0s).
- `start_interval` — Interval between checks during the start period (Compose v2.20+, default: 5s).
- `retries` — Number of consecutive failures before marking unhealthy (default: 3).

  Set `start_period` generously for services with slow startup (databases, JVM apps).

## Restart Policies

- Choose the right restart policy:

  | Policy           | Behavior                                 | Use Case                   |
  | ---------------- | ---------------------------------------- | -------------------------- |
  | `no`             | Never restart                            | One-shot tasks, migrations |
  | `on-failure`     | Restart only on non-zero exit code       | Workers, batch jobs        |
  | `always`         | Always restart (even on clean exit)      | Infrastructure services    |
  | `unless-stopped` | Like `always` but respects `docker stop` | Most production services   |

  ```yaml
  services:
    api:
      restart: unless-stopped

    migration:
      restart: 'no'

    worker:
      restart: on-failure
  ```

## Networking

### User-Defined Bridge Networks

- Always use user-defined bridge networks instead of the default bridge.

  ```yaml
  # Before (default bridge — no DNS, no isolation)
  services:
    api:
      image: myapp
    db:
      image: postgres

  # After (custom bridge — DNS, isolation)
  services:
    api:
      image: myapp
      networks:
        - app-net
    db:
      image: postgres
      networks:
        - app-net

  networks:
    app-net:
      driver: bridge
  ```

  **Why:** User-defined bridges provide:
  - Automatic DNS resolution by service name (containers can reach `db` by name).
  - Better isolation (only containers on the same network can communicate).
  - Connect/disconnect without restarting containers.

### Network Types

| Driver    | Scope              | Use Case                                                                    |
| --------- | ------------------ | --------------------------------------------------------------------------- |
| `bridge`  | Single host        | Default for standalone containers and Compose                               |
| `host`    | Single host        | Maximum network performance (no NAT). Container shares host's network stack |
| `overlay` | Multi-host (Swarm) | Cross-node communication in Docker Swarm                                    |
| `none`    | Single host        | Complete network isolation                                                  |
| `macvlan` | Single host        | Container appears as physical device on network                             |

- Use `host` networking sparingly — only when NAT overhead is unacceptable (high-throughput proxies).

  ```yaml
  services:
    proxy:
      network_mode: host
  ```

### Internal Networks

- Use `internal: true` for backend networks that should not have internet access.

  ```yaml
  networks:
    backend:
      driver: bridge
      internal: true # No outbound internet
  ```

### DNS

- Custom DNS servers:

  ```yaml
  services:
    api:
      dns:
        - 8.8.8.8
        - 8.8.4.4
      dns_search:
        - example.com
  ```

## Logging

### Log Drivers

- Configure log rotation to prevent disk exhaustion. The default `json-file` driver has no size limit.

  ```yaml
  services:
    api:
      logging:
        driver: json-file
        options:
          max-size: '10m'
          max-file: '3'
  ```

- Set default log options in the Docker daemon config (`/etc/docker/daemon.json`):

  ```json
  {
    "log-driver": "json-file",
    "log-opts": {
      "max-size": "10m",
      "max-file": "3"
    }
  }
  ```

- Available log drivers: `json-file`, `local`, `syslog`, `journald`, `fluentd`, `awslogs`, `gcplogs`, `none`.

### Structured Logging

- Include labels and environment variables in log metadata for filtering:

  ```console
  $ docker run --log-opt labels=environment,service \
      --label environment=production \
      --label service=api \
      myapp
  ```

## Debugging Running Containers

### Inspect Logs

```console
# Follow logs in real time
$ docker logs -f <container>

# Last 100 lines
$ docker logs --tail 100 <container>

# Logs since a timestamp
$ docker logs --since 2024-01-01T00:00:00 <container>

# Compose logs for all services
$ docker compose logs -f

# Compose logs for specific service
$ docker compose logs -f api
```

### Execute Commands in Running Containers

```console
# Interactive shell
$ docker exec -it <container> sh

# Run a specific command
$ docker exec <container> cat /etc/hosts

# Run as specific user
$ docker exec -u root <container> cat /etc/shadow
```

### Inspect Container Configuration

```console
# Full container configuration
$ docker inspect <container>

# Check logging driver
$ docker inspect -f '{{.HostConfig.LogConfig.Type}}' <container>

# Check labels
$ docker inspect --format='{{json .Config.Labels}}' <container>

# Check network settings
$ docker inspect -f '{{json .NetworkSettings.Networks}}' <container>

# Check exposed ports
$ docker port <container>
```

### Inspect Resource Usage

```console
# Real-time stats
$ docker stats

# Stats for specific container
$ docker stats <container>

# One-shot stats (for scripting)
$ docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}"
```

### Debug Minimal/Distroless Images

- For images without a shell (scratch, distroless), use `docker debug` (Docker Desktop) to attach a debugging toolbox:

  ```console
  $ docker debug <container>
  ```

- Alternative: Create a debug sidecar that shares the network namespace:

  ```console
  $ docker run -it --network container:<target> --pid container:<target> nicolaka/netshoot
  ```

### Common Compose Debugging Commands

```console
# Validate compose file
$ docker compose config

# Show service status
$ docker compose ps

# Show running processes in services
$ docker compose top

# Pause/unpause a service
$ docker compose pause <service>
$ docker compose unpause <service>

# View events
$ docker compose events
```

## Volume Backup and Restore

- Backup a named volume:

  ```console
  $ docker run --rm -v myvolume:/data -v $(pwd):/backup alpine \
      tar czf /backup/myvolume-backup.tar.gz -C /data .
  ```

- Restore:

  ```console
  $ docker run --rm -v myvolume:/data -v $(pwd):/backup alpine \
      tar xzf /backup/myvolume-backup.tar.gz -C /data
  ```
