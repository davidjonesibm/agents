# Agents & Skills Repository

This repository contains reusable AI agents and skills shared across projects.

## Structure

- `agents/` — Agent definitions (Copilot format, source of truth)
- `skills/` — Skill packages with full reference documentation
- `.claude/agents/` — Agent definitions (Claude Code format)
- `.claude/skills/` — Skill definitions (Claude Code format, reference `skills/` for detailed docs)

> **Why `agents/` and `skills/` at root?** Copilot auto-discovers from `.github/skills/` and
> `.github/agents/`. Since this repo installs globally via `install.mjs`, keeping sources outside
> `.github/` avoids loading duplicates when working in this repo.

## Reference Files

Skills reference detailed documentation stored in `skills/<name>/references/*.md`. When a skill instructs you to load a reference file, read it from that path.

## Available Agents

Agents are automatically available as subagents. They're defined in `.claude/agents/`:

| Agent               | Purpose                                                  |
| ------------------- | -------------------------------------------------------- |
| `software-engineer` | Full-stack implementation, testing, review, architecture |
| `product-owner`     | User stories, acceptance criteria                        |
| `foundry`           | Agent/skill infrastructure creation                      |

## Available Skills

Skills are available as `/skill-name` slash commands. They're defined in `.claude/skills/`:

| Skill                       | Domain                               |
| --------------------------- | ------------------------------------ |
| `react-pro`                 | React 19+ best practices             |
| `vue-pro`                   | Vue 3.5+ / Composition API           |
| `flutter-pro`               | Flutter/Dart mobile                  |
| `swiftui-pro`               | SwiftUI iOS (iOS 17+)                |
| `android-kotlin-pro`        | Android/Kotlin/Compose               |
| `fastify-pro`               | Fastify 5+ server                    |
| `dotnet-server`             | ASP.NET Core 8+                      |
| `golang-api`                | Go API development                   |
| `postgres-pro`              | PostgreSQL design & queries          |
| `docker-pro`                | Docker/Compose best practices        |
| `supabase-pro`              | Supabase (RLS, auth, edge functions) |
| `api-design-pro`            | REST API design principles           |
| `testcontainers-dotnet-pro` | Testcontainers for .NET              |
| `respawn-pro`               | Respawn database cleanup             |
| `workmaker-pro`             | User story / backlog generation      |
