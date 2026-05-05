# CI/CD Configuration

Running Testcontainers in GitHub Actions, Azure Pipelines, GitLab CI/CD, and Bitbucket Pipelines.

## Requirements

Any CI/CD environment needs only:

- Docker installed and running (Docker daemon accessible)
- `dotnet test` (or equivalent) to execute tests

Testcontainers auto-detects the Docker host; no code changes are needed between local and CI.

## GitHub Actions

Docker is pre-installed on all GitHub-hosted runners (`ubuntu-latest`, `windows-latest`, `macos-latest`). No extra configuration needed:

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-dotnet@v4
        with:
          dotnet-version: '8.x'
      - run: dotnet test --no-build --verbosity normal
```

## Azure Pipelines

Microsoft-hosted agents include Docker. Linux agents support Linux containers; Windows agents support only Windows containers.

```yaml
# azure-pipelines.yml
pool:
  vmImage: 'ubuntu-latest' # or 'windows-latest' for Windows containers

steps:
  - task: UseDotNet@2
    inputs:
      version: '8.x'
  - script: dotnet test
    displayName: 'Run integration tests'
```

> **Note:** Windows agents run the Docker Windows engine. Do not use Linux container images on Windows agents — they are incompatible.

## GitLab CI/CD

GitLab requires Docker-in-Docker (DinD). Set `DOCKER_HOST` to point to the DinD socket:

```yaml
# .gitlab-ci.yml
services:
  - docker:dind

variables:
  DOCKER_HOST: tcp://docker:2375

test:
  image: mcr.microsoft.com/dotnet/sdk:8.0
  script:
    - dotnet test
```

## Bitbucket Pipelines

Bitbucket Pipelines does not support the Ryuk resource reaper. Disable it with the environment variable:

```yaml
# bitbucket-pipelines.yml
image: mcr.microsoft.com/dotnet/sdk:8.0

options:
  docker: true

pipelines:
  default:
    - step:
        script:
          # Ryuk is not supported in Bitbucket Pipelines
          - export TESTCONTAINERS_RYUK_DISABLED=true
          - dotnet test
        services:
          - docker
```

## Environment Variables

| Variable                              | Purpose                          | Example                                           |
| ------------------------------------- | -------------------------------- | ------------------------------------------------- |
| `DOCKER_HOST`                         | Override Docker daemon socket    | `tcp://docker:2375`                               |
| `TESTCONTAINERS_RYUK_DISABLED`        | Disable Resource Reaper          | `true`                                            |
| `TESTCONTAINERS_RYUK_CONTAINER_IMAGE` | Use Ryuk from private registry   | `registry.example.com/testcontainers/ryuk:0.14.0` |
| `TESTCONTAINERS_HOST_OVERRIDE`        | Override resolved container host | `docker-host.internal`                            |

## Private Docker Registry

Testcontainers reads Docker's `~/.docker/config.json` credentials automatically. No extra configuration is needed for registries that are already authenticated.

For Ryuk in a private registry, mirror the exact image digest (multi-architecture):

```shell
# BAD — docker pull/tag/push loses multi-arch manifest
docker pull testcontainers/ryuk:0.14.0
docker tag testcontainers/ryuk:0.14.0 registry.example.com/testcontainers/ryuk:0.14.0
docker push registry.example.com/testcontainers/ryuk:0.14.0

# GOOD — skopeo preserves multi-arch manifest
skopeo copy --all --preserve-digests \
  docker://docker.io/testcontainers/ryuk@sha256:7c1a8a9a47c780ed0f983770a662f80deb115d95cce3e2daa3d12115b8cd28f0 \
  docker://registry.example.com/testcontainers/ryuk:0.14.0
```

## Apple Silicon (M-series) and SQL Server

SQL Server requires `linux/amd64`. On Apple Silicon:

1. Use Docker Desktop for macOS 4.16+.
2. Enable the Virtualization Framework.
3. Install Rosetta 2: `softwareupdate --install-rosetta`.

```csharp
// Explicit platform targeting for SQL Server on Apple Silicon
_ = new ContainerBuilder()
    .WithImage(new DockerImage("mcr.microsoft.com/mssql/server:2022-CU14-ubuntu-22.04",
        new Platform("linux/amd64")));
```
