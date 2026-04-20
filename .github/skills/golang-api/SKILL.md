---
name: golang-api
description: >-
  Comprehensively reviews Go API code for best practices on HTTP routing (stdlib net/http and Gin),
  middleware, error handling, request validation, JSON serialization, database access, testing,
  project structure, authentication, graceful shutdown, and context propagation.
  Use when reading, writing, or reviewing Go web API or REST service projects.
---

Reviews and guides Go HTTP API code for correctness, idiomatic patterns, and production readiness. Targets Go 1.22+ with stdlib `net/http` enhanced routing and Gin framework.

## Version Compatibility Check

**Before reviewing any code, determine the project's Go version.**

1. **Find the version**: Read the project's `go.mod` file and look for the `go` directive (e.g., `go 1.22`). If no `go.mod` exists, **warn the user**: _"No go.mod found — this project should be using Go modules. Some advice in this review assumes Go modules are in use."_

2. **Compare against the skill target (Go 1.22+)**:
   - If the version is **1.22 or later** — proceed normally; all guidance in this skill applies.
   - If the version is **below 1.22** — emit a prominent warning before the review:

     > ⚠️ **Version Compatibility Warning**
     > This project uses Go `<detected version>`, but this review skill targets **Go 1.22+**. Some recommendations below do not apply to your version. Version-specific caveats are noted inline.

3. **Feature-to-minimum-version reference**:

   | Minimum Version | Features                                                                                                                                 | Skill Sections Affected                                    |
   | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
   | **Go 1.22+**    | Enhanced `net/http` routing — method patterns (`GET /users/{id}`), wildcards (`{id}`, `{path...}`), exact-match (`{$}`), `r.PathValue()` | §2 Routing and Handler Patterns (stdlib)                   |
   | **Go 1.21+**    | `log/slog` structured logging, `slices` package, `maps` package                                                                          | §4 Error Handling (slog examples), §10 Context Propagation |
   | **Go 1.20+**    | `errors.Join` for combining errors, `strings.CutPrefix` / `strings.CutSuffix`                                                            | §4 Error Handling                                          |

4. **When the project version is incompatible**, apply these rules:
   - **Do not recommend features the project cannot use.** For each affected section, note the incompatibility and suggest a version-appropriate alternative:
     - _Go <1.22_: Recommend `gorilla/mux`, `chi`, or manual method checks instead of `net/http` method patterns. Skip `r.PathValue()` examples.
     - _Go <1.21_: Recommend `log` or `zerolog`/`zap` instead of `log/slog`. Use `sort.Slice` instead of `slices.SortFunc`.
     - _Go <1.20_: Use `fmt.Errorf` with `%w` wrapping (single error) instead of `errors.Join`. Use manual string trimming instead of `strings.CutPrefix`.
   - Still apply all version-independent guidance (project structure, middleware patterns, error handling idioms, testing, security, graceful shutdown, etc.).

## Review Process

1. Check project structure against Go conventions.
2. Validate routing and handler patterns.
3. Check middleware usage and ordering.
4. Validate error handling for Go idioms.
5. Check request validation and data binding.
6. Review JSON serialization patterns.
7. Check database access patterns.
8. Validate testing coverage and patterns.
9. Check authentication and security patterns.
10. Review graceful shutdown and context propagation.
11. Check Go modules and dependency management.

For a partial review, focus only on the relevant sections below.

## Output Format

Organize findings by file. For each issue:

1. State the file and relevant line(s).
2. Name the rule being violated.
3. Show a brief before/after code fix.

Skip files with no issues. End with a prioritized summary.

---

## 1. Project Structure

