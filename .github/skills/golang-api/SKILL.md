---
name: golang-api
description: >-
  Comprehensively reviews Go API code for best practices on HTTP routing (stdlib net/http
  and Gin), middleware, error handling, request validation, JSON serialization, database
  access, testing, project structure, authentication, graceful shutdown, and context
  propagation. Use when reading, writing, or reviewing Go web API or REST service projects.
  Trigger file patterns: go.mod, *.go, Dockerfile with Go, main.go.
  DO NOT USE FOR: CLI tools without HTTP servers, pure library packages, or non-API Go code.
---

Reviews and guides Go HTTP API code for correctness, idiomatic patterns, and production readiness. Targets Go 1.22+ with stdlib `net/http` enhanced routing and Gin framework.

Review process:

1. Check project structure and module layout using `references/patterns.md`.
2. Validate routing and handler patterns using `references/patterns.md`.
3. Check middleware usage, ordering, and composition using `references/middleware.md`.
4. Validate error handling for Go idioms using `references/errors.md`.
5. Check request validation and data binding using `references/validation.md`.
6. Review JSON serialization patterns using `references/serialization.md`.
7. Check database access patterns using `references/database.md`.
8. Validate testing coverage and patterns using `references/testing.md`.
9. Check authentication and security patterns using `references/security.md`.
10. Review graceful shutdown, timeouts, and context propagation using `references/performance.md`.

If doing a partial review, load only the relevant reference files.

## Core Instructions

- Target Go 1.22+ with stdlib enhanced routing (`GET /users/{id}`, `r.PathValue()`).
- **Version check**: Read `go.mod` for the `go` directive. If below 1.22, emit a version compatibility warning and adjust routing advice (recommend `chi` or `gorilla/mux` instead of method patterns). If below 1.21, recommend `zap`/`zerolog` instead of `log/slog`.
- All code examples use Go modules (`go.mod`).
- Prefer stdlib `net/http` for new projects unless the project already uses Gin or needs Gin-specific features.
- Never recommend `http.DefaultServeMux` — always use `http.NewServeMux()`.
- Apply all version-independent guidance (project structure, error handling, testing, security, graceful shutdown) regardless of Go version.

## Output Format

Organize findings by file. For each issue:

1. State the file and relevant line(s).
2. Name the rule being violated.
3. Show a brief before/after code fix.

Skip files with no issues. End with a prioritized summary.

Example output:

### cmd/api/main.go

**Line 12: Never put business logic in main.go — it should only wire dependencies and start the server.**

```go
// Before
func main() {
    db := connectDB()
    http.HandleFunc("/users", func(w http.ResponseWriter, r *http.Request) {
        rows, _ := db.Query("SELECT * FROM users")
        // ... handle rows
    })
    http.ListenAndServe(":8080", nil)
}

// After
func main() {
    db := store.Connect(os.Getenv("DATABASE_URL"))
    h := handler.New(db)
    srv := h.Routes()
    log.Fatal(srv.ListenAndServe())
}
```

### internal/handler/user.go

**Line 28: Always check errors — never discard with `_`.**

```go
// Before
result, _ := db.Exec(query, args...)

// After
result, err := db.Exec(query, args...)
if err != nil {
    return fmt.Errorf("insert user: %w", err)
}
```
