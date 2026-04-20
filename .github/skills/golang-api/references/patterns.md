# Project Structure and Routing Patterns

Idiomatic project layout, HTTP routing (stdlib `net/http` Go 1.22+ and Gin), handler design, and dependency injection patterns for Go APIs.

## Project Structure

- Use the standard Go server layout. Keep server internals in `internal/`, entry points in `cmd/`.

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
        user.go
        user_test.go
      model/
        user.go
      store/
        user.go
        user_test.go
      middleware/
        auth.go
        logging.go
  ```

  **Why:** `internal/` prevents external imports of server internals. `cmd/` separates entry points from logic.

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

- Do not use `init()` for setting up dependencies. Wire everything explicitly in `main()`.

  ```go
  // Before (hidden initialization)
  var db *sql.DB

  func init() {
      var err error
      db, err = sql.Open("postgres", os.Getenv("DATABASE_URL"))
      if err != nil {
          log.Fatal(err)
      }
  }

  // After (explicit wiring in main)
  func main() {
      db, err := sql.Open("postgres", os.Getenv("DATABASE_URL"))
      if err != nil {
          log.Fatal(err)
      }
      defer db.Close()

      h := handler.New(db)
      // ...
  }
  ```

## Routing — stdlib `net/http` (Go 1.22+)

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

- Always use `http.NewServeMux()` instead of `http.DefaultServeMux` to avoid global state and route collisions.

  ```go
  // Before (global mux — collisions in tests)
  http.HandleFunc("GET /health", healthHandler)
  http.ListenAndServe(":8080", nil)

  // After (isolated mux)
  mux := http.NewServeMux()
  mux.HandleFunc("GET /health", healthHandler)
  http.ListenAndServe(":8080", mux)
  ```

## Routing — Gin Framework

- Use `gin.New()` instead of `gin.Default()` when you want explicit control over middleware. `gin.Default()` adds Logger and Recovery middleware automatically.

  ```go
  // Default (includes logger + recovery)
  r := gin.Default()

  // Explicit control (add only what you need)
  r := gin.New()
  r.Use(gin.Recovery())
  r.Use(customLogger())
  ```

- Use route groups for versioned APIs and path prefixes.

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

## Handler Design

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

- For stdlib handlers, follow the same pattern — parse, delegate, respond.

  ```go
  func (h *Handler) getUser(w http.ResponseWriter, r *http.Request) {
      id := r.PathValue("id")
      user, err := h.store.GetUser(r.Context(), id)
      if errors.Is(err, store.ErrNotFound) {
          http.Error(w, "user not found", http.StatusNotFound)
          return
      }
      if err != nil {
          slog.Error("get user failed", "error", err, "id", id)
          http.Error(w, "internal error", http.StatusInternalServerError)
          return
      }
      w.Header().Set("Content-Type", "application/json")
      json.NewEncoder(w).Encode(user)
  }
  ```

## Dependency Injection

- Use constructor injection via struct fields. Accept interfaces, return structs.

  ```go
  type UserStore interface {
      GetUser(ctx context.Context, id string) (*User, error)
  }

  type Handler struct {
      store UserStore
  }

  func NewHandler(s UserStore) *Handler {
      return &Handler{store: s}
  }
  ```

  **Why:** Keeps interfaces small. Makes testing trivial — pass a mock that satisfies the interface.

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

- Use the functional options pattern for complex configuration.

  ```go
  type Server struct {
      addr         string
      readTimeout  time.Duration
      writeTimeout time.Duration
  }

  type Option func(*Server)

  func WithAddr(addr string) Option {
      return func(s *Server) { s.addr = addr }
  }

  func WithReadTimeout(d time.Duration) Option {
      return func(s *Server) { s.readTimeout = d }
  }

  func NewServer(opts ...Option) *Server {
      s := &Server{
          addr:         ":8080",
          readTimeout:  5 * time.Second,
          writeTimeout: 10 * time.Second,
      }
      for _, opt := range opts {
          opt(s)
      }
      return s
  }
  ```

## Go Modules

- Run `go mod tidy` regularly to clean up unused dependencies.
- Pin major versions in import paths (e.g., `github.com/gin-gonic/gin` for v1, future v2 would be `.../gin/v2`).
- Use `go mod vendor` if you need reproducible builds in CI without network access.
- Check for vulnerabilities with `govulncheck ./...`.
- Keep `go.mod`'s `go` directive at the minimum version you support.