- Use the official Go module layout for servers. Keep server logic in `internal/`, commands in `cmd/`.

  ```
  # Before (flat, everything exported)
  myapi/
    main.go
    handlers.go
    models.go
    db.go

  # After (idiomatic server layout)
  myapi/
    go.mod
    cmd/
      api-server/
        main.go
    internal/
      handler/
        album.go
        album_test.go
      model/
        album.go
      store/
        album.go
        album_test.go
      middleware/
        auth.go
        logging.go
  ```

  **Why:** `internal/` prevents external imports of server internals. `cmd/` separates entry points from logic. This is the layout recommended by the official Go docs.

- Never put business logic in `main.go`. It should only wire dependencies and start the server.

  ```go
  // Before — logic in main
  func main() {
      db := connectDB()
      http.HandleFunc("/users", func(w http.ResponseWriter, r *http.Request) {
          rows, _ := db.Query("SELECT * FROM users")
          // ... handle rows
      })
      http.ListenAndServe(":8080", nil)
  }

  // After — main only wires and starts
  func main() {
      db := store.Connect(os.Getenv("DATABASE_URL"))
      h := handler.New(db)
      srv := h.Routes()
      log.Fatal(srv.ListenAndServe())
  }
  ```

- Use `internal/` for packages that should not be importable outside your module. Reserve top-level packages only for code you intend to export as a library.

## 2. Routing and Handler Patterns

### stdlib `net/http` (Go 1.22+)

- Use method-and-wildcard patterns in `http.ServeMux` (Go 1.22+). No third-party router needed for basic REST APIs.

  ```go
  // Before (Go <1.22 — manual method check)
  mux.HandleFunc("/posts/", func(w http.ResponseWriter, r *http.Request) {
      if r.Method != http.MethodGet {
          http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
          return
      }
      id := strings.TrimPrefix(r.URL.Path, "/posts/")
      // ...
  })

  // After (Go 1.22+ — method + wildcard in pattern)
  mux.HandleFunc("GET /posts/{id}", func(w http.ResponseWriter, r *http.Request) {
      id := r.PathValue("id")
      // ...
  })
  ```

- Use `{$}` to match only the exact path with trailing slash (e.g., `GET /posts/{$}` matches `/posts/` but not `/posts/123`).

- Use `{name...}` for catch-all segments (e.g., `/files/{path...}`).

- Always use `http.NewServeMux()` instead of the default `http.DefaultServeMux` to avoid global state and route collisions.

  ```go
  // Before
  http.HandleFunc("GET /health", healthHandler)
  http.ListenAndServe(":8080", nil)

  // After
  mux := http.NewServeMux()
  mux.HandleFunc("GET /health", healthHandler)
  http.ListenAndServe(":8080", mux)
  ```

### Gin Framework

- Use `gin.New()` instead of `gin.Default()` when you want explicit control over middleware. `gin.Default()` adds Logger and Recovery middleware automatically.

  ```go
  // Explicit control
  r := gin.New()
  r.Use(gin.Recovery())
  r.Use(customLogger())
  ```

- Use route groups for versioned APIs.

  ```go
  r := gin.New()
  api := r.Group("/api")
  {
      v1 := api.Group("/v1")
      {
          v1.GET("/users", listUsers)
          v1.GET("/users/:id", getUser)
          v1.POST("/users", createUser)
      }
  }
  ```

- Extract path params with `c.Param("id")`, query params with `c.Query("key")` or `c.DefaultQuery("key", "default")`.

### General Handler Patterns

- Keep handlers thin. They should parse input, call a service/store, and format the response. No business logic.

  ```go
  // Before — handler does everything
  func getUser(c *gin.Context) {
      id := c.Param("id")
      row := db.QueryRow("SELECT name, email FROM users WHERE id = $1", id)
      var name, email string
      if err := row.Scan(&name, &email); err != nil {
          c.JSON(500, gin.H{"error": "db error"})
          return
      }
      c.JSON(200, gin.H{"name": name, "email": email})
  }

  // After — handler delegates to a store
  func (h *Handler) getUser(c *gin.Context) {
      id := c.Param("id")
      user, err := h.store.GetUser(c.Request.Context(), id)
      if errors.Is(err, store.ErrNotFound) {
          c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
          return
      }
      if err != nil {
          c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
          return
      }
      c.JSON(http.StatusOK, user)
  }
  ```

