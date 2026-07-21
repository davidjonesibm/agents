---
name: dotnet-migration
description: >-
  Guides migration from .NET Framework to modern .NET (.NET 8+). Covers assessment,
  incremental migration (strangler fig), ASP.NET → ASP.NET Core, EF6 → EF Core,
  WCF → gRPC, configuration migration, dependency compatibility, common blockers,
  .NET Upgrade Assistant, YARP reverse proxy, and testing strategy. Use when planning,
  executing, or reviewing a .NET Framework modernization effort.
---

Guides the migration of applications from .NET Framework to .NET 8+.

## When to Use This Skill

- Planning or scoping a .NET Framework → .NET 8+ migration
- Reviewing migration PRs for correctness and completeness
- Troubleshooting migration blockers (unsupported APIs, NuGet incompatibilities)
- Choosing between incremental vs. in-place migration strategies
- Migrating ASP.NET MVC/Web API, EF6, WCF, Windows Services, or configuration systems

## Core Instructions

- Target **.NET 8** (current LTS) or later.
- Always prefer **incremental migration** for large production apps. Reserve in-place rewrites for small, well-understood apps.
- Never assume a NuGet package is compatible — verify with the .NET Portability Analyzer or `dotnet-outdated`.
- EF6 and EF Core can run **side-by-side** in the same application during migration.
- EF Core migrations are **not compatible** with EF6 Code First migrations — plan for a fresh migration baseline.
- The .NET Upgrade Assistant is **officially deprecated** as of 2026 — prefer the GitHub Copilot modernization agent in VS 2022 17.14.16+ or VS 2026, but the CLI tool still works for automated analysis.

---

## 0. Version Compatibility Check (Run First)

**Before doing any migration work, run this triage to determine what kind of migration (if any) is needed and which sections of this skill apply.**

### 0.1 Detect the Source Version

Search all `.csproj` files in the workspace for `<TargetFramework>` (single) and `<TargetFrameworks>` (multi-target) elements. Also check for `<TargetFrameworkVersion>` in legacy non-SDK-style project files.

```bash
# Find all .csproj files and extract target framework declarations
find . -name '*.csproj' -exec grep -Hn '<TargetFramework' {} \;
```

Classify what you find:

| Pattern in `.csproj`                                                                        | Classification                 | Migration Type                                                                                                                                                                                                       |
| ------------------------------------------------------------------------------------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `<TargetFrameworkVersion>v4.8</TargetFrameworkVersion>` (or `v4.7.2`, `v4.6.1`, any `v4.x`) | **.NET Framework**             | Full migration — this skill fully applies                                                                                                                                                                            |
| `<TargetFramework>net48</TargetFramework>` (or `net472`, `net461`, etc.)                    | **.NET Framework** (SDK-style) | Full migration — this skill fully applies                                                                                                                                                                            |
| `<TargetFramework>netcoreapp3.1</TargetFramework>`                                          | **.NET Core 3.1** (EOL)        | Lighter migration — skip §3 (ASP.NET), §6 (WCF), §8 (System.Web blockers) unless present                                                                                                                             |
| `<TargetFramework>net5.0</TargetFramework>` or `net6.0`                                     | **Modern .NET** (EOL)          | Lighter migration — mostly a TFM bump, NuGet updates, and breaking-change review                                                                                                                                     |
| `<TargetFramework>net7.0</TargetFramework>` or `net8.0`                                     | **Already on modern .NET**     | **This is an upgrade, not a migration.** Most of this skill does not apply. **Redirect to the `dotnet-server` skill** for ASP.NET Core best practices instead.                                                       |
| `<TargetFramework>net9.0</TargetFramework>` or later                                        | **Current / preview .NET**     | Migration skill not needed. Use `dotnet-server` skill.                                                                                                                                                               |
| `<TargetFramework>netstandard2.0</TargetFramework>` or `netstandard2.1`                     | **.NET Standard library**      | Different path — these libraries are already cross-compatible. Focus on retargeting to `net8.0` (or multi-target) and updating APIs that have better modern equivalents. §9 (Dependency Migration) is most relevant. |

**If multiple projects target different frameworks** (e.g., a `.NET Framework` web app depending on `.NET Standard` libraries), classify based on the **top-level application project** — that determines the migration scope.

### 0.2 Detect the Target Version

- **Default assumption**: .NET 8 (current LTS).
- If the user explicitly specifies .NET 9 or later, use that instead.
- If `global.json` exists, check its `sdk.version` — it may indicate the intended target.
- If a `Directory.Build.props` exists, check for a centrally-defined `<TargetFramework>`.

### 0.3 Early-Exit: Already on Modern .NET

If **all** application projects already target `net6.0` or later:

