# JSON Serialization

Struct tags, `omitempty`, pointer types for PATCH, custom marshaling, and response formatting patterns.

## Struct Tags

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
      ID     string  `json:"id"`
      Name   string  `json:"name"`
      Bio    string  `json:"bio,omitempty"`    // omitted when ""
      Avatar *string `json:"avatar,omitempty"` // omitted when nil
  }
  ```

- Use `-` to exclude fields from JSON entirely.

  ```go
  type User struct {
      ID           string `json:"id"`
      Name         string `json:"name"`
      PasswordHash string `json:"-"` // never serialized
  }
  ```

## Pointer Types for PATCH/Update

- Use pointer types to distinguish between "not provided" and "zero value" in PATCH/update endpoints.

  ```go
  type UpdateUserRequest struct {
      Name *string `json:"name"`
      Age  *int    `json:"age"`
  }

  // In handler:
  if req.Name != nil {
      user.Name = *req.Name // explicitly set, even if empty string
  }
  // If req.Name is nil, the field was not sent — don't update it
  ```

  **Why:** Without pointers, `json.Unmarshal` sets missing fields to their zero value (`""`, `0`, `false`). You can't tell if the client sent `""` or didn't send the field at all.

## Response Formatting

- For stdlib, use `json.NewEncoder(w).Encode()`. Set `Content-Type` before writing the body.

  ```go
  // Before (manual marshal + write — verbose)
  data, err := json.Marshal(user)
  if err != nil {
      http.Error(w, "encode error", 500)
      return
  }
  w.Header().Set("Content-Type", "application/json")
  w.Write(data)

  // After (encoder — simpler)
  w.Header().Set("Content-Type", "application/json")
  json.NewEncoder(w).Encode(user)
  ```

- Create a helper for consistent JSON responses in stdlib APIs.

  ```go
  func writeJSON(w http.ResponseWriter, status int, data any) {
      w.Header().Set("Content-Type", "application/json")
      w.WriteHeader(status)
      if err := json.NewEncoder(w).Encode(data); err != nil {
          slog.Error("failed to encode response", "error", err)
      }
  }

  // Usage
  writeJSON(w, http.StatusOK, user)
  writeJSON(w, http.StatusCreated, map[string]any{"id": user.ID})
  ```

- In Gin, use `c.JSON()` for compact or `c.IndentedJSON()` for debug-friendly output. Never use `c.IndentedJSON()` in production — it's slower and wastes bandwidth.

## Error Responses

- Never serialize internal errors or stack traces to the client. See also `references/errors.md`.

  ```go
  // Before (leaks internals)
  c.JSON(500, gin.H{"error": err.Error()})

  // After (safe)
  slog.Error("failed to fetch user", "error", err, "userID", id)
  c.JSON(500, gin.H{"error": "internal server error"})
  ```

- Use a consistent error response structure across your API.

  ```go
  type ErrorResponse struct {
      Error   string `json:"error"`
      Details any    `json:"details,omitempty"`
  }

  // Usage
  writeJSON(w, http.StatusBadRequest, ErrorResponse{
      Error:   "validation failed",
      Details: validationErrors,
  })
  ```

## Custom Marshaling

- Implement `json.Marshaler` only when struct tags are insufficient. Prefer struct tags for simple cases.

  ```go
  // Custom time format
  type Event struct {
      Name string    `json:"name"`
      Date time.Time `json:"date"`
  }

  func (e Event) MarshalJSON() ([]byte, error) {
      type Alias Event
      return json.Marshal(&struct {
          Alias
          Date string `json:"date"`
      }{
          Alias: Alias(e),
          Date:  e.Date.Format("2006-01-02"),
      })
  }
  ```

  **Why:** The `Alias` type trick prevents infinite recursion when calling `json.Marshal` inside `MarshalJSON`.

## Numeric Precision

- Use `json.Number` or string types for precise numeric values (e.g., monetary amounts) to avoid floating-point loss.

  ```go
  // Before (precision loss on large integers)
  type Order struct {
      Amount float64 `json:"amount"` // 99999999999999.99 loses precision
  }

  // After (string representation preserves precision)
  type Order struct {
      Amount string `json:"amount"` // "99999999999999.99"
  }
  ```
