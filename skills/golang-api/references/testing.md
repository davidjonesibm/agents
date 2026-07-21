# Testing Patterns

HTTP handler tests, Gin-specific testing, table-driven tests, test organization, mocking, and integration test patterns.

## HTTP Handler Tests (stdlib)

- Use `net/http/httptest` for handler tests. Create a request, record the response, and assert.

  ```go
  func TestGetUser(t *testing.T) {
      store := &mockStore{users: map[string]*User{
          "123": {ID: "123", Name: "Alice"},
      }}
      h := handler.NewHandler(store)
      mux := h.Routes()

      req := httptest.NewRequest(http.MethodGet, "/users/123", nil)
      w := httptest.NewRecorder()
      mux.ServeHTTP(w, req)

      if w.Code != http.StatusOK {
          t.Errorf("got status %d, want %d", w.Code, http.StatusOK)
      }

      var got User
      json.NewDecoder(w.Body).Decode(&got)
      if got.Name != "Alice" {
          t.Errorf("got name %q, want %q", got.Name, "Alice")
      }
  }
  ```

- Test both success and error paths. Always test at least: 200 response, 404 for missing resources, 400 for invalid input, 401/403 for auth failures.

## Gin-Specific Testing

- Set `gin.SetMode(gin.TestMode)` in tests to suppress debug output.

  ```go
  func TestCreateUser(t *testing.T) {
      gin.SetMode(gin.TestMode)

      store := &mockStore{}
      h := handler.NewHandler(store)
      router := gin.New()
      h.RegisterRoutes(router)

      body := `{"name":"Alice","email":"alice@example.com"}`
      req := httptest.NewRequest("POST", "/users",
          strings.NewReader(body))
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
  func TestAuthMiddleware_NoToken(t *testing.T) {
      gin.SetMode(gin.TestMode)
      r := gin.New()
      r.Use(AuthRequired())
      r.GET("/protected", func(c *gin.Context) {
          c.String(200, "ok")
      })

      w := httptest.NewRecorder()
      req := httptest.NewRequest("GET", "/protected", nil)
      r.ServeHTTP(w, req)

      if w.Code != http.StatusUnauthorized {
          t.Errorf("expected 401, got %d", w.Code)
      }
  }
  ```

## Table-Driven Tests

- Use table-driven tests for handlers with multiple input/output combinations.

  ```go
  func TestGetUser(t *testing.T) {
      h := setupTestHandler()
      mux := h.Routes()

      tests := []struct {
          name       string
          path       string
          wantStatus int
          wantBody   string
      }{
          {"valid user", "/users/123", http.StatusOK, ""},
          {"not found", "/users/999", http.StatusNotFound, ""},
          {"invalid id", "/users/abc", http.StatusBadRequest, ""},
      }
      for _, tt := range tests {
          t.Run(tt.name, func(t *testing.T) {
              req := httptest.NewRequest("GET", tt.path, nil)
              w := httptest.NewRecorder()
              mux.ServeHTTP(w, req)
              if w.Code != tt.wantStatus {
                  t.Errorf("got %d, want %d", w.Code, tt.wantStatus)
              }
          })
      }
  }
  ```

- Name test cases descriptively — they appear in `go test -v` output.

## Mocking

- Use interfaces for dependencies so they can be replaced with mocks in tests. See also `references/patterns.md` for interface design.

  ```go
  // In production
  h := handler.NewHandler(postgres.NewStore(db))

  // In tests
  h := handler.NewHandler(&mockStore{})
  ```

- Write mocks by hand for small interfaces. Avoid code generation for interfaces with 1–3 methods.

  ```go
  type mockStore struct {
      users map[string]*User
      err   error // set to simulate errors
  }

  func (m *mockStore) GetUser(ctx context.Context, id string) (*User, error) {
      if m.err != nil {
          return nil, m.err
      }
      u, ok := m.users[id]
      if !ok {
          return nil, store.ErrNotFound
      }
      return u, nil
  }
  ```

- Test error paths by injecting errors via mock fields.

  ```go
  func TestGetUser_DBError(t *testing.T) {
      h := handler.NewHandler(&mockStore{
          err: errors.New("connection refused"),
      })
      mux := h.Routes()

      req := httptest.NewRequest("GET", "/users/123", nil)
      w := httptest.NewRecorder()
      mux.ServeHTTP(w, req)

      if w.Code != http.StatusInternalServerError {
          t.Errorf("got %d, want 500", w.Code)
      }
  }
  ```

## Test Organization

- Put test files alongside the code they test: `handler/user.go` → `handler/user_test.go`.

- Use `_test` package suffix for black-box tests (testing the public API), or same package name for white-box tests (testing internals).

  ```go
  // Black-box test (recommended for handlers)
  package handler_test

  // White-box test (for testing private helpers)
  package handler
  ```

- Use `TestMain` for setup/teardown shared by all tests in a package.

  ```go
  func TestMain(m *testing.M) {
      // Setup
      db := setupTestDB()
      defer db.Close()

      os.Exit(m.Run())
  }
  ```

## Integration Tests

- Use build tags to separate integration tests from unit tests.

  ```go
  //go:build integration

  package store_test

  func TestPostgresStore_CreateUser(t *testing.T) {
      db := connectTestDB(t)
      s := postgres.NewStore(db)

      user := &User{Name: "Alice", Email: "alice@test.com"}
      err := s.CreateUser(context.Background(), user)
      if err != nil {
          t.Fatalf("create user: %v", err)
      }

      got, err := s.GetUser(context.Background(), user.ID)
      if err != nil {
          t.Fatalf("get user: %v", err)
      }
      if got.Name != user.Name {
          t.Errorf("got %q, want %q", got.Name, user.Name)
      }
  }
  ```

  Run with: `go test -tags integration ./...`

- Use `t.Cleanup` for per-test teardown instead of `defer` — it runs even if the test calls `t.Fatal`.

  ```go
  func setupTestUser(t *testing.T, db *sql.DB) *User {
      t.Helper()
      user := &User{ID: uuid.NewString(), Name: "test"}
      _, err := db.Exec("INSERT INTO users (id, name) VALUES ($1, $2)",
          user.ID, user.Name)
      if err != nil {
          t.Fatalf("setup user: %v", err)
      }
      t.Cleanup(func() {
          db.Exec("DELETE FROM users WHERE id = $1", user.ID)
      })
      return user
  }
  ```

## Test Helpers

- Mark helper functions with `t.Helper()` so test failures report the caller's line, not the helper's.

  ```go
  func assertStatus(t *testing.T, got, want int) {
      t.Helper()
      if got != want {
          t.Errorf("status = %d, want %d", got, want)
      }
  }

  func assertJSON(t *testing.T, body *bytes.Buffer, target any) {
      t.Helper()
      if err := json.NewDecoder(body).Decode(target); err != nil {
          t.Fatalf("decode JSON: %v", err)
      }
  }
  ```