> ⚠️ **This project is already on modern .NET.** This migration skill is designed for .NET Framework → .NET 8+ migrations and is largely not applicable. Use the **`dotnet-server`** skill instead for ASP.NET Core best practices, performance tuning, and modern .NET patterns. If you only need to bump from `net6.0`/`net7.0` → `net8.0`, perform a standard TFM update, review the [Breaking Changes](https://learn.microsoft.com/en-us/dotnet/core/compatibility/8.0) doc, and update NuGet packages.

**Stop here and switch skills.** Do not proceed with the rest of this migration guide.

### 0.4 .NET Framework Indicator Checks

Even if `.csproj` parsing is inconclusive (e.g., legacy `.csproj` format is hard to read), these files are strong indicators of .NET Framework:

| File / Pattern                                                                     | What It Indicates                                                                                    |
| ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `packages.config`                                                                  | NuGet packages managed via .NET Framework tooling (not `PackageReference`) — confirms .NET Framework |
| `web.config` (in project root)                                                     | ASP.NET Framework hosting configuration                                                              |
| `Global.asax` / `Global.asax.cs`                                                   | ASP.NET Framework application lifecycle — §3 applies                                                 |
| `App.config`                                                                       | .NET Framework configuration system — §4 applies                                                     |
| `.sln` with `ProjectTypeGuids` containing `{349c5851-65df-11da-9384-00065b846f21}` | ASP.NET Web Application project                                                                      |
| `*.vbproj` alongside `*.csproj`                                                    | Mixed-language solution — adds complexity to migration planning                                      |

### 0.5 Blocker Detection

Scan the codebase for these patterns **before** starting migration work. Each one maps to specific skill sections and adds significant scope:

| What to Search For            | How to Find It                                                                                                      | Impact                                                                                                                                                                            | Relevant Section |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| **`System.Web` references**   | `grep -rn 'using System.Web' --include='*.cs'` and check `.csproj` for `<Reference Include="System.Web"`            | Heavy migration — requires System.Web Adapters (§2.4) or full rewrite of HTTP pipeline code                                                                                       | §2, §3           |
| **WCF service references**    | Look for `*.svc` files, `<system.serviceModel>` in config, `[ServiceContract]` attributes, `Reference.svcmap` files | WCF migration required — evaluate CoreWCF vs gRPC vs REST                                                                                                                         | §6               |
| **EDMX files** (`.edmx`)      | `find . -name '*.edmx'`                                                                                             | EF6 Database First → EF Core migration (more complex than Code First)                                                                                                             | §5               |
| **EF6 Code First migrations** | Look for `Migrations/` folder with `DbMigration` subclasses                                                         | EF6 → EF Core migration needed, fresh migration baseline required                                                                                                                 | §5               |
| **`BinaryFormatter` usage**   | `grep -rn 'BinaryFormatter' --include='*.cs'`                                                                       | **Security concern** — `BinaryFormatter` is disabled by default in .NET 8+ (SYSLIB0011). Must replace with `System.Text.Json`, `MessagePack`, or `protobuf-net` before migration. | §8               |
| **`AppDomain` usage**         | `grep -rn 'AppDomain' --include='*.cs'`                                                                             | `AppDomain.CreateDomain` is not supported in .NET 8+. Requires redesign using `AssemblyLoadContext` or process isolation.                                                         | §8               |
| **`Remoting` usage**          | `grep -rn 'System.Runtime.Remoting\|MarshalByRefObject' --include='*.cs'`                                           | .NET Remoting not supported — must replace with gRPC, named pipes, or HTTP.                                                                                                       | §8               |
| **COM / P/Invoke**            | `grep -rn '\[DllImport\]\|[ComImport]' --include='*.cs'`                                                            | May work on Windows only — assess if cross-platform is a goal.                                                                                                                    | §8               |
| **Windows Services**          | Look for classes inheriting `ServiceBase`, `*.Designer.cs` with `ServiceProcessInstaller`                           | Must migrate to Worker Service / `BackgroundService` pattern.                                                                                                                     | §7               |

### 0.6 Solution Structure Assessment

Before planning the migration order:

1. **Find the `.sln` file** — `find . -name '*.sln'` — and parse it to understand the full project graph.
2. **Count projects** — solutions with 10+ projects need a phased migration plan.
3. **Identify shared libraries** — projects referenced by multiple other projects must be migrated first (leaf-first order per §1.2).
4. **Check for multi-target libraries** — projects already targeting `netstandard2.0` can be consumed by both Framework and Core during migration, making them low-priority for migration.
5. **Look for test projects** — ensure test projects are identified so they can be migrated alongside their corresponding source projects.

### 0.7 Triage: Map Source Version to Relevant Sections

Based on what you found above, use this table to skip irrelevant sections and focus effort:

| Source Classification               | Relevant Sections                                                                                                     | Skip                                                                                                                             |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **.NET Framework** (full migration) | All sections (§1–§13)                                                                                                 | —                                                                                                                                |
| **.NET Framework with WCF**         | All sections, prioritize §6                                                                                           | —                                                                                                                                |
| **.NET Framework with EDMX/EF6**    | All sections, prioritize §5                                                                                           | —                                                                                                                                |
| **.NET Core 3.1**                   | §1 (planning), §4 (config if needed), §5 (EF if applicable), §8 (blockers), §9 (deps), §11 (testing), §13 (checklist) | §2 (YARP proxy usually unnecessary), §3 (already ASP.NET Core), §6 (WCF already gone), §7 (already Worker Service if applicable) |
| **.NET 5.0 / 6.0**                  | §1 (planning), §9 (deps), §11 (testing), §13 (checklist)                                                              | §2, §3, §4, §5, §6, §7, §8 (unless specific blockers detected above)                                                             |
| **.NET 7.0+ / 8.0+**                | **None — redirect to `dotnet-server` skill**                                                                          | All                                                                                                                              |
| **.NET Standard library**           | §1 (planning), §9 (deps), §11 (testing)                                                                               | §2, §3, §4, §6, §7                                                                                                               |

> **After completing this triage, state your findings clearly to the user**: what source version was detected, what the target is, which blockers were found, and which sections of this guide you will follow. Then proceed to §1.

---

## 1. Migration Assessment and Planning

### 1.1 Decision Framework

Answer these questions to choose your migration path:

| Question                                     | → Incremental | → In-Place |
| -------------------------------------------- | ------------- | ---------- |
| Must stay in production during migration?    | Yes           | —          |
| Application is large with many dependencies? | Yes           | —          |
| Heavy use of `System.Web`?                   | Yes           | —          |
| Small app with minimal dependencies?         | —             | Yes        |
| Can afford downtime for a rewrite?           | —             | Yes        |

### 1.2 Assessment Steps

1. **Inventory dependencies** — List all NuGet packages, `System.Web` usages, COM references, and P/Invoke calls.
2. **Run the .NET Portability Analyzer** — `dotnet tool install -g apiport` then `apiport analyze -f <assembly>`.
3. **Run the Upgrade Assistant analysis** — `upgrade-assistant analyze <solution.sln>` to get a compatibility report.
4. **Classify each dependency**:
   - Has a .NET 8+ compatible version → upgrade
   - Has a .NET Standard 2.0 version → use as bridge
   - No compatible version → find alternative or isolate behind an interface
5. **Identify Windows-only APIs** — Registry, WMI, COM+, AppDomain, Remoting (see §8).
6. **Map the migration order** — Libraries must be upgraded in **postorder depth-first** order (leaf dependencies first).

### 1.3 Risk Factors to Assess

- Session state management differences (ASP.NET Framework vs. ASP.NET Core have fundamentally different session APIs)
- Authentication model differences (Forms Auth / Windows Auth → ASP.NET Core Identity / cookie auth)
- Logging and monitoring continuity during side-by-side operation
- Caching strategy migration (in-memory, distributed, output caching)
- Cross-cutting concerns spanning both old and new apps during migration

---

## 2. Incremental Migration (Strangler Fig Pattern)

### 2.1 Architecture Overview

The strangler fig pattern places a new ASP.NET Core app **in front of** the existing .NET Framework app. The new app acts as a reverse proxy (using YARP), forwarding unmigrated routes to the old app while serving migrated routes directly.

```
┌─────────────┐     migrated     ┌─────────────────┐
│   Browser   │ ───────────────→ │  ASP.NET Core   │
│             │                  │  (new app)       │
└─────────────┘                  │                  │
                                 │  YARP proxy      │
                                 │  ──────────────→ │ ┌─────────────────┐
                                 │  unmigrated      │ │  ASP.NET Fwk    │
                                 │  routes          │ │  (old app)       │
                                 └─────────────────┘ └─────────────────┘
```

### 2.2 Setup Steps

1. **Create a new ASP.NET Core 8 project** alongside the existing Framework app.
2. **Add YARP** — `dotnet add package Yarp.ReverseProxy`.
3. **Configure YARP** to forward all traffic to the Framework app by default.
4. **Migrate one route/controller at a time** to ASP.NET Core, removing it from the YARP fallback.
5. **Deploy both apps** — the Core app receives all traffic, proxying unmigrated endpoints.

### 2.3 YARP Configuration for Migration

```json
// appsettings.json
{
  "ReverseProxy": {
    "Routes": {
      "fallback": {
        "ClusterId": "legacyApp",
        "Match": {
          "Path": "{**catch-all}"
        }
      }
    },
    "Clusters": {
      "legacyApp": {
        "Destinations": {
          "primary": {
            "Address": "https://localhost:44300/"
          }
        }
      }
    }
  }
}
```

```csharp
// Program.cs (ASP.NET Core 8)
var builder = WebApplication.CreateBuilder(args);
builder.Services.AddReverseProxy()
    .LoadFromConfig(builder.Configuration.GetSection("ReverseProxy"));

var app = builder.Build();

// Migrated routes go BEFORE the proxy fallback
app.MapControllers(); // migrated controllers
app.MapReverseProxy(); // everything else → legacy app

app.Run();
```

### 2.4 System.Web Adapters

For code that references `System.Web` types (especially `HttpContext`), use the **System.Web Adapters** library to share code between Framework and Core during migration.

```bash
# In shared libraries targeting .NET Standard 2.0
dotnet add package Microsoft.AspNetCore.SystemWebAdapters

# In the ASP.NET Core app
dotnet add package Microsoft.AspNetCore.SystemWebAdapters.CoreServices

# In the ASP.NET Framework app
dotnet add package Microsoft.AspNetCore.SystemWebAdapters.FrameworkServices
```

Key capabilities:

- Adapted libraries can run on **both** Framework and Core simultaneously
- `HttpContext.Current` supported via `AddStaticUserAccessors()`
- Shared session state between Framework and Core apps
- Remote authentication delegation from Core to Framework

### 2.5 Migration Sequence

1. Set up the proxy infrastructure (YARP + System.Web Adapters)
2. Remediate technical debt in the Framework app (update NuGet packages, remove dead code)
3. Identify and address cross-cutting concerns (auth, session, logging)
4. Upgrade supporting libraries to target .NET Standard 2.0 or multi-target
5. Migrate routes one at a time, starting with the simplest/lowest-risk
6. Validate each migrated route before proceeding to the next
7. Once all routes are migrated, decommission the Framework app and YARP proxy

---

## 3. ASP.NET MVC/Web API → ASP.NET Core

### 3.1 Project File Migration

```xml
<!-- Before: .NET Framework .csproj (verbose) -->
<Project ToolsVersion="15.0">
  <Import Project="$(MSBuildExtensionsPath)\..." />
  <PropertyGroup>
    <TargetFrameworkVersion>v4.8</TargetFrameworkVersion>
  </PropertyGroup>
  <ItemGroup>
    <Reference Include="System.Web" />
    <Reference Include="System.Web.Mvc" />
  </ItemGroup>
  <!-- hundreds of lines... -->
</Project>

<!-- After: .NET 8 SDK-style .csproj -->
<Project Sdk="Microsoft.NET.Sdk.Web">
  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
  </PropertyGroup>
</Project>
```

### 3.2 Startup / Hosting Migration

```csharp
// Before: Global.asax.cs + App_Start/
public class MvcApplication : System.Web.HttpApplication
{
    protected void Application_Start()
    {
        AreaRegistration.RegisterAllAreas();
        FilterConfig.RegisterGlobalFilters(GlobalFilters.Filters);
        RouteConfig.RegisterRoutes(RouteTable.Routes);
        BundleConfig.RegisterBundles(BundleTable.Bundles);
    }
}

// After: Program.cs (minimal hosting, .NET 8)
var builder = WebApplication.CreateBuilder(args);
builder.Services.AddControllersWithViews();

var app = builder.Build();
app.UseHttpsRedirection();
app.UseStaticFiles();
app.UseRouting();
app.UseAuthorization();
app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Home}/{action=Index}/{id?}");
app.Run();
```

### 3.3 Controller Migration

```csharp
// Before: ASP.NET MVC/Web API
using System.Web.Mvc;           // MVC
using System.Web.Http;          // Web API

public class ProductsController : ApiController  // Web API
{
    public IHttpActionResult Get(int id)
    {
        var product = _repo.Find(id);
        if (product == null) return NotFound();
        return Ok(product);
    }
}

// After: ASP.NET Core (unified)
using Microsoft.AspNetCore.Mvc;

[ApiController]
[Route("api/[controller]")]
public class ProductsController : ControllerBase
{
    [HttpGet("{id}")]
    public IActionResult Get(int id)
    {
        var product = _repo.Find(id);
        if (product == null) return NotFound();
        return Ok(product);
    }
}
```

### 3.4 Key Namespace Changes

| .NET Framework                            | ASP.NET Core                                  |
| ----------------------------------------- | --------------------------------------------- |
| `System.Web.Mvc`                          | `Microsoft.AspNetCore.Mvc`                    |
| `System.Web.Http`                         | `Microsoft.AspNetCore.Mvc` (unified)          |
| `System.Web.HttpContext`                  | `Microsoft.AspNetCore.Http.HttpContext`       |
| `System.Web.Routing`                      | `Microsoft.AspNetCore.Routing`                |
| `System.Web.Security.FormsAuthentication` | `Microsoft.AspNetCore.Authentication.Cookies` |

### 3.5 HTTP Modules → Middleware

```csharp
// Before: HTTP Module
public class TimingModule : IHttpModule
{
    public void Init(HttpApplication context)
    {
        context.BeginRequest += (s, e) => { /* start timer */ };
        context.EndRequest += (s, e) => { /* log elapsed */ };
    }
    public void Dispose() { }
}

// After: Middleware
public class TimingMiddleware
{
    private readonly RequestDelegate _next;
    public TimingMiddleware(RequestDelegate next) => _next = next;

    public async Task InvokeAsync(HttpContext context)
    {
        var sw = Stopwatch.StartNew();
        await _next(context);
        sw.Stop();
        // log sw.Elapsed
    }
}

// Registration in Program.cs:
app.UseMiddleware<TimingMiddleware>();
```

### 3.6 HTTP Handlers → Minimal APIs or Controllers

```csharp
// Before: IHttpHandler
public class HealthHandler : IHttpHandler
{
    public bool IsReusable => true;
    public void ProcessRequest(HttpContext context)
    {
        context.Response.Write("OK");
    }
}

// After: Minimal API
app.MapGet("/health", () => "OK");
```

---

## 4. Configuration System Migration

### 4.1 web.config / app.config → appsettings.json

```xml
<!-- Before: web.config -->
<configuration>
  <appSettings>
    <add key="ApiBaseUrl" value="https://api.example.com" />
    <add key="MaxRetries" value="3" />
  </appSettings>
  <connectionStrings>
    <add name="DefaultConnection"
         connectionString="Server=.;Database=MyDb;Trusted_Connection=True;"
         providerName="System.Data.SqlClient" />
  </connectionStrings>
</configuration>
```

```json
// After: appsettings.json
{
  "ApiBaseUrl": "https://api.example.com",
  "MaxRetries": 3,
  "ConnectionStrings": {
    "DefaultConnection": "Server=.;Database=MyDb;Trusted_Connection=True;"
  }
}
```

### 4.2 ConfigurationManager → IConfiguration / Options Pattern

```csharp
// Before
var url = ConfigurationManager.AppSettings["ApiBaseUrl"];
var connStr = ConfigurationManager.ConnectionStrings["DefaultConnection"].ConnectionString;

// After: Options pattern (preferred)
public class ApiSettings
{
    public string ApiBaseUrl { get; set; } = "";
    public int MaxRetries { get; set; }
}

// Program.cs
builder.Services.Configure<ApiSettings>(builder.Configuration);

// Usage via DI
public class MyService
{
    private readonly ApiSettings _settings;
    public MyService(IOptions<ApiSettings> options) => _settings = options.Value;
}
```

### 4.3 Environment-Specific Configuration

```
// .NET 8 supports layered configuration automatically:
appsettings.json                    // base
appsettings.Development.json        // overrides for dev
appsettings.Production.json         // overrides for prod
Environment variables               // highest priority
```

This replaces the `web.config` transformation approach (`web.Debug.config`, `web.Release.config`).

---

## 5. Entity Framework 6 → EF Core

### 5.1 Migration Strategy

EF Core is a **total rewrite** of Entity Framework. There is no direct upgrade path. Key approach:

1. **Migrate to .NET 8 first** while keeping EF6 — EF6 supports modern .NET.
2. Port EF6 code to EF Core **incrementally** — both can run side-by-side.
3. Plan for a fresh migration baseline — EF Core migrations are incompatible with EF6 Code First migrations.

### 5.2 Namespace and API Changes

```csharp
// Before (EF6)
using System.Data.Entity;
using System.Data.Entity.ModelConfiguration;

public class AppDbContext : DbContext
{
    public AppDbContext() : base("DefaultConnection") { }
    public DbSet<Product> Products { get; set; }

    protected override void OnModelCreating(DbModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Product>().HasRequired(p => p.Category);
    }
}

// After (EF Core 8)
using Microsoft.EntityFrameworkCore;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }
    public DbSet<Product> Products { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Product>()
            .HasOne(p => p.Category)
            .WithMany()
            .IsRequired();
    }
}
```

### 5.3 Key Differences

| EF6                                        | EF Core 8                                                           |
| ------------------------------------------ | ------------------------------------------------------------------- |
| `DbModelBuilder`                           | `ModelBuilder`                                                      |
| `DbEntityEntry<T>`                         | `EntityEntry<T>`                                                    |
| `Database.Log`                             | `Microsoft.Extensions.Logging` or `DbContextOptionsBuilder.LogTo()` |
| `HasRequired` / `HasOptional`              | `HasOne().IsRequired()` / `HasOne()`                                |
| EDMX visual designer                       | Not supported — use EF Core Power Tools for visualization           |
| `ObjectContext`                            | Not supported — use `DbContext` only                                |
| Built-in validation (`IValidatableObject`) | Not built-in — use `DataAnnotations` or FluentValidation            |

### 5.4 EDMX Migration

If using EDMX (Entity Data Model XML), you must switch to code-based configuration:

1. **Reverse-engineer** the database: `dotnet ef dbcontext scaffold "ConnectionString" Microsoft.EntityFrameworkCore.SqlServer`
2. Review and customize the generated entities and `DbContext`.
3. Create an initial EF Core migration from the current database state.

### 5.5 Incremental EF Migration

```csharp
// Both EF6 and EF Core can run side-by-side in the same app:
builder.Services.AddDbContext<LegacyDbContext>(options =>  // EF6 on .NET
    options.UseSqlServer(connectionString));
builder.Services.AddDbContext<ModernDbContext>(options =>   // EF Core
    options.UseSqlServer(connectionString));
```

Apply final EF6 migration, then create initial EF Core migration matching the existing schema. Track history in EF Core going forward.

---

## 6. WCF → gRPC / REST / CoreWCF

### 6.1 Decision Matrix

| Scenario                                | Recommended Target                                     |
| --------------------------------------- | ------------------------------------------------------ |
| Internal service-to-service RPC         | **gRPC** (high performance, contract-first, streaming) |
| Public-facing API                       | **REST** (ASP.NET Core Web API)                        |
| Must preserve WCF contracts quickly     | **CoreWCF** (drop-in WCF server on .NET 8)             |
| Complex message patterns (duplex, etc.) | **gRPC** bidirectional streaming or **SignalR**        |

### 6.2 CoreWCF Quick Migration

```bash
dotnet add package CoreWCF.Primitives
dotnet add package CoreWCF.Http
```

```csharp
// Existing WCF service contract works with CoreWCF
[ServiceContract]
public interface IGreetingService
{
    [OperationContract]
    string Greet(string name);
}

// Program.cs
var builder = WebApplication.CreateBuilder(args);
builder.Services.AddServiceModelServices();

var app = builder.Build();
app.UseServiceModel(serviceBuilder =>
{
    serviceBuilder.AddService<GreetingService>();
    serviceBuilder.AddServiceEndpoint<GreetingService, IGreetingService>(
        new BasicHttpBinding(), "/GreetingService.svc");
});
app.Run();
```

### 6.3 WCF → gRPC Migration

```protobuf
// greeting.proto
syntax = "proto3";
package greet;

service Greeter {
  rpc SayHello (HelloRequest) returns (HelloReply);
}

message HelloRequest { string name = 1; }
message HelloReply { string message = 1; }
```

```csharp
// GreeterService.cs
public class GreeterService : Greeter.GreeterBase
{
    public override Task<HelloReply> SayHello(HelloRequest request,
        ServerCallContext context)
    {
        return Task.FromResult(new HelloReply
        {
            Message = $"Hello, {request.Name}"
        });
    }
}
```

---

## 7. Windows Services → Worker Services

```csharp
// Before: Windows Service (ServiceBase)
public class MyWindowsService : ServiceBase
{
    protected override void OnStart(string[] args) { /* start work */ }
    protected override void OnStop() { /* stop work */ }
}

// After: Worker Service (.NET 8)
var builder = Host.CreateApplicationBuilder(args);
builder.Services.AddHostedService<MyWorker>();

// For Windows Service deployment:
builder.Services.AddWindowsService(options =>
    options.ServiceName = "My Worker Service");

var host = builder.Build();
host.Run();

public class MyWorker : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            // do work
            await Task.Delay(TimeSpan.FromMinutes(1), stoppingToken);
        }
    }
}
```

Install as Windows Service: `sc.exe create "MyService" binPath="C:\app\MyWorker.exe"`

---

## 8. Common Blockers and Windows-Only API Alternatives

### 8.1 Unsupported Technologies — No Replacement Path

| Technology                                | Status                                 | Alternative                                                                             |
| ----------------------------------------- | -------------------------------------- | --------------------------------------------------------------------------------------- |
| **AppDomains** (`AppDomain.CreateDomain`) | Throws `PlatformNotSupportedException` | Separate processes or containers; `AssemblyLoadContext` for assembly isolation          |
| **Remoting** (.NET Remoting)              | Not supported                          | `System.IO.Pipes`, `MemoryMappedFile` (IPC); gRPC/HTTP (cross-machine); `StreamJsonRpc` |
| **Code Access Security (CAS)**            | Not supported                          | OS-level isolation: containers, user accounts, virtualization                           |
| **Security Transparency**                 | Not supported                          | Same as CAS                                                                             |
| **System.EnterpriseServices** (COM+)      | Not supported                          | Rewrite transaction/component logic using modern patterns                               |
| **Windows Workflow Foundation (WF)**      | Not supported                          | [CoreWF](https://github.com/UiPath/corewf) (community) or Elsa Workflows                |
| **ASP.NET Web Forms**                     | Not supported                          | Migrate to Blazor, Razor Pages, or MVC                                                  |
| **XSLT Script Blocks**                    | Not supported                          | Rewrite transforms without script blocks                                                |
| **Delegate `BeginInvoke`/`EndInvoke`**    | Throws `PlatformNotSupportedException` | Use `Task.Run()` and `async`/`await`                                                    |

### 8.2 Windows-Only APIs — Available via Compatibility Pack

```bash
dotnet add package Microsoft.Windows.Compatibility
```

| API Area                 | Package / Namespace                      | Notes                                                        |
| ------------------------ | ---------------------------------------- | ------------------------------------------------------------ |
| **Registry**             | `Microsoft.Win32.Registry`               | Windows-only; use `IConfiguration` for cross-platform config |
| **WMI**                  | `System.Management`                      | Windows-only; consider platform checks                       |
| **EventLog**             | `System.Diagnostics.EventLog`            | Windows-only; prefer `ILogger` + Serilog/OpenTelemetry       |
| **Performance Counters** | `System.Diagnostics`                     | Use `System.Diagnostics.Metrics` (cross-platform)            |
| **Drawing**              | `System.Drawing.Common`                  | Windows-only on .NET 8+; use SkiaSharp or ImageSharp         |
| **ODBC/OleDb**           | `System.Data.Odbc` / `System.Data.OleDb` | Windows-only; prefer `Microsoft.Data.SqlClient`              |
| **DirectoryServices**    | `System.DirectoryServices`               | Windows-only; use `Novell.Directory.Ldap` for cross-platform |

### 8.3 Binary Serialization

```csharp
// Before: BinaryFormatter (DANGEROUS — removed in .NET 9, disabled by default in .NET 8)
var formatter = new BinaryFormatter();
formatter.Serialize(stream, obj);

// After: Use System.Text.Json or MessagePack
var json = JsonSerializer.Serialize(obj);
// or
var bytes = MessagePackSerializer.Serialize(obj);
```

> **Critical:** `BinaryFormatter` is a security vulnerability (deserialization attacks). It is disabled by default in .NET 8 and fully removed in .NET 9. Never re-enable it. Migrate to `System.Text.Json`, MessagePack, or protobuf.

---

## 9. Dependency Migration

### 9.1 NuGet Package Compatibility Tiers

| Tier                             | Action                                             |
| -------------------------------- | -------------------------------------------------- |
| **Native .NET 8 version exists** | Upgrade the package                                |
| **Targets .NET Standard 2.0**    | Works on both Framework and .NET 8 (bridge)        |
| **Targets .NET Standard 1.x**    | Usually works but test thoroughly                  |
| **.NET Framework-only**          | Find an alternative or isolate behind an interface |

### 9.2 Using .NET Standard 2.0 as a Bridge

Multi-target shared libraries during migration:

```xml
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFrameworks>netstandard2.0;net8.0</TargetFrameworks>
  </PropertyGroup>
</Project>
```

This allows the library to be consumed by both the Framework app and the new Core app.

### 9.3 Identifying Incompatible Packages

```bash
# Install the outdated checker
dotnet tool install -g dotnet-outdated-tool

# Check for packages that need updating
dotnet outdated

# Check API compatibility
dotnet tool install -g apiport
apiport analyze -f bin/Release/net48/MyApp.dll -t ".NET 8.0"
```

### 9.4 Common Package Replacements

| .NET Framework Package                            | .NET 8 Replacement                                                       |
| ------------------------------------------------- | ------------------------------------------------------------------------ |
| `System.Web.Http`                                 | Built into ASP.NET Core                                                  |
| `Microsoft.AspNet.WebApi.*`                       | Built into ASP.NET Core                                                  |
| `Newtonsoft.Json`                                 | `System.Text.Json` (or keep Newtonsoft if needed)                        |
| `System.Data.SqlClient`                           | `Microsoft.Data.SqlClient`                                               |
| `EntityFramework` (EF6)                           | `Microsoft.EntityFrameworkCore.*`                                        |
| `log4net` / `NLog`                                | `Microsoft.Extensions.Logging` + Serilog                                 |
| `Unity` / `Autofac` / `Ninject`                   | Built-in DI (`Microsoft.Extensions.DependencyInjection`) or keep Autofac |
| `Microsoft.Owin.*`                                | Built into ASP.NET Core middleware                                       |
| `Antlr` (bundled with MVC)                        | Remove — not needed in ASP.NET Core                                      |
| `WebGrease` / `Microsoft.AspNet.Web.Optimization` | Use Vite, Webpack, or `WebOptimizer`                                     |

---

## 10. .NET Upgrade Assistant

### 10.1 Status

> **Note:** The .NET Upgrade Assistant is **officially deprecated** as of 2026. Microsoft recommends the **GitHub Copilot modernization agent** (included in VS 2022 17.14.16+ and VS 2026). However, the CLI tool remains functional and useful for automated analysis.

### 10.2 Installation and Usage

```bash
# Install the CLI tool
dotnet tool install -g upgrade-assistant

# Analyze a solution (generates compatibility report)
upgrade-assistant analyze MyApp.sln

# Perform an upgrade
upgrade-assistant upgrade MyApp.sln
```

### 10.3 Upgrade Modes

| Mode                         | Description                                                                          | Use When                                         |
| ---------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------ |
| **In-place**                 | Upgrades the project directly                                                        | Small apps, confident in migration               |
| **Side-by-side**             | Creates a copy and upgrades it                                                       | Want to preserve the original                    |
| **Side-by-side incremental** | Creates a new .NET project next to the Framework project; routes endpoints gradually | Large ASP.NET apps needing incremental migration |

### 10.4 What the Tool Does

- Converts `.csproj` to SDK-style format
- Updates `TargetFramework` to `net8.0`
- Replaces NuGet package references with modern equivalents
- Updates namespace references
- Migrates `Startup.cs` patterns
- Generates a TODO list for manual fixes

### 10.5 What It Does NOT Do

- Rewrite business logic
- Migrate EF6 models to EF Core
- Handle complex dependency injection container migrations
- Fix runtime behavioral differences
- Migrate integration tests that depend on `System.Web`

---

## 11. Testing Strategy During Migration

### 11.1 Test Pyramid for Migration

```
                    ┌─────────┐
                    │  E2E    │  ← Run against BOTH apps during migration
                   ┌┴─────────┴┐
                   │Integration │  ← Verify migrated + proxy routes
                  ┌┴────────────┴┐
                  │  Unit Tests   │  ← Port alongside each component
                  └───────────────┘
```

### 11.2 Pre-Migration

1. **Establish a baseline** — Ensure all existing tests pass on the Framework app.
2. **Add integration/E2E tests** for critical user paths if they don't exist.
3. **Document current behavior** — Capture response shapes, status codes, headers that tests should verify.
4. **Set up contract tests** for APIs consumed by other services.

### 11.3 During Migration

1. **Run E2E tests against the proxy setup** — Validate that YARP correctly forwards to the Framework app.
2. **Port unit tests alongside each migrated component**.
3. **Test each migrated route individually** — Compare responses between old and new implementations.
4. **Smoke test the entire app** after each route migration.
5. **Performance test migrated routes** — Ensure no regression (ASP.NET Core is typically faster).

### 11.4 Key Test Framework Changes

```csharp
// Before: Testing ASP.NET Web API
using System.Web.Http;
using Microsoft.VisualStudio.TestTools.UnitTesting;

// After: Testing ASP.NET Core
using Microsoft.AspNetCore.Mvc.Testing;
using Xunit;

public class ProductsApiTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient _client;

    public ProductsApiTests(WebApplicationFactory<Program> factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task Get_ReturnsProduct()
    {
        var response = await _client.GetAsync("/api/products/1");
        response.EnsureSuccessStatusCode();
    }
}
```

### 11.5 Post-Migration

1. Remove the YARP proxy configuration.
2. Run the full test suite against the standalone ASP.NET Core app.
3. Load test to validate performance characteristics.
4. Monitor production metrics closely for the first release.

---

## 12. Aspire Integration for Migration

For teams using .NET Aspire, the `Aspire.Hosting.IncrementalMigration` package provides orchestration for running both Framework and Core apps together during migration:

```csharp
// AppHost Program.cs
var builder = DistributedApplication.CreateBuilder(args);

var legacyApp = builder.AddIISExpress("legacy-app", "path/to/framework/app");
var coreApp = builder.AddProject<Projects.MyNewApp>("core-app");

coreApp.WithIncrementalMigration(legacyApp, options =>
{
    options.RemoteSession = true;
    options.RemoteAuthentication = true;
});

builder.Build().Run();
```

---

## 13. Quick Reference: Migration Checklist

- [ ] Run .NET Portability Analyzer / Upgrade Assistant analysis
- [ ] Inventory all NuGet packages and check compatibility
- [ ] Identify Windows-only API usage and plan alternatives
- [ ] Choose migration strategy (incremental vs. in-place)
- [ ] Convert `.csproj` to SDK-style format
- [ ] Migrate configuration (`web.config` → `appsettings.json`)
- [ ] Replace `Global.asax` with `Program.cs`
- [ ] Migrate HTTP modules to middleware
- [ ] Migrate HTTP handlers to minimal APIs or controllers
- [ ] Migrate controllers (`System.Web.Mvc/Http` → `Microsoft.AspNetCore.Mvc`)
- [ ] Migrate authentication (Forms Auth → Cookie Auth / Identity)
- [ ] Migrate EF6 to EF Core (or keep EF6 on .NET 8 temporarily)
- [ ] Replace `BinaryFormatter` with `System.Text.Json` or MessagePack
- [ ] Update DI container (or switch to built-in DI)
- [ ] Port unit and integration tests
- [ ] Run E2E tests against the migrated app
- [ ] Load test and performance validate
- [ ] Decommission the legacy app and proxy

## Output Format

When reviewing a migration or providing migration guidance, organize findings by component area. For each issue:

1. State the file/project and relevant code area.
2. Name the migration concern (e.g., "Unsupported API", "Missing NuGet replacement", "Configuration not migrated").
3. Show a brief before/after code fix or recommend a concrete action.

Prioritize blockers (unsupported APIs, security issues like `BinaryFormatter`) over improvements. End with a summary of migration readiness.
