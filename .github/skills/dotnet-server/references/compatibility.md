## Version Compatibility Check (Do This First)

**Before reviewing any code**, determine the project's .NET version and verify compatibility with this skill.

### Step 1: Detect the Target Framework

Search for all `.csproj` files in the project and read the `<TargetFramework>` (or `<TargetFrameworks>` for multi-targeting) element:

```xml
<!-- Examples -->
<TargetFramework>net9.0</TargetFramework>        <!-- .NET 9 ✅ -->
<TargetFramework>net8.0</TargetFramework>        <!-- .NET 8 ✅ -->
<TargetFramework>net7.0</TargetFramework>        <!-- .NET 7 ⚠️ — partial coverage -->
<TargetFramework>net6.0</TargetFramework>        <!-- .NET 6 ⚠️ — limited coverage -->
<TargetFramework>net48</TargetFramework>         <!-- .NET Framework ❌ STOP -->
<TargetFramework>net472</TargetFramework>        <!-- .NET Framework ❌ STOP -->
<TargetFramework>net461</TargetFramework>        <!-- .NET Framework ❌ STOP -->
```

Also check for a `global.json` file at the repository root — it may pin a specific SDK version that constrains available features:

```json
{
  "sdk": {
    "version": "8.0.100",
    "rollForward": "latestFeature"
  }
}
```

If `global.json` is present, note the pinned SDK version — it may be older than what the TFM implies if `rollForward` is set to `"disable"` or `"patch"`.

### Step 2: Check Project Settings

This skill assumes the following project settings are enabled. If they are missing or disabled, warn the user:

- **`<Nullable>enable</Nullable>`** — Nullable reference types. If disabled, all nullable-related advice (null guards, `?` annotations, nullable flow analysis) does not apply.
- **`<ImplicitUsings>enable</ImplicitUsings>`** — Implicit global usings. If disabled, code samples may require additional `using` statements.

### Step 3: Determine Compatibility

#### ❌ .NET Framework Detected — STOP

If the `<TargetFramework>` is any `net4*` TFM (e.g., `net48`, `net472`, `net461`, `net452`, `net40`) or uses the legacy `v4.*` format:

> **⛔ INCOMPATIBLE PROJECT: This skill targets ASP.NET Core on .NET 8+. The project targets .NET Framework (`{detected TFM}`), which uses an entirely different runtime, framework, and API surface (ASP.NET, not ASP.NET Core).**
>
> **None of the advice in this skill applies to .NET Framework projects.** Applying it will produce code that does not compile.
>
> **→ Use the `dotnet-migration` skill instead**, which covers assessment, incremental migration (strangler fig pattern), ASP.NET → ASP.NET Core, EF6 → EF Core, WCF → gRPC, and the .NET Upgrade Assistant.

**Do not proceed with this skill.** Redirect to `dotnet-migration` and stop.

#### ⚠️ .NET 5 or Below (Including .NET Core 3.1)

If the TFM is `net5.0`, `netcoreapp3.1`, `netcoreapp3.0`, `netcoreapp2.1`, or similar:

> **⚠️ WARNING: This project targets `{detected TFM}`. This skill targets .NET 8+ and many patterns described here do not exist in this version.** The following are NOT available:
>
> - Minimal APIs (`app.MapGet`, etc.)
> - Top-level `Program.cs` / `WebApplication.CreateBuilder`
> - `System.Text.Json` source generators
> - All features listed in the .NET 6–9 sections below
>
> Proceed with extreme caution. Verify each recommendation against the target version before applying.

#### ⚠️ .NET 6 — Partial Coverage

If the TFM is `net6.0`:

> **⚠️ NOTE: This project targets .NET 6. This skill targets .NET 8+.** The following features used in this skill are **NOT available** on .NET 6:
>
> - Rate limiting middleware, output caching, `TypedResults`, `RouteGroups`, `[AsParameters]` (require .NET 7+)
> - Keyed DI services, `AddAuthorizationBuilder()`, short-circuit routing, `[FromForm]` in minimal APIs, primary constructors, collection expressions, `TimeProvider`, Native AOT for APIs, Identity API endpoints (require .NET 8+)
> - `HybridCache`, `MapStaticAssets`, built-in OpenAPI document generation, `TypedResults.InternalServerError` (require .NET 9+)
>
> **Available on .NET 6:** Minimal APIs (basic `MapGet`/`MapPost`), `WebApplication.CreateBuilder`, top-level statements, `System.Text.Json` source generators.