## 3. Middleware

- Register middleware **before** routes. Middleware registered after a route definition won't apply to that route.

  ```go
  // Before (wrong order)
  r.GET("/ping", pingHandler)
  r.Use(authMiddleware()) // Too late for /ping

  // After (correct order)
  r.Use(authMiddleware())
  r.GET("/ping", pingHandler)
  ```

- Use group-scoped middleware to apply auth only to protected routes.

  ```go
  r := gin.New()
  r.Use(gin.Recovery(), loggingMiddleware())

  public := r.Group("/")
  {
      public.POST("/login", loginHandler)
      public.POST("/register", registerHandler)
  }

  protected := r.Group("/api")
  protected.Use(authMiddleware())
  {
      protected.GET("/profile", profileHandler)
      protected.PUT("/profile", updateProfileHandler)
  }
  ```

- For stdlib `net/http`, use the handler-wrapping pattern for middleware.

  ```go
  func loggingMiddleware(next http.Handler) http.Handler {
      return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
          start := time.Now()
          next.ServeHTTP(w, r)
          slog.Info("request", "method", r.Method, "path", r.URL.Path,
              "duration", time.Since(start))
      })
  }

  // Compose middleware
  mux := http.NewServeMux()
  mux.HandleFunc("GET /health", healthHandler)
  handler := loggingMiddleware(authMiddleware(mux))
  http.ListenAndServe(":8080", handler)
  ```

- In Gin, always call `c.Abort()` after writing an error response in middleware to stop the handler chain. Without it, the next handler still executes.

  ```go
  func authMiddleware() gin.HandlerFunc {
      return func(c *gin.Context) {
          token := c.GetHeader("Authorization")
          if token == "" {
              c.JSON(http.StatusUnauthorized, gin.H{"error": "missing token"})
              c.Abort() // Critical — stops the chain
              return
          }
          c.Next()
      }
  }
  ```

## 4. Error Handling

- Always check errors. Never discard them with `_`.

  ```go
  // Before (silent failure)
  result, _ := db.Exec(query, args...)

  // After
  result, err := db.Exec(query, args...)
  if err != nil {
      return fmt.Errorf("insert user: %w", err)
  }
  ```

- Wrap errors with `fmt.Errorf("context: %w", err)` to add context while preserving the error chain.

  ```go
  // Before
  if err != nil {
      return err
  }

  // After
  if err != nil {
      return fmt.Errorf("fetching user %s: %w", id, err)
  }
  ```

- Use `errors.Is()` and `errors.As()` for error checking. Never compare error strings.

  ```go
  // Before (fragile)
  if err.Error() == "not found" { ... }

  // After
  if errors.Is(err, sql.ErrNoRows) { ... }

  var pgErr *pgconn.PgError
  if errors.As(err, &pgErr) && pgErr.Code == "23505" {
      // handle unique constraint violation
  }
  ```

- Define sentinel errors for your domain at the package level.

  ```go
  package store

  var (
      ErrNotFound    = errors.New("not found")
      ErrConflict    = errors.New("conflict")
      ErrForbidden   = errors.New("forbidden")
  )
  ```

- Use custom error types when you need to carry structured data.

  ```go
  type ValidationError struct {
      Field   string
      Message string
  }

  func (e *ValidationError) Error() string {
      return fmt.Sprintf("validation: %s — %s", e.Field, e.Message)
  }
  ```

- Never `panic` in library or handler code. Reserve `panic` for truly unrecoverable situations (e.g., programmer error detected during `init`).

- In Gin, use error-handling middleware to centralize error responses.

  ```go
  func ErrorHandler() gin.HandlerFunc {
      return func(c *gin.Context) {
          c.Next()
          if len(c.Errors) > 0 {
              err := c.Errors.Last().Err
              // Map domain errors to HTTP status codes
              switch {
              case errors.Is(err, store.ErrNotFound):
                  c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
              case errors.Is(err, store.ErrConflict):
                  c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
              default:
                  c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
              }
          }
      }
  }
  ```

