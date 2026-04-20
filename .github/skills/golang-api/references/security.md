# Security Best Practices

Authentication, JWT middleware, typed context keys, CORS, rate limiting, security headers, and information leakage prevention.

## Authentication Middleware

- Use middleware to extract and validate auth tokens. Set user info on the request context.

  ```go
  // Gin JWT middleware
  func AuthMiddleware(secret []byte) gin.HandlerFunc {
      return func(c *gin.Context) {
          header := c.GetHeader("Authorization")
          if !strings.HasPrefix(header, "Bearer ") {
              c.JSON(http.StatusUnauthorized, gin.H{"error": "missing token"})
              c.Abort()
              return
          }
          claims, err := validateJWT(header[7:], secret)
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
  // stdlib net/http JWT middleware
  func authMiddleware(secret []byte, next http.Handler) http.Handler {
      return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
          header := r.Header.Get("Authorization")
          if !strings.HasPrefix(header, "Bearer ") {
              http.Error(w, "unauthorized", http.StatusUnauthorized)
              return
          }
          claims, err := validateJWT(header[7:], secret)
          if err != nil {
              http.Error(w, "unauthorized", http.StatusUnauthorized)
              return
          }
          ctx := context.WithValue(r.Context(), userIDKey, claims.UserID)
          next.ServeHTTP(w, r.WithContext(ctx))
      })
  }
  ```

## Typed Context Keys

- Use typed context keys to avoid key collisions. Never use plain strings.

  ```go
  // Before (collision-prone)
  ctx = context.WithValue(ctx, "userID", claims.UserID)

  // After (type-safe)
  type contextKey string
  const userIDKey contextKey = "userID"

  ctx = context.WithValue(r.Context(), userIDKey, claims.UserID)

  // Retrieve with type assertion
  userID, ok := ctx.Value(userIDKey).(string)
  if !ok {
      http.Error(w, "unauthorized", http.StatusUnauthorized)
      return
  }
  ```

## Secret Management

- Never hardcode secrets, API keys, or database credentials. Use environment variables or a secret manager.

  ```go
  // Before (secret in source code — CRITICAL)
  var jwtSecret = []byte("my-super-secret-key")

  // After (from environment)
  secret := os.Getenv("JWT_SECRET")
  if secret == "" {
      log.Fatal("JWT_SECRET is required")
  }
  ```

- Never log or serialize JWT tokens, passwords, or API keys.

  ```go
  // Before (logs the token — CRITICAL)
  slog.Info("auth", "token", tokenString)

  // After (log only non-sensitive context)
  slog.Info("auth", "userID", claims.UserID)
  ```

## Information Leakage

- Never serialize internal errors, stack traces, or database error messages to the client. See also `references/errors.md`.

  ```go
  // Before (leaks SQL error with table/column names)
  w.Write([]byte(err.Error()))

  // After (generic message to client, detailed log)
  slog.Error("query failed", "error", err, "query", "GetUser")
  http.Error(w, "internal server error", http.StatusInternalServerError)
  ```

- Use response DTOs to prevent accidentally serializing internal fields (password hashes, internal IDs, admin flags).

  ```go
  // Before (returns DB model directly — leaks password hash)
  c.JSON(200, user)

  // After (explicit response DTO)
  type UserResponse struct {
      ID    string `json:"id"`
      Name  string `json:"name"`
      Email string `json:"email"`
  }

  c.JSON(200, UserResponse{
      ID:    user.ID,
      Name:  user.Name,
      Email: user.Email,
  })
  ```

## CORS

- Never use `Access-Control-Allow-Origin: *` with credentials. Configure CORS with specific allowed origins.

  ```go
  // Before (too permissive — allows any origin)
  w.Header().Set("Access-Control-Allow-Origin", "*")

  // After (specific origins)
  allowedOrigins := map[string]bool{
      "https://myapp.example.com": true,
      "https://admin.example.com": true,
  }
  origin := r.Header.Get("Origin")
  if allowedOrigins[origin] {
      w.Header().Set("Access-Control-Allow-Origin", origin)
      w.Header().Set("Vary", "Origin")
  }
  ```

  See also `references/middleware.md` for CORS middleware package recommendations.

## Security Headers

- Set security headers in middleware for all responses.

  ```go
  func securityHeaders(next http.Handler) http.Handler {
      return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
          w.Header().Set("X-Content-Type-Options", "nosniff")
          w.Header().Set("X-Frame-Options", "DENY")
          w.Header().Set("Content-Security-Policy", "default-src 'none'")
          w.Header().Set("Strict-Transport-Security",
              "max-age=63072000; includeSubDomains")
          next.ServeHTTP(w, r)
      })
  }
  ```

## Rate Limiting

- Use rate limiting middleware to prevent abuse. Use `golang.org/x/time/rate` for token bucket limiting.

  ```go
  func rateLimitMiddleware(rps float64, burst int) func(http.Handler) http.Handler {
      limiter := rate.NewLimiter(rate.Limit(rps), burst)
      return func(next http.Handler) http.Handler {
          return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
              if !limiter.Allow() {
                  http.Error(w, "too many requests", http.StatusTooManyRequests)
                  return
              }
              next.ServeHTTP(w, r)
          })
      }
  }
  ```

- For per-client rate limiting, use a map of limiters keyed by IP or API key. Protect with a mutex and clean up expired entries.

  ```go
  type clientLimiter struct {
      mu       sync.Mutex
      clients  map[string]*rate.Limiter
      rps      float64
      burst    int
  }

  func (cl *clientLimiter) getLimiter(key string) *rate.Limiter {
      cl.mu.Lock()
      defer cl.mu.Unlock()
      lim, ok := cl.clients[key]
      if !ok {
          lim = rate.NewLimiter(rate.Limit(cl.rps), cl.burst)
          cl.clients[key] = lim
      }
      return lim
  }
  ```

## Input Sanitization

- Validate and bound all input at the handler boundary. See `references/validation.md` for detailed patterns.
- For file uploads, validate content type and limit file size.

  ```go
  // Limit upload size to 10 MB
  r.Body = http.MaxBytesReader(w, r.Body, 10<<20)
  if err := r.ParseMultipartForm(10 << 20); err != nil {
      http.Error(w, "file too large", http.StatusRequestEntityTooLarge)
      return
  }
  ```