#### ⚠️ .NET 7 — Partial Coverage

If the TFM is `net7.0`:

> **⚠️ NOTE: This project targets .NET 7. This skill targets .NET 8+.** The following features used in this skill are **NOT available** on .NET 7:
>
> - Keyed DI services, `AddAuthorizationBuilder()`, short-circuit routing (`ShortCircuit()`), `[FromForm]` in minimal APIs, primary constructors (C# 12), collection expressions, `TimeProvider`, Native AOT for APIs, Identity API endpoints, `ConfigurationManager` removal (require .NET 8+)
> - `HybridCache`, `MapStaticAssets`, built-in OpenAPI document generation, `TypedResults.InternalServerError` (require .NET 9+)
>
> **Available on .NET 7:** Rate limiting middleware, output caching, `TypedResults`, `RouteGroups`, `[AsParameters]`, plus all .NET 6 features.

#### ✅ .NET 8 — Fully Compatible

If the TFM is `net8.0`: This skill fully applies. Note that the following features require .NET 9+ and should not be recommended:

- `HybridCache` (use `IDistributedCache` or `IMemoryCache` instead)
- `MapStaticAssets` (use `UseStaticFiles` instead)
- Built-in OpenAPI document generation (use Swashbuckle or NSwag instead)
- `TypedResults.InternalServerError` (use `TypedResults.StatusCode(500)` or `Results.Problem()` instead)

#### ✅ .NET 9+ — Fully Compatible

If the TFM is `net9.0` or higher: This skill fully applies, including all .NET 9 features.

### Feature-to-Minimum-Version Quick Reference

| Feature                                  | Min Version | Alternative for Older Versions                |
| ---------------------------------------- | ----------- | --------------------------------------------- |
| `HybridCache`                            | .NET 9      | `IDistributedCache` + `IMemoryCache`          |
| `MapStaticAssets`                        | .NET 9      | `UseStaticFiles`                              |
| Built-in OpenAPI doc generation          | .NET 9      | Swashbuckle / NSwag                           |
| `TypedResults.InternalServerError`       | .NET 9      | `Results.Problem()`                           |
| Keyed DI (`[FromKeyedServices]`)         | .NET 8      | Named registrations via factory               |
| `AddAuthorizationBuilder()`              | .NET 8      | `AddAuthorization()` with options lambda      |
| Short-circuit routing (`ShortCircuit()`) | .NET 8      | Terminal middleware                           |
| `[FromForm]` in minimal APIs             | .NET 8      | Manual `HttpContext.Request.Form`             |
| Primary constructors (C# 12)             | .NET 8      | Traditional constructors                      |
| Collection expressions (`[1, 2, 3]`)     | .NET 8      | `new[] { 1, 2, 3 }` / `new List<int> { }`     |
| `TimeProvider`                           | .NET 8      | `IClock` abstraction / `DateTime.UtcNow`      |
| Native AOT for APIs                      | .NET 8      | Standard JIT compilation                      |
| Identity API endpoints                   | .NET 8      | Manual Identity setup                         |
| Rate limiting middleware                 | .NET 7      | AspNetCoreRateLimit NuGet package             |
| Output caching                           | .NET 7      | Response caching                              |
| `TypedResults`                           | .NET 7      | `Results` (untyped)                           |
| Route groups (`MapGroup`)                | .NET 7      | Repeat prefix on each route                   |
| `[AsParameters]`                         | .NET 7      | Individual `[FromQuery]`/`[FromRoute]` params |
| Minimal APIs (`MapGet`, etc.)            | .NET 6      | Controllers only                              |
| `WebApplication.CreateBuilder`           | .NET 6      | `Host.CreateDefaultBuilder` + `Startup.cs`    |
| Top-level statements                     | .NET 6      | `Main` method                                 |
| `System.Text.Json` source generators     | .NET 6      | Reflection-based `System.Text.Json`           |

### Applying the Check

After determining compatibility:

1. **If .NET Framework** → Stop. Redirect to `dotnet-migration` skill.
2. **If .NET 5 or below** → Warn prominently. Proceed only if user confirms; prefix every recommendation with a version caveat.
3. **If .NET 6 or 7** → Proceed with the review, but **annotate each recommendation** that uses a feature above the project's version. Suggest the version-appropriate alternative from the table above.
4. **If .NET 8+** → Proceed normally. If .NET 8 (not 9), avoid recommending .NET 9-only features.