- Handle the "happy path" on the left margin. Error cases should `return` early.

  ```go
  // Before (deeply nested)
  func process(data []byte) error {
      if data != nil {
          result, err := parse(data)
          if err == nil {
              return save(result)
          } else {
              return err
          }
      }
      return errors.New("no data")
  }

  // After (flat, early returns)
  func process(data []byte) error {
      if data == nil {
          return errors.New("no data")
      }
      result, err := parse(data)
      if err != nil {
          return fmt.Errorf("parsing: %w", err)
      }
      return save(result)
  }
  ```

## 5. Request Validation and Data Binding

### Gin Binding

- Use `ShouldBindJSON` instead of `BindJSON`. `BindJSON` auto-responds with 400 on failure, which limits your control over error responses.

  ```go
  // Before (less control)
  if err := c.BindJSON(&req); err != nil {
      return // BindJSON already wrote a 400 response
  }

  // After (full control)
  if err := c.ShouldBindJSON(&req); err != nil {
      c.JSON(http.StatusBadRequest, gin.H{
          "error":   "invalid request body",
          "details": err.Error(),
      })
      return
  }
  ```

- Use struct tags for validation rules via the `binding` tag (powered by `go-playground/validator`).

  ```go
  type CreateUserRequest struct {
      Name  string `json:"name"  binding:"required,min=3,max=50"`
      Email string `json:"email" binding:"required,email"`
      Age   int    `json:"age"   binding:"gte=0,lte=130"`
  }
  ```

- Register custom validators for domain-specific rules.

  ```go
  if v, ok := binding.Validator.Engine().(*validator.Validate); ok {
      v.RegisterValidation("iso_date", func(fl validator.FieldLevel) bool {
          _, err := time.Parse("2006-01-02", fl.Field().String())
          return err == nil
      })
  }
  ```

- Struct fields **must** be exported (start with uppercase) for binding to work. Unexported fields are silently ignored.

  ```go
  type Request struct {
      Name  string `json:"name"`  // ✓ binds
      email string `json:"email"` // ✗ silently ignored
  }
  ```

### stdlib Validation

- For stdlib `net/http`, decode JSON with `json.NewDecoder` and validate manually or with a validation library.

  ```go
  func createUser(w http.ResponseWriter, r *http.Request) {
      var req CreateUserRequest
      if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
          http.Error(w, "invalid JSON", http.StatusBadRequest)
          return
      }
      if req.Name == "" {
          http.Error(w, "name is required", http.StatusBadRequest)
          return
      }
      // ... proceed
  }
  ```

- Limit request body size to prevent abuse.

  ```go
  r.Body = http.MaxBytesReader(w, r.Body, 1<<20) // 1 MB limit
  ```

## 6. JSON Serialization

- Use struct tags to control JSON field names. Go convention is `camelCase` in JSON.

  ```go
  type Album struct {
      ID     string  `json:"id"`
      Title  string  `json:"title"`
      Artist string  `json:"artist"`
      Price  float64 `json:"price"`
  }
  ```

- Use `omitempty` to omit zero-value fields from JSON output.

  ```go
  type User struct {
      ID    string `json:"id"`
      Name  string `json:"name"`
      Bio   string `json:"bio,omitempty"`   // omitted when ""
      Avatar *string `json:"avatar,omitempty"` // omitted when nil
  }
  ```

- Use pointer types to distinguish between "not provided" and "zero value" in PATCH/update endpoints.

  ```go
  type UpdateUserRequest struct {
      Name *string `json:"name"`
      Age  *int    `json:"age"`
  }

  // In handler:
  if req.Name != nil {
      user.Name = *req.Name
  }
  ```

