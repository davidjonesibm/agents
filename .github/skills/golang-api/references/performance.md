# Performance and Reliability

Graceful shutdown, context propagation, timeouts, goroutine leaks, data races, HTTP client patterns, and server configuration.

## Graceful Shutdown

- Always implement graceful shutdown. Use `signal.NotifyContext` (Go 1.16+) to listen for OS signals, then call `srv.Shutdown(ctx)`.

  ```go
  func main() {
      ctx, stop := signal.NotifyContext(context.Background(),
          os.Interrupt, syscall.SIGTERM)
      defer stop()

      srv := &http.Server{
          Addr:    ":8080",
          Handler: setupRoutes(),
      }

      go func() {
          if err := srv.ListenAndServe(); err != nil &&
              !errors.Is(err, http.ErrServerClosed) {
              slog.Error("server error", "error", err)
          }
      }()

      <-ctx.Done()
      slog.Info("shutting down gracefully")

      shutdownCtx, cancel := context.WithTimeout(
          context.Background(), 10*time.Second)
      defer cancel()
      if err := srv.Shutdown(shutdownCtx); err != nil {
          slog.Error("shutdown error", "error", err)
      }
  }
  ```

- For Gin, wrap the `gin.Engine` in an `http.Server` to get access to `Shutdown()`.

  ```go
  router := gin.Default()
  // ... register routes ...

  srv := &http.Server{
      Addr:    ":8080",
      Handler: router,
  }
  // Use the graceful shutdown pattern above with srv
  ```

## Server Timeouts

- Set read/write/idle timeouts on `http.Server` to prevent slowloris attacks and resource exhaustion.

  ```go
  // Before (no timeouts — vulnerable to slowloris)
  http.ListenAndServe(":8080", mux)

  // After (hardened)
  srv := &http.Server{
      Addr:         ":8080",
      Handler:      mux,
      ReadTimeout:  5 * time.Second,
      WriteTimeout: 10 * time.Second,
      IdleTimeout:  120 * time.Second,
  }
  srv.ListenAndServe()
  ```

  **Why:** Without `ReadTimeout`, a client can hold a connection open indefinitely by sending headers slowly. Without `WriteTimeout`, a handler that blocks forever ties up a goroutine.

## Context Propagation

- Pass `context.Context` from the request through all layers (handler → service → store → external call).

  ```go
  // Handler
  func (h *Handler) getUser(w http.ResponseWriter, r *http.Request) {
      user, err := h.store.GetUser(r.Context(), r.PathValue("id"))
      // ...
  }

  // Store
  func (s *Store) GetUser(ctx context.Context, id string) (*User, error) {
      row := s.db.QueryRowContext(ctx,
          "SELECT id, name FROM users WHERE id = $1", id)
      // ...
  }
  ```

- Never store request-scoped values in global or struct-level context. Always derive from the request context.

- Use `context.WithTimeout` for operations that call external services.

  ```go
  ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
  defer cancel()
  resp, err := httpClient.Do(req.WithContext(ctx))
  ```

- Always call `cancel()` returned from `context.WithTimeout`/`WithCancel`, typically via `defer`. Failing to do so leaks goroutines.

## HTTP Client Best Practices

- Never use `http.DefaultClient` in production — it has no timeout.

  ```go
  // Before (no timeout — can hang forever)
  resp, err := http.Get("https://api.example.com/data")

  // After (explicit timeout)
  client := &http.Client{
      Timeout: 10 * time.Second,
  }
  resp, err := client.Get("https://api.example.com/data")
  ```

- Always close the response body when making HTTP client calls.

  ```go
  resp, err := client.Do(req)
  if err != nil {
      return fmt.Errorf("request failed: %w", err)
  }
  defer resp.Body.Close()
  ```

- Reuse `http.Client` instances across requests. Creating a new client per request wastes connection pooling.

  ```go
  // Before (new client per request — no connection reuse)
  func callAPI() error {
      client := &http.Client{Timeout: 5 * time.Second}
      resp, err := client.Get(url)
      // ...
  }

  // After (shared client)
  type Service struct {
      client *http.Client
  }

  func NewService() *Service {
      return &Service{
          client: &http.Client{Timeout: 10 * time.Second},
      }
  }
  ```

## Goroutine Leaks

- If you spawn a goroutine from a handler, use the request context for cancellation. Without it, the goroutine outlives the request.

  ```go
  // Before (goroutine leak — runs forever if request canceled)
  func handler(w http.ResponseWriter, r *http.Request) {
      go func() {
          expensiveWork()
      }()
  }

  // After (respects cancellation)
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

- Prefer sending work to a background worker pool rather than spawning unbounded goroutines from handlers.

## Data Races

- A global variable accessed from concurrent handlers is a data race. Use a mutex or move state to a database.

  ```go
  // Before (DATA RACE — concurrent append)
  var items []Item
  func addItem(c *gin.Context) {
      var item Item
      c.ShouldBindJSON(&item)
      items = append(items, item) // RACE CONDITION
  }

  // After (mutex-protected)
  var (
      mu    sync.Mutex
      items []Item
  )
  func addItem(c *gin.Context) {
      var item Item
      c.ShouldBindJSON(&item)
      mu.Lock()
      items = append(items, item)
      mu.Unlock()
  }
  ```

- Use `sync.RWMutex` when reads vastly outnumber writes — `RLock` allows concurrent readers.

- Run tests with `-race` flag to detect data races: `go test -race ./...`.

## Memory and Allocation

- Pre-allocate slices when the size is known to avoid repeated allocation.

  ```go
  // Before (grows 5 times for 100 items)
  var users []User
  for rows.Next() {
      var u User
      rows.Scan(&u.ID, &u.Name)
      users = append(users, u)
  }

  // After (single allocation)
  users := make([]User, 0, expectedCount)
  ```

- Use `sync.Pool` for frequently allocated and discarded objects (e.g., byte buffers) in hot paths.

  ```go
  var bufPool = sync.Pool{
      New: func() any { return new(bytes.Buffer) },
  }

  func handler(w http.ResponseWriter, r *http.Request) {
      buf := bufPool.Get().(*bytes.Buffer)
      defer func() {
          buf.Reset()
          bufPool.Put(buf)
      }()
      // use buf
  }
  ```

## Health Checks

- Expose `/health` or `/healthz` for liveness probes and `/ready` for readiness probes.

  ```go
  mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
      w.WriteHeader(http.StatusOK)
      w.Write([]byte("ok"))
  })

  mux.HandleFunc("GET /ready", func(w http.ResponseWriter, r *http.Request) {
      if err := db.PingContext(r.Context()); err != nil {
          http.Error(w, "not ready", http.StatusServiceUnavailable)
          return
      }
      w.WriteHeader(http.StatusOK)
      w.Write([]byte("ready"))
  })
  ```
