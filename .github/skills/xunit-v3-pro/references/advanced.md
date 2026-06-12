# Advanced — TestContext, Dynamic Skipping, Theory Data, Pipeline Startup, Output Capture, MTP

Covers advanced xUnit.net v3 features: TestContext API, attribute-level dynamic skipping, explicit tests, TheoryDataRow, MatrixTheoryData, IXunitSerializer, ITestPipelineStartup, output capture attributes, and Microsoft Testing Platform integration.

## TestContext — Ambient Test Metadata

`TestContext.Current` provides ambient access to test information from anywhere in the call stack (no injection needed).

```csharp
// Access via static property (no ITestContextAccessor injection required)
[Fact]
public async Task ProcessFiles_CancelsOnTimeout()
{
    // CancellationToken is triggered when test times out or is cancelled
    var token = TestContext.Current.CancellationToken;
    await _processor.RunAsync(token);
}

// Diagnostic messages (visible in output with diagnosticMessages: true)
[Fact]
public void Measure_Performance()
{
    var sw = Stopwatch.StartNew();
    _service.DoWork();
    TestContext.Current.SendDiagnosticMessage("DoWork took {0}ms", sw.ElapsedMilliseconds);
}

// Add named attachments to the test result
[Fact]
public async Task GenerateReport_ProducesFile()
{
    var path = await _reporter.GenerateAsync();
    TestContext.Current.AddAttachment("report.pdf", path);
}

// Add warnings (visible in output; optionally treated as failures via failWarns config)
[Fact]
public void LegacyApi_StillWorks()
{
    TestContext.Current.AddWarning("LegacyApi is deprecated; migrate before 2026-01");
    Assert.True(_legacy.IsAvailable());
}

// Communicate data between test class and pipeline stages
[Fact]
public void StoreValue_ForPipelineStage()
{
    TestContext.Current.KeyValueStorage["myKey"] = "myValue";
}
```

### Injecting ITestContextAccessor

For service classes that need test context but can't use the static accessor (e.g., in CI):

```csharp
// Inject ITestContextAccessor into a service under test
public class DiagnosticService(ITestContextAccessor contextAccessor)
{
    public void Log(string message)
        => contextAccessor.TestContext?.SendDiagnosticMessage(message);
}

// In the test
public class MyTests(ITestContextAccessor contextAccessor)
{
    [Fact]
    public void Test()
    {
        var svc = new DiagnosticService(contextAccessor);
        svc.Log("test message");
    }
}
```

## Attribute-Level Dynamic Skipping

Skip tests based on a boolean property without writing skip logic inside the test body.

```csharp
// Define a property that controls skipping
public class IntegrationTests
{
    public static bool IsNetworkAvailable => CheckNetwork();

    // SkipUnless — skips when the property is false
    [Fact(SkipUnless = nameof(IsNetworkAvailable))]
    public async Task CallExternalApi_ReturnsData()
    {
        var result = await _client.GetAsync("https://api.example.com");
        Assert.Equal(HttpStatusCode.OK, result.StatusCode);
    }

    // SkipWhen — skips when the property is true
    [Fact(SkipWhen = nameof(IsNetworkAvailable))]
    public void Offline_FallbackBehavior_Activates()
    {
        Assert.True(_service.IsUsingCache);
    }
}
```

- The property must be `public static bool` on the same class as the test.
- For runtime skipping in test body: use `Assert.Skip`, `Assert.SkipUnless`, `Assert.SkipWhen` (see `references/assertions.md`).

## Explicit Tests

Mark tests that should only run when explicitly requested — excluded from normal test runs.

```csharp
// Explicit tests are not run unless specifically targeted by filter
[Fact(Explicit = true)]
public async Task LoadTest_HighConcurrency()
{
    // This test only runs when explicitly requested
    await RunConcurrentRequests(concurrency: 1000);
}

// Explicit with a custom reason (shown in test output)
[Fact(Explicit = true, ExplicitReason = "Requires production database connection")]
public async Task ProductionSmokeTest() { }
```

- Run explicit tests via filter: `dotnet test --filter "DisplayName~LoadTest"`.
- Explicit tests appear in test output as skipped when running the full suite.

## TheoryDataRow — Per-Row Metadata

`TheoryDataRow<T>` wraps theory data with per-row Skip, Explicit, DisplayName, Timeout, and Traits.

```csharp
// Before (all rows share the same attributes — no per-row control)
[Theory]
[InlineData("valid")]
[InlineData("")]    // want to skip this
[InlineData(null)]  // want to mark explicit
public void Parse_HandlesInput(string? input) { }

// After (TheoryDataRow — per-row metadata)
public static TheoryData<TheoryDataRow<string?>> ParseInputs =>
[
    new TheoryDataRow<string?>("valid"),
    new TheoryDataRow<string?>("") { Skip = "Empty string handling not yet implemented" },
    new TheoryDataRow<string?>(null) { Explicit = true, DisplayName = "Null input (edge case)" },
    new TheoryDataRow<string?>("hello") { Timeout = 1000, Traits = { { "Category", "Fast" } } },
];

[Theory]
[MemberData(nameof(ParseInputs))]
public void Parse_HandlesInput(string? input) { }
```

