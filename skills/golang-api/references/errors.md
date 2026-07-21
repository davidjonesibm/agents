# Error Handling

Go error handling idioms, wrapping, sentinel errors, custom error types, and error response patterns.

## Core Rules

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
  // Before (no context — impossible to debug)
  if err != nil {
      return err
  }

  // After (context added)
  if err != nil {
      return fmt.Errorf("fetching user %s: %w", id, err)
  }
  ```

- Use `errors.Is()` and `errors.As()` for error checking. Never compare error strings.

  ```go
  // Before (fragile string comparison)
  if err.Error() == "not found" { ... }

  // After (robust type/value checking)
  if errors.Is(err, sql.ErrNoRows) { ... }

  var pgErr *pgconn.PgError
  if errors.As(err, &pgErr) && pgErr.Code == "23505" {
      // handle unique constraint violation
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

- Never `panic` in library or handler code. Reserve `panic` for truly unrecoverable situations (e.g., programmer error detected during `init`).

## Sentinel Errors

- Define sentinel errors for your domain at the package level.

  ```go
  package store

  var (
      ErrNotFound  = errors.New("not found")
      ErrConflict  = errors.New("conflict")
      ErrForbidden = errors.New("forbidden")
  )
  ```

- Map domain errors to HTTP status codes at the handler or middleware layer, not in the store.

  ```go
  // In handler
  user, err := h.store.GetUser(ctx, id)
  switch {
  case errors.Is(err, store.ErrNotFound):
      http.Error(w, "user not found", http.StatusNotFound)
      return
  case errors.Is(err, store.ErrForbidden):
      http.Error(w, "forbidden", http.StatusForbidden)
      return
  case err != nil:
      slog.Error("get user failed", "error", err, "id", id)
      http.Error(w, "internal error", http.StatusInternalServerError)
      return
  }
  ```

## Custom Error Types

- Use custom error types when you need to carry structured data with the error.

  ```go
  type ValidationError struct {
      Field   string
      Message string
  }

  func (e *ValidationError) Error() string {
      return fmt.Sprintf("validation: %s — %s", e.Field, e.Message)
  }

  // Usage
  if req.Email == "" {
      return &ValidationError{Field: "email", Message: "required"}
  }

  // Checking
  var valErr *ValidationError
  if errors.As(err, &valErr) {
      c.JSON(http.StatusBadRequest, gin.H{
          "error": valErr.Message,
          "field": valErr.Field,
      })
      return
  }
  ```

- Use `errors.Join` (Go 1.20+) to combine multiple errors from batch operations.

  ```go
  // Before (only returns first error)
  for _, item := range items {
      if err := validate(item); err != nil {
          return err
      }
  }

  // After (collects all errors)
  var errs []error
  for _, item := range items {
      if err := validate(item); err != nil {
          errs = append(errs, err)
      }
  }
  if len(errs) > 0 {
      return errors.Join(errs...)
  }
  ```

## Gin Error Middleware

- In Gin, use error-handling middleware to centralize error responses. Handlers add errors with `c.Error()` and the middleware maps them to HTTP status codes.

  ```go
  func ErrorHandler() gin.HandlerFunc {
      return func(c *gin.Context) {
          c.Next()
          if len(c.Errors) > 0 {
              err := c.Errors.Last().Err
              switch {
              case errors.Is(err, store.ErrNotFound):
                  c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
              case errors.Is(err, store.ErrConflict):
                  c.JSON(http.StatusConflict, gin.H{"error": "conflict"})
              default:
                  slog.Error("unhandled error", "error", err)
                  c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
              }
          }
      }
  }
  ```

## Logging Errors

- Never serialize internal errors or stack traces to the client. Log them server-side and return a generic message. See also `references/security.md` for information leakage rules.

  ```go
  // Before (leaks internals)
  c.JSON(500, gin.H{"error": err.Error()})

  // After (safe)
  slog.Error("failed to fetch user", "error", err, "userID", id)
  c.JSON(500, gin.H{"error": "internal server error"})
  ```

- Use `log/slog` (Go 1.21+) for structured logging. Prefer it over `log.Printf` for production APIs.

  ```go
  // Before (unstructured)
  log.Printf("error fetching user %s: %v", id, err)

  // After (structured, parseable)
  slog.Error("fetch user failed", "userID", id, "error", err)
  ```
