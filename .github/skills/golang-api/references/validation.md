# Request Validation and Data Binding

Input validation patterns for both Gin binding tags and stdlib `net/http` manual validation.

## Gin Binding

- Use `ShouldBindJSON` instead of `BindJSON`. `BindJSON` auto-responds with 400 on failure, which limits your control over error responses.

  ```go
  // Before (less control — BindJSON writes its own 400)
  if err := c.BindJSON(&req); err != nil {
      return
  }

  // After (full control over error response)
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

- Use `ShouldBindUri` to bind and validate path parameters directly into a struct.

  ```go
  type UserParams struct {
      ID string `uri:"id" binding:"required,uuid"`
  }

  func (h *Handler) getUser(c *gin.Context) {
      var params UserParams
      if err := c.ShouldBindUri(&params); err != nil {
          c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user ID"})
          return
      }
      user, err := h.store.GetUser(c.Request.Context(), params.ID)
      // ...
  }
  ```

- Use `ShouldBindQuery` for query parameter validation.

  ```go
  type ListParams struct {
      Page     int    `form:"page" binding:"gte=1"`
      PageSize int    `form:"page_size" binding:"gte=1,lte=100"`
      Sort     string `form:"sort" binding:"omitempty,oneof=name created_at"`
  }

  func (h *Handler) listUsers(c *gin.Context) {
      var params ListParams
      params.Page = 1       // defaults
      params.PageSize = 20
      if err := c.ShouldBindQuery(&params); err != nil {
          c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
          return
      }
      // ...
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
      Name  string `json:"name"`  // ✓ binds correctly
      email string `json:"email"` // ✗ silently ignored — unexported
  }
  ```

## stdlib `net/http` Validation

- For stdlib, decode JSON with `json.NewDecoder` and validate manually or with a validation library.

  ```go
  func (h *Handler) createUser(w http.ResponseWriter, r *http.Request) {
      var req CreateUserRequest
      if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
          http.Error(w, "invalid JSON", http.StatusBadRequest)
          return
      }
      if req.Name == "" {
          http.Error(w, "name is required", http.StatusBadRequest)
          return
      }
      if !isValidEmail(req.Email) {
          http.Error(w, "invalid email", http.StatusBadRequest)
          return
      }
      // ... proceed
  }
  ```

- Limit request body size to prevent denial-of-service via large payloads.

  ```go
  // Before (no limit — client can send gigabytes)
  json.NewDecoder(r.Body).Decode(&req)

  // After (1 MB limit)
  r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
  if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
      http.Error(w, "request too large", http.StatusRequestEntityTooLarge)
      return
  }
  ```

- Disallow unknown fields to catch typos and prevent unexpected input.

  ```go
  dec := json.NewDecoder(r.Body)
  dec.DisallowUnknownFields()
  if err := dec.Decode(&req); err != nil {
      http.Error(w, "invalid request body", http.StatusBadRequest)
      return
  }
  ```

## Validation Helper Pattern

- Create a reusable validation helper to standardize error responses across endpoints.

  ```go
  type ValidationErrors []ValidationError

  type ValidationError struct {
      Field   string `json:"field"`
      Message string `json:"message"`
  }

  func (v ValidationErrors) Error() string {
      msgs := make([]string, len(v))
      for i, e := range v {
          msgs[i] = e.Field + ": " + e.Message
      }
      return strings.Join(msgs, "; ")
  }

  func (req *CreateUserRequest) Validate() error {
      var errs ValidationErrors
      if req.Name == "" {
          errs = append(errs, ValidationError{"name", "required"})
      }
      if len(req.Name) > 100 {
          errs = append(errs, ValidationError{"name", "max 100 characters"})
      }
      if len(errs) > 0 {
          return errs
      }
      return nil
  }
  ```

  See also `references/errors.md` for custom error type patterns.
