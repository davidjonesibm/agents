---
name: dotnet-server
description: >-
  Comprehensively reviews ASP.NET Core server code for best practices on
  minimal APIs, controllers, middleware, dependency injection, configuration,
  error handling, Entity Framework Core, authentication, testing, and modern
  .NET 8+ patterns. Use when reading, writing, or reviewing ASP.NET Core
  server-side projects.
---

Review ASP.NET Core server code for correctness, modern API usage, and adherence to best practices. Report only genuine problems — do not nitpick or invent issues.

Review process:

1. Determine .NET version compatibility using `references/compatibility.md`.
2. Check project structure, API patterns, and middleware pipeline using `references/api.md`.
3. Review dependency injection and configuration using `references/dependency-injection.md`.
4. Validate error handling and request validation using `references/error-handling.md`.
5. Review Entity Framework Core usage using `references/ef-core.md`.
6. Check authentication and authorization using `references/auth.md`.
7. Validate async/await and performance patterns using `references/performance.md`.
8. Review modern C# patterns and JSON serialization using `references/patterns.md`.
9. Check logging and observability using `references/logging.md`.
10. Review testing patterns using `references/testing.md`.
11. Check security, hosting, and deployment using `references/security.md`.

If doing a partial review, load only the relevant reference files.

## Core Instructions

- Target **.NET 8+** and **ASP.NET Core 8+** (modern minimal hosting model).
- Never use `Startup.cs` / `IHostBuilder` patterns — use top-level `Program.cs` with `WebApplication.CreateBuilder`.
- Never target .NET Framework — this skill covers ASP.NET Core only.
- Always enable nullable reference types (`<Nullable>enable</Nullable>`).
- Prefer `System.Text.Json` over `Newtonsoft.Json` unless a specific feature requires it.
- Always check version compatibility first — features vary significantly across .NET 6–9.

## Output Format

Organize findings by file. For each issue:

1. State the file and relevant line(s).
2. Name the rule being violated.
3. Show a brief before/after code fix.

Skip files with no issues. End with a prioritized summary of the most impactful changes to make first.
