# Assertions — Assert API, New v3 Assertions, and Best Practices

Covers the xUnit.net v3 `Assert` class, new assertions added in v3, and idiomatic assertion patterns.

## Core Equality Assertions

```csharp
// Value equality
Assert.Equal(expected, actual);
Assert.NotEqual(expected, actual);

// Reference equality
Assert.Same(expected, actual);
Assert.NotSame(expected, actual);

// Null checks
Assert.Null(value);
Assert.NotNull(value);     // also unwraps T? to T for subsequent use

// Boolean checks
Assert.True(condition);
Assert.False(condition);
```

- Always put `expected` before `actual` — xUnit error messages depend on argument order.
- `Assert.NotNull(value)` in v3 returns the non-null value, enabling null-safe chaining.

## Collection Assertions

```csharp
// Before (manual loop or LINQ)
Assert.True(items.Any(x => x.Id == 1));
Assert.True(items.Count() == 3);

// After (dedicated collection assertions)
Assert.Contains(items, x => x.Id == 1);
Assert.DoesNotContain(items, x => x.Id == 99);
Assert.Collection(items,
    item => Assert.Equal("Alice", item.Name),
    item => Assert.Equal("Bob", item.Name));
Assert.Single(items);          // exactly one element
Assert.Empty(items);
Assert.NotEmpty(items);
```

- `Assert.Collection` verifies element count **and** runs an inspector for each element in order.
- `Assert.Contains`/`Assert.DoesNotContain` accept both a predicate and a direct value overload.

## Exception Assertions

```csharp
// Before (try/catch with manual fail)
try
{
    service.Delete(null!);
    Assert.Fail("Expected exception was not thrown");
}
catch (ArgumentNullException) { }

// After (Assert.Throws / Assert.ThrowsAsync)
var ex = Assert.Throws<ArgumentNullException>(() => service.Delete(null!));
Assert.Equal("id", ex.ParamName);

var asyncEx = await Assert.ThrowsAsync<InvalidOperationException>(
    () => service.ProcessAsync(invalidInput));
Assert.Contains("must not be empty", asyncEx.Message);
```

- `Assert.Throws<T>` returns the caught exception for further assertions.
- Use `Assert.ThrowsAsync<T>` for async code — never wrap async lambdas in `Assert.Throws<T>`.

## Assert.Equivalent (Deep Equality)

New in v3 — compares objects by structural equivalence, not reference.

```csharp
// Before (manual property-by-property comparison)
var result = service.GetSummary();
Assert.Equal("Alice", result.Name);
Assert.Equal(42, result.Age);

// After (Assert.Equivalent — deep structural comparison)
var expected = new UserSummary { Name = "Alice", Age = 42 };
var result = service.GetSummary();
Assert.Equivalent(expected, result);

// Strict mode — actual must not have extra members
Assert.Equivalent(expected, result, strict: true);
```

- Without `strict: true`, `actual` may have more properties than `expected` (subset matching).
- With `strict: true`, both objects must have identical structure and values.
- Works recursively on nested objects, collections, and anonymous types.
- Avoid using `Assert.Equivalent` when field ordering or identity matters — use `Assert.Equal` with custom comparers instead.

## Assert.Skip — Dynamic Skipping at Runtime

```csharp
// Before (static skip via attribute — cannot be conditional)
[Fact(Skip = "Requires network")]
public async Task CallExternalApi_ReturnsData() { }

// After (dynamic skip inside test body)
[Fact]
public async Task CallExternalApi_ReturnsData()
{
    if (!NetworkAvailable())
        Assert.Skip("Network not available in this environment");

    var result = await _client.GetDataAsync();
    Assert.NotNull(result);
}

// Conditional variants
Assert.SkipUnless(NetworkAvailable(), "Network not available");
Assert.SkipWhen(!NetworkAvailable(), "Network not available");
```

- `Assert.Skip` throws immediately and marks the test as skipped (not failed).
- `Assert.SkipUnless(condition, reason)` skips when `condition` is `false`.
- `Assert.SkipWhen(condition, reason)` skips when `condition` is `true`.
- For attribute-level dynamic skipping, see `references/advanced.md` (`[Fact(SkipUnless = nameof(Prop))]`).

## Type and String Assertions

```csharp
// Type assertions
Assert.IsType<OrderService>(actual);       // exact type match
Assert.IsAssignableFrom<IService>(actual); // type or subtype

// String assertions
Assert.StartsWith("prefix", actual);
Assert.EndsWith("suffix", actual);
Assert.Contains("substring", actual);
Assert.Matches(@"^\d{4}-\d{2}-\d{2}$", actual); // regex

// Numeric range
Assert.InRange(value, low: 1, high: 10);
Assert.NotInRange(value, low: 1, high: 10);
```

## Assert.Fail and Assert.Multiple

```csharp
// Assert.Fail — unconditional failure with a message
Assert.Fail("This code path should never be reached");

// Assert.Multiple — collect all assertion failures before reporting
Assert.Multiple(
    () => Assert.Equal("Alice", user.Name),
    () => Assert.Equal(30, user.Age),
    () => Assert.NotNull(user.Email)
);
```

- `Assert.Multiple` runs all assertions and reports all failures at once — useful when a single test validates many independent properties.
- Without `Assert.Multiple`, the first failing assertion short-circuits the rest.

## Common Anti-Patterns

```csharp
// Anti-pattern: Assert.True with expression — loses type info in error messages
Assert.True(result.Name == "Alice");   // error says "Expected True but was False"

// Prefer: specialized assertion — error says "Expected Alice but got Bob"
Assert.Equal("Alice", result.Name);

// Anti-pattern: Assert.NotNull then access — null check not compiler-safe in v2
Assert.NotNull(user);
Console.WriteLine(user.Name); // compiler still warns

// Prefer: use the return value of Assert.NotNull (v3 returns non-null T)
var u = Assert.NotNull(user);
Console.WriteLine(u.Name);  // no compiler warning
```