- Never serialize internal errors or stack traces to the client. Log them server-side and return a generic message.

  ```go
  // Before (leaks internals)
  c.JSON(500, gin.H{"error": err.Error()})

  // After
  slog.Error("failed to fetch user", "error", err, "userID", id)
  c.JSON(500, gin.H{"error": "internal server error"})
  ```

- Use `json.NewEncoder(w).Encode()` for stdlib. In Gin, use `c.JSON()` for compact or `c.IndentedJSON()` for debug-friendly output.

- Implement the `json.Marshaler` interface for custom serialization only when needed. Prefer struct tags for simple cases.

## 7. Database Access Patterns

- Accept `context.Context` as the first parameter in all store/repository methods. Propagate the request context.

  ```go
  // Store interface
  type UserStore interface {
      GetUser(ctx context.Context, id string) (*User, error)
      CreateUser(ctx context.Context, u *User) error
      ListUsers(ctx context.Context, opts ListOptions) ([]User, error)
  }
  ```

- Use `database/sql` with `QueryContext`, `ExecContext`, and `QueryRowContext` — never the non-context variants.

  ```go
  // Before
  row := db.QueryRow("SELECT name FROM users WHERE id = $1", id)

  // After
  row := db.QueryRowContext(ctx, "SELECT name FROM users WHERE id = $1", id)
  ```

- Always close `*sql.Rows` with `defer rows.Close()`.

  ```go
  rows, err := db.QueryContext(ctx, "SELECT id, name FROM users")
  if err != nil {
      return nil, fmt.Errorf("querying users: %w", err)
  }
  defer rows.Close()

  var users []User
  for rows.Next() {
      var u User
      if err := rows.Scan(&u.ID, &u.Name); err != nil {
          return nil, fmt.Errorf("scanning user: %w", err)
      }
      users = append(users, u)
  }
  return users, rows.Err() // Always check rows.Err()
  ```

- Check `rows.Err()` after the loop — it catches errors from iteration.

- Use parameterized queries to prevent SQL injection. Never interpolate user input into query strings.

  ```go
  // Before (SQL injection vulnerability)
  query := fmt.Sprintf("SELECT * FROM users WHERE name = '%s'", name)

  // After (parameterized)
  query := "SELECT * FROM users WHERE name = $1"
  row := db.QueryRowContext(ctx, query, name)
  ```

- Use `sqlx` or `pgx` for more ergonomic database access with struct scanning. But understand `database/sql` fundamentals first.

- Configure connection pool settings explicitly.

  ```go
  db.SetMaxOpenConns(25)
  db.SetMaxIdleConns(10)
  db.SetConnMaxLifetime(5 * time.Minute)
  db.SetConnMaxIdleTime(1 * time.Minute)
  ```

## 8. Testing

### HTTP Handler Tests

- Use `net/http/httptest` for handler tests. Create a request, record the response, and assert.

  ```go
  func TestGetAlbums(t *testing.T) {
      // Setup
      store := &mockStore{albums: testAlbums}
      h := handler.New(store)
      mux := h.Routes()

      // Act
      req := httptest.NewRequest(http.MethodGet, "/albums", nil)
      w := httptest.NewRecorder()
      mux.ServeHTTP(w, req)

      // Assert
      if w.Code != http.StatusOK {
          t.Errorf("got status %d, want %d", w.Code, http.StatusOK)
      }

      var got []Album
      json.NewDecoder(w.Body).Decode(&got)
      if len(got) != len(testAlbums) {
          t.Errorf("got %d albums, want %d", len(got), len(testAlbums))
      }
  }
  ```

### Gin-Specific Testing