- `TheoryDataRow<T>` is new in v3; no v2 equivalent.
- Each row can independently be skipped, marked explicit, given a display name, or have traits.

## MatrixTheoryData — Cartesian Product

Generate all combinations of two or more sets of values.

```csharp
// Before (manually listing all combinations)
public static TheoryData<string, int> Cases => new()
{
    { "GET", 200 }, { "GET", 404 },
    { "POST", 200 }, { "POST", 404 },
    { "DELETE", 200 }, { "DELETE", 404 },
};

// After (MatrixTheoryData — generates all 6 combinations automatically)
public static MatrixTheoryData<string, int> Cases => new(
    ["GET", "POST", "DELETE"],
    [200, 404]
);

[Theory]
[MemberData(nameof(Cases))]
public void HandleRequest_ReturnsExpectedStatus(string method, int expectedStatus) { }
```

- `MatrixTheoryData<T1, T2, ...>` generates the cartesian product of its input arrays.
- Useful for testing all combinations of enums, status codes, or configuration flags.

## Async MemberData Sources

Theory data source methods can now be `async` in v3.

```csharp
// Before (v2 — must return synchronous IEnumerable)
public static IEnumerable<object[]> GetUsers() => _db.LoadUsers();

// After (v3 — async is supported)
public static async Task<TheoryData<User>> GetUsersAsync()
{
    var users = await _db.LoadUsersAsync();
    var data = new TheoryData<User>();
    foreach (var u in users) data.Add(u);
    return data;
}

[Theory]
[MemberData(nameof(GetUsersAsync))]
public void UserName_IsNotEmpty(User user)
    => Assert.NotEmpty(user.Name);
```

## IXunitSerializer — Custom Theory Data Serialization

Implement `IXunitSerializer` to support serialization of custom types in theory data (enables test case display names and re-run by ID).

```csharp
// Custom type to serialize
public record OrderId(Guid Value);

// Serializer implementation
public class OrderIdSerializer : IXunitSerializer
{
    public bool IsSerializable(Type type, object? value, out string? failureReason)
    {
        if (type == typeof(OrderId)) { failureReason = null; return true; }
        failureReason = $"{type} is not OrderId";
        return false;
    }

    public string Serialize(object value)
        => ((OrderId)value).Value.ToString();

    public object Deserialize(Type type, string serializedValue)
        => new OrderId(Guid.Parse(serializedValue));
}

// Register in assembly
[assembly: RegisterXunitSerializer(typeof(OrderIdSerializer), typeof(OrderId))]
```

- Without a serializer, custom types in theory data show as opaque values in test output and cannot be re-run individually by ID.

## Output Capture Attributes

Capture `Console` or `Debug`/`Trace` output at the assembly level.

```csharp
// In AssemblyInfo.cs or GlobalUsings.cs
[assembly: CaptureConsole]   // captures Console.Write/WriteLine (stdout and stderr)
[assembly: CaptureTrace]     // captures Debug.Write/Trace.Write output
```

```csharp
// Before (Console output goes to the process stdout — visible only if showLiveOutput is true)
[Fact]
public void Test()
{
    Console.WriteLine("debug info");
    Assert.True(true);
}

// After (with [assembly: CaptureConsole], Console output is captured into test output)
// Console.WriteLine now routes to ITestOutputHelper for the active test — no code change needed
[Fact]
public void Test()
{
    Console.WriteLine("debug info");  // captured and scoped to this test
    Assert.True(true);
}
```

- `[assembly: CaptureConsole]` automatically redirects `Console` to the active test's `ITestOutputHelper`.
- Apply these attributes when testing legacy code that writes to `Console` or `Debug`.

## ITestPipelineStartup — Early Pipeline Hooks

Run code before any tests start (after assembly fixtures but before test collection setup).

```csharp
// Implement ITestPipelineStartup
public class MyPipelineStartup : ITestPipelineStartup
{
    public async ValueTask StartAsync(IMessageSink diagnosticMessageSink)
    {
        // Configure global services, load config, start background processes
        diagnosticMessageSink.OnMessage(
            new DiagnosticMessage("Pipeline startup: configuring global services"));

        await GlobalServiceBus.StartAsync();
    }

    public async ValueTask StopAsync()
    {
        await GlobalServiceBus.StopAsync();
    }
}

// Register in assembly
[assembly: TestPipelineStartup(typeof(MyPipelineStartup))]
```

- Only one `ITestPipelineStartup` implementation is allowed per assembly.
- Use for process-wide setup that must happen before any fixture initialization.
- For per-assembly fixtures, prefer `[assembly: AssemblyFixture(typeof(T))]` (see `references/lifecycle.md`).

## Microsoft Testing Platform (MTP)

To use the MTP v2 runner instead of VSTest:

```xml
<PackageReference Include="xunit.v3.mtp-v2" Version="4.0.0" />
```

```shell
# Run tests via MTP
dotnet test --test-platform Microsoft.Testing.Platform
```

- MTP provides a modernized runner architecture and first-class support for `dotnet test` filtering.
- MTP report formats include **CTRF** and **TRX** (in addition to standard console output).
- The VSTest runner (`xunit.runner.visualstudio`) and MTP runner are mutually exclusive per run — don't reference both runners simultaneously.
- See also `references/configuration.md` for `xunit.runner.json` options that apply to both runners.
