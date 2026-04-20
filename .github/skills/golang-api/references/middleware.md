# Middleware Patterns

Middleware ordering, composition, and implementation for both stdlib `net/http` and Gin.

## stdlib `net/http` Middleware

- Use the handler-wrapping pattern for stdlib middleware. A middleware takes an `http.Handler` and returns an `http.Handler`.

  ```go
  func loggingMiddleware(next http.Handler) http.Handler {
      return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
          start := time.Now()
          next.ServeHTTP(w, r)
          slog.Info("request",
              "method", r.Method,
              "path", r.URL.Path,
              "duration", time.Since(start),
          )
      })
  }
  ```

- Compose middleware by wrapping from outermost to innermost. The first wrapper in the chain executes first.

  ```go
  mux := http.NewServeMux()
  mux.HandleFunc("GET /health", healthHandler)
  mux.HandleFunc("GET /users/{id}", h.getUser)

  // Execution order: logging → auth → recovery → route handler
  handler := loggingMiddleware(authMiddleware(recoveryMiddleware(mux)))
  http.ListenAndServe(":8080", handler)
  ```

- Use a middleware stack helper when you have many middleware.

  ```go
  // Before (deeply nested, hard to read)
  handler := logging(cors(rateLimit(auth(recovery(mux)))))

  // After (readable chain)
  func chain(h http.Handler, middleware ...func(http.Handler) http.Handler) http.Handler {
      for i := len(middleware) - 1; i >= 0; i-- {
          h = middleware[i](h)
      }
      return h
  }

  handler := chain(mux, logging, cors, rateLimit, auth, recovery)
  ```

- To capture the response status code in middleware, wrap `http.ResponseWriter`.

  ```go
  type statusWriter struct {
      http.ResponseWriter
      status int
  }

  func (w *statusWriter) WriteHeader(code int) {
      w.status = code
      w.ResponseWriter.WriteHeader(code)
  }

  func loggingMiddleware(next http.Handler) http.Handler {
      return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
          sw := &statusWriter{ResponseWriter: w, status: http.StatusOK}
          start := time.Now()
          next.ServeHTTP(sw, r)
          slog.Info("request",
              "method", r.Method,
              "path", r.URL.Path,
              "status", sw.status,
              "duration", time.Since(start),
          )
      })
  }
  ```

## Gin Middleware

- Register middleware **before** routes. Middleware registered after a route definition won't apply to that route.

  ```go
  // Before (wrong order — middleware misses /ping)
  r.GET("/ping", pingHandler)
  r.Use(authMiddleware())

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

- Always call `c.Abort()` after writing an error response in middleware. Without it, the next handler still executes.

  ```go
  // Before (handler chain continues after writing 401)
  func authMiddleware() gin.HandlerFunc {
      return func(c *gin.Context) {
          token := c.GetHeader("Authorization")
          if token == "" {
              c.JSON(http.StatusUnauthorized, gin.H{"error": "missing token"})
              return // ✗ next handler still executes!
          }
          c.Next()
      }
  }

  // After (chain stops)
  func authMiddleware() gin.HandlerFunc {
      return func(c *gin.Context) {
          token := c.GetHeader("Authorization")
          if token == "" {
              c.JSON(http.StatusUnauthorized, gin.H{"error": "missing token"})
              c.Abort() // ✓ stops the chain
              return
          }
          c.Next()
      }
  }
  ```

- Use `c.Set()` / `c.Get()` to pass data from middleware to handlers. Use typed helper functions to avoid stringly-typed access.

  ```go
  // Before (stringly-typed, error-prone)
  c.Set("userID", claims.UserID)
  // In handler:
  id := c.MustGet("userID").(string) // panics if wrong type

  // After (typed accessor)
  const userIDKey = "userID"

  func SetUserID(c *gin.Context, id string) {
      c.Set(userIDKey, id)
  }

  func GetUserID(c *gin.Context) (string, bool) {
      val, exists := c.Get(userIDKey)
      if !exists {
          return "", false
      }
      id, ok := val.(string)
      return id, ok
  }
  ```

## Recovery Middleware

- Always use recovery middleware to prevent panics from crashing the server. Use `gin.Recovery()` in Gin or write a custom one for stdlib.

  ```go
  // stdlib recovery middleware
  func recoveryMiddleware(next http.Handler) http.Handler {
      return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
          defer func() {
              if err := recover(); err != nil {
                  slog.Error("panic recovered",
                      "error", err,
                      "stack", string(debug.Stack()),
                  )
                  http.Error(w, "internal server error", http.StatusInternalServerError)
              }
          }()
          next.ServeHTTP(w, r)
      })
  }
  ```

## CORS Middleware

- For Gin, use the `github.com/gin-contrib/cors` package. Never hand-roll CORS header logic.

  ```go
  // Before (incomplete hand-rolled CORS)
  r.Use(func(c *gin.Context) {
      c.Header("Access-Control-Allow-Origin", "*") // too permissive
  })

  // After (proper CORS configuration)
  r.Use(cors.New(cors.Config{
      AllowOrigins:     []string{"https://myapp.example.com"},
      AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
      AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
      AllowCredentials: true,
      MaxAge:           12 * time.Hour,
  }))
  ```

- For stdlib, use `github.com/rs/cors` or set headers carefully in middleware. See also `references/security.md` for CORS security rules.