- Set `gin.SetMode(gin.TestMode)` in tests to suppress debug output.

  ```go
  func TestCreateUser(t *testing.T) {
      gin.SetMode(gin.TestMode)

      router := gin.New()
      router.POST("/users", createUserHandler)

      body := `{"name":"Alice","email":"alice@example.com"}`
      req := httptest.NewRequest("POST", "/users", strings.NewReader(body))
      req.Header.Set("Content-Type", "application/json")
      w := httptest.NewRecorder()

      router.ServeHTTP(w, req)

      if w.Code != http.StatusCreated {
          t.Errorf("got status %d, want %d", w.Code, http.StatusCreated)
      }
  }
  ```

- Test middleware in isolation by creating a minimal router with only that middleware.

  ```go
  func TestAuthMiddleware(t *testing.T) {
      gin.SetMode(gin.TestMode)
      r := gin.New()
      r.Use(AuthRequired())
      r.GET("/protected", func(c *gin.Context) {
          c.String(200, "ok")
      })

      // Without token
      w := httptest.NewRecorder()
      req, _ := http.NewRequest("GET", "/protected", nil)
      r.ServeHTTP(w, req)
      if w.Code != http.StatusUnauthorized {
          t.Errorf("expected 401, got %d", w.Code)
      }
  }
  ```

### Table-Driven Tests

- Use table-driven tests for handlers with multiple cases.

  ```go
  func TestGetUser(t *testing.T) {
      tests := []struct {
          name       string
          userID     string
          wantStatus int
      }{
          {"valid user", "123", http.StatusOK},
          {"not found", "999", http.StatusNotFound},
          {"empty id", "", http.StatusBadRequest},
      }
      for _, tt := range tests {
          t.Run(tt.name, func(t *testing.T) {
              req := httptest.NewRequest("GET", "/users/"+tt.userID, nil)
              w := httptest.NewRecorder()
              mux.ServeHTTP(w, req)
              if w.Code != tt.wantStatus {
                  t.Errorf("got %d, want %d", w.Code, tt.wantStatus)
              }
          })
      }
  }
  ```

### Test Organization

- Put test files alongside the code they test: `handler/album.go` → `handler/album_test.go`.
- Use `_test` package suffix for black-box tests (e.g., `package handler_test`), or same package name for white-box tests.
- Use interfaces for dependencies so they can be mocked in tests.

  ```go
  // In production
  h := handler.New(postgres.NewStore(db))

  // In tests
  h := handler.New(&mockStore{})
  ```

## 9. Authentication Patterns

- Use middleware to extract and validate auth tokens. Set user info on the request context.

  ```go
  // Gin
  func AuthMiddleware(secret []byte) gin.HandlerFunc {
      return func(c *gin.Context) {
          tokenStr := c.GetHeader("Authorization")
          if len(tokenStr) < 8 || tokenStr[:7] != "Bearer " {
              c.JSON(http.StatusUnauthorized, gin.H{"error": "missing token"})
              c.Abort()
              return
          }
          claims, err := validateJWT(tokenStr[7:], secret)
          if err != nil {
              c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid token"})
              c.Abort()
              return
          }
          c.Set("userID", claims.UserID)
          c.Next()
      }
  }
  ```

  ```go
  // stdlib net/http
  func authMiddleware(secret []byte, next http.Handler) http.Handler {
      return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
          tokenStr := r.Header.Get("Authorization")
          if len(tokenStr) < 8 || tokenStr[:7] != "Bearer " {
              http.Error(w, "unauthorized", http.StatusUnauthorized)
              return
          }
          claims, err := validateJWT(tokenStr[7:], secret)
          if err != nil {
              http.Error(w, "unauthorized", http.StatusUnauthorized)
              return
          }
          ctx := context.WithValue(r.Context(), userIDKey, claims.UserID)
          next.ServeHTTP(w, r.WithContext(ctx))
      })
  }
  ```

- Use typed context keys to avoid collisions.

  ```go
  type contextKey string
  const userIDKey contextKey = "userID"

  // Set
  ctx := context.WithValue(r.Context(), userIDKey, claims.UserID)

  // Get (with type assertion)
  userID, ok := ctx.Value(userIDKey).(string)
  ```

