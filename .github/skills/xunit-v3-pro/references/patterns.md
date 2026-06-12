# Patterns — Idiomatic Test Patterns, Facts, Theories, Fixtures, and Organization

Covers idiomatic xUnit.net v3 patterns for writing Facts, Theories, organizing tests into collections, and structuring test classes.

## Facts

`[Fact]` marks a simple parameterless test.

```csharp
// Before (async void — not supported in v3)
[Fact]
public async void GetUser_ReturnsExpectedUser()
{
    await Task.Delay(1);
    Assert.True(true);
}

// After (Task or ValueTask required)
[Fact]
public async Task GetUser_ReturnsExpectedUser()
{
    var user = await _service.GetUserAsync(1);
    Assert.Equal("Alice", user.Name);
}
```

- `async void` is **not supported** in v3 — use `Task` or `ValueTask`.
- Use descriptive names in the `MethodName_Scenario_ExpectedResult` format.
- `[Fact(DisplayName = "Custom display name")]` overrides the test name in output.
- `[Fact(Timeout = 5000)]` sets a timeout in milliseconds (works on sync and async tests in v3).
- `[Fact(Skip = "reason")]` statically skips a test; see `references/advanced.md` for dynamic skipping.

## Theories

`[Theory]` marks a parameterized test; data is supplied by `[InlineData]`, `[MemberData]`, or `[ClassData]`.

```csharp
// Before (separate facts for each input)
[Fact] public void Add_1_And_2_Returns_3() => Assert.Equal(3, Add(1, 2));
[Fact] public void Add_2_And_3_Returns_5() => Assert.Equal(5, Add(2, 3));

// After (single theory with inline data)
[Theory]
[InlineData(1, 2, 3)]
[InlineData(2, 3, 5)]
[InlineData(-1, 1, 0)]
public void Add_ReturnsSum(int a, int b, int expected)
    => Assert.Equal(expected, Add(a, b));
```

### MemberData

```csharp
// Before (returning IEnumerable<object[]> — weakly typed)
public static IEnumerable<object[]> AddCases()
{
    yield return new object[] { 1, 2, 3 };
}

// After (TheoryData<T> — strongly typed)
public static TheoryData<int, int, int> AddCases => new()
{
    { 1, 2, 3 },
    { 2, 3, 5 },
};

[Theory]
[MemberData(nameof(AddCases))]
public void Add_ReturnsSum(int a, int b, int expected)
    => Assert.Equal(expected, Add(a, b));
```

- Prefer `TheoryData<T1, T2, ...>` over `IEnumerable<object[]>` — compile-time type safety.
- `MemberData` source methods can now be `async` (returning `Task<TheoryData<...>>` or `ValueTask<...>`).
- `[Theory(SkipTestWithoutData = true)]` skips rather than fails when no data rows are provided.
- See `references/advanced.md` for `TheoryDataRow<T>` (per-row metadata) and `MatrixTheoryData`.

## Test Class Constructor and Shared State

xUnit creates a new instance per test method. Use constructor injection, not shared fields.

```csharp
// Before (static shared state — causes test interference)
public class OrderTests
{
    private static readonly FakeDatabase _db = new();
}

// After (per-test instance — isolated)
public class OrderTests
{
    private readonly FakeDatabase _db;

    public OrderTests()
    {
        _db = new FakeDatabase();
    }
}
```

- For expensive shared resources, use class fixtures (`IClassFixture<T>`) — see `references/lifecycle.md`.
- Never share mutable state across test methods; always create fresh instances.

## Output Capture

Inject `ITestOutputHelper` to capture test-specific output (namespace is `Xunit`, not `Xunit.Abstractions`).

```csharp
// Before (Console.WriteLine — output is lost or interferes with other tests)
[Fact]
public void Test()
{
    Console.WriteLine("debug info");
    Assert.True(true);
}

// After (ITestOutputHelper — scoped to this test)
public class MyTests(ITestOutputHelper output)
{
    [Fact]
    public void Test()
    {
        output.WriteLine("debug info");     // existing method
        output.Write("partial: ");          // new in v3 — no trailing newline
        output.Write("line\n");
        Assert.True(true);
    }
}
```

- In v3, `ITestOutputHelper` lives in the `Xunit` namespace.
- `Write()` (without newline) is new in v3; `WriteLine()` still works.
- For capturing `Console`/`Debug` output globally, see `[assembly: CaptureConsole]` in `references/advanced.md`.

## Test Organization and Collections

Group related tests into collections to control parallelism and share fixtures.

```csharp
// Before (no collection — tests in different classes may run in parallel unexpectedly)
public class UserTests { }
public class OrderTests { }

// After (typed collection — preferred on .NET 8+)
[CollectionDefinition]
public class DatabaseCollection : ICollectionFixture<DatabaseFixture> { }

[Collection<DatabaseCollection>]
public class UserTests(DatabaseFixture db) { }

[Collection<DatabaseCollection>]
public class OrderTests(DatabaseFixture db) { }
```

- `[Collection<T>]` generic syntax (new in v3, .NET 8+) is preferred over `[Collection("Name")]` string syntax.
- Tests in the **same collection** run sequentially against each other by default.
- Tests in **different collections** may run in parallel.
- `[CollectionDefinition(DisableParallelization = true)]` disables parallel execution for a collection.
- See `references/lifecycle.md` for fixture patterns and `references/configuration.md` for global parallelism settings.

## Naming Conventions

```csharp
// Method: MethodUnderTest_Scenario_ExpectedOutcome
[Fact]
public async Task CreateOrder_WithOutOfStockItem_ThrowsInvalidOperationException() { }

// Class: SubjectTests or SubjectShould
public class OrderServiceTests { }
public class OrderServiceShould { }  // reads: "OrderServiceShould CreateOrder_..."
```

- Test method names should be self-documenting — no comments should be needed.
- Use underscores to separate the three segments, not camelCase or spaces.
- Avoid `Test` suffix on method names — it's redundant.