- Never log or serialize JWT secrets, tokens, or passwords.

## 10. Graceful Shutdown

- Always implement graceful shutdown. Use `signal.NotifyContext` (Go 1.16+) to listen for OS signals, then call `srv.Shutdown(ctx)`.

  ```go
  func main() {
      ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
      defer stop()

      srv := &http.Server{
          Addr:    ":8080",
          Handler: setupRoutes(),
      }

      // Start server in a goroutine
      go func() {
          if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
              slog.Error("server error", "error", err)
          }
      }()

      // Wait for interrupt signal
      <-ctx.Done()
      slog.Info("shutting down gracefully")

      // Give outstanding requests a deadline
      shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
      defer cancel()
      if err := srv.Shutdown(shutdownCtx); err != nil {
          slog.Error("shutdown error", "error", err)
      }
  }
  ```

- For Gin, wrap the gin Engine in an `http.Server` to get access to `Shutdown()`.

  ```go
  router := gin.Default()
  // ... register routes ...

  srv := &http.Server{
      Addr:    ":8080",
      Handler: router,
  }
  // Then use the graceful shutdown pattern above with srv
  ```

- Set read/write timeouts on `http.Server` to prevent slowloris and resource exhaustion.

  ```go
  srv := &http.Server{
      Addr:         ":8080",
      Handler:      mux,
      ReadTimeout:  5 * time.Second,
      WriteTimeout: 10 * time.Second,
      IdleTimeout:  120 * time.Second,
  }
  ```

## 11. Context Propagation

- Pass `context.Context` from the request through all layers (handler → service → store → DB).

  ```go
  // Handler
  func (h *Handler) getUser(w http.ResponseWriter, r *http.Request) {
      user, err := h.store.GetUser(r.Context(), r.PathValue("id"))
      // ...
  }

  // Store
  func (s *Store) GetUser(ctx context.Context, id string) (*User, error) {
      row := s.db.QueryRowContext(ctx, "SELECT id, name FROM users WHERE id = $1", id)
      // ...
  }
  ```

- Never store request-scoped values in global or struct-level context. Always derive from the request context.

- Use `context.WithTimeout` or `context.WithDeadline` for operations that call external services.

  ```go
  ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
  defer cancel()
  resp, err := httpClient.Do(req.WithContext(ctx))
  ```

- Always call `cancel()` returned from `context.WithTimeout`/`WithCancel`, typically via `defer`.

## 12. Dependency Injection

- Use constructor injection via struct fields. Accept interfaces, return structs.

  ```go
  // Define a small interface (consumer-side)
  type UserStore interface {
      GetUser(ctx context.Context, id string) (*User, error)
  }

  // Handler depends on the interface
  type Handler struct {
      store UserStore
  }

  func NewHandler(s UserStore) *Handler {
      return &Handler{store: s}
  }
  ```

  **Why:** Keeps interfaces small ("Go interfaces should be discovered, not designed"). Makes testing trivial — pass a mock that satisfies the interface.

- Keep interfaces small: one to three methods. Prefer many small interfaces over one large one.

  ```go
  // Before (too broad)
  type Store interface {
      GetUser(ctx context.Context, id string) (*User, error)
      CreateUser(ctx context.Context, u *User) error
      ListUsers(ctx context.Context) ([]User, error)
      GetPost(ctx context.Context, id string) (*Post, error)
      CreatePost(ctx context.Context, p *Post) error
      // ... 20 more methods
  }

  // After (focused)
  type UserReader interface {
      GetUser(ctx context.Context, id string) (*User, error)
  }
  type UserWriter interface {
      CreateUser(ctx context.Context, u *User) error
  }
  ```

- Define interfaces where they are **consumed** (in the handler package), not where they are implemented (in the store package).

- Do not use `init()` for setting up dependencies. Wire everything explicitly in `main()`.

## 13. Go Modules and Dependencies

- Run `go mod tidy` regularly to clean up unused dependencies.
- Pin major versions in import paths (e.g., `github.com/gin-gonic/gin` for v1, future v2 would be `.../gin/v2`).
- Use `go mod vendor` if you need reproducible builds in CI without network access.
- Check for vulnerabilities with `go install golang.org/x/vuln/cmd/govulncheck@latest && govulncheck ./...`.
- Keep `go.mod`'s `go` directive at the minimum version you support (e.g., `go 1.22`).

## 14. Common Pitfalls and Anti-Patterns

- **Goroutine leak in handlers**: If you spawn a goroutine that outlives the request, it may leak. Use the request context for cancellation.

  ```go
  // Before (goroutine leak)
  func handler(w http.ResponseWriter, r *http.Request) {
      go func() {
          expensiveWork() // no cancellation, runs forever if request canceled
      }()
  }

  // After
  func handler(w http.ResponseWriter, r *http.Request) {
      go func(ctx context.Context) {
          select {
          case <-ctx.Done():
              return
          case result := <-doWork(ctx):
              // use result
          }
      }(r.Context())
  }
  ```

- **Data race on shared state**: A global variable (like a slice of albums) accessed from concurrent handlers is a data race. Use a mutex or move state to a database.

  ```go
  // Before (race condition)
  var albums []Album
  func addAlbum(c *gin.Context) {
      var a Album
      c.ShouldBindJSON(&a)
      albums = append(albums, a) // DATA RACE
  }

  // After
  var (
      mu     sync.Mutex
      albums []Album
  )
  func addAlbum(c *gin.Context) {
      var a Album
      c.ShouldBindJSON(&a)
      mu.Lock()
      albums = append(albums, a)
      mu.Unlock()
  }
  ```

- **Forgetting to call `c.Abort()`**: In Gin middleware, writing a response does not stop the chain. You must call `c.Abort()` to prevent the handler from executing.

- **Closing response body**: When making HTTP client calls, always close the response body.

  ```go
  resp, err := http.Get(url)
  if err != nil {
      return err
  }
  defer resp.Body.Close()
  ```

- **Shadowing `err`**: Redeclaring `err` with `:=` in inner scopes can silently shadow the outer error. Use `=` when the variable already exists.

  ```go
  // Before (shadowed error)
  var user *User
  if needsCache {
      user, err := cache.Get(id) // err is shadowed — outer err unchanged
      if err != nil { ... }
  }

  // After
  var user *User
  if needsCache {
      var cacheErr error
      user, cacheErr = cache.Get(id) // explicit variable, no shadow
      if cacheErr != nil { ... }
  }
  ```

- **Using `log.Fatal` in handlers**: `log.Fatal` calls `os.Exit(1)`, which kills the entire process and skips deferred functions. Only use it in `main()` during startup.

## 15. Naming Conventions

- **Packages**: Short, lowercase, single-word names. No underscores or mixedCaps (`handler`, not `httpHandler`).
- **Interfaces**: One-method interfaces are named `<Method>er` — `Reader`, `Writer`, `Stringer`.
- **Getters**: Use `Owner()`, not `GetOwner()`. Setters use `SetOwner()`.
- **Exported symbols**: `MixedCaps`. Unexported: `mixedCaps`. Never underscores.
- **Error variables**: `Err` prefix — `ErrNotFound`, `ErrUnauthorized`.
- **Constructors**: `New<Type>()` or just `New()` if the package exports one main type.

## 16. Structured Logging

- Use `log/slog` (Go 1.21+) for structured logging. Avoid `log.Println` and `fmt.Println` in production code.

  ```go
  // Before
  log.Printf("failed to fetch user %s: %v", id, err)

  // After
  slog.Error("failed to fetch user", "userID", id, "error", err)
  ```

- Use `slog.With()` to attach request-scoped fields.

  ```go
  logger := slog.With("requestID", requestID, "userID", userID)
  logger.Info("processing request")
  ```
