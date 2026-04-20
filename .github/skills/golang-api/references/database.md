# Database Access Patterns

`database/sql` patterns, context propagation, connection pooling, transactions, parameterized queries, and repository design.

## Context Propagation

- Accept `context.Context` as the first parameter in all store/repository methods. Propagate the request context.

  ```go
  type UserStore interface {
      GetUser(ctx context.Context, id string) (*User, error)
      CreateUser(ctx context.Context, u *User) error
      ListUsers(ctx context.Context, opts ListOptions) ([]User, error)
  }
  ```

- Use `QueryContext`, `ExecContext`, and `QueryRowContext` — never the non-context variants.

  ```go
  // Before (no context — can't cancel on client disconnect)
  row := db.QueryRow("SELECT name FROM users WHERE id = $1", id)

  // After (respects request context)
  row := db.QueryRowContext(ctx, "SELECT name FROM users WHERE id = $1", id)
  ```

  See also `references/performance.md` for context timeout patterns.

## Query Patterns

- Always close `*sql.Rows` with `defer rows.Close()` and check `rows.Err()` after the loop.

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
  if err := rows.Err(); err != nil {
      return nil, fmt.Errorf("iterating users: %w", err)
  }
  return users, nil
  ```

  **Why:** `rows.Err()` catches errors from the database driver that occur during iteration (network issues, context cancellation). Skipping it silently drops rows.

- Use `QueryRowContext` for single-row queries. Check for `sql.ErrNoRows` and map it to your domain error.

  ```go
  func (s *Store) GetUser(ctx context.Context, id string) (*User, error) {
      var u User
      err := s.db.QueryRowContext(ctx,
          "SELECT id, name, email FROM users WHERE id = $1", id,
      ).Scan(&u.ID, &u.Name, &u.Email)
      if errors.Is(err, sql.ErrNoRows) {
          return nil, ErrNotFound
      }
      if err != nil {
          return nil, fmt.Errorf("get user %s: %w", id, err)
      }
      return &u, nil
  }
  ```

## SQL Injection Prevention

- Always use parameterized queries. Never interpolate user input into query strings.

  ```go
  // Before (SQL injection vulnerability — CRITICAL)
  query := fmt.Sprintf("SELECT * FROM users WHERE name = '%s'", name)
  rows, err := db.QueryContext(ctx, query)

  // After (parameterized — safe)
  rows, err := db.QueryContext(ctx,
      "SELECT * FROM users WHERE name = $1", name,
  )
  ```

- For dynamic queries (e.g., optional filters, dynamic ORDER BY), build the query safely with a query builder or whitelisted column names.

  ```go
  // Before (dynamic column — injection risk)
  query := fmt.Sprintf("SELECT * FROM users ORDER BY %s", sortColumn)

  // After (whitelist valid columns)
  validColumns := map[string]bool{
      "name": true, "created_at": true, "email": true,
  }
  if !validColumns[sortColumn] {
      return nil, fmt.Errorf("invalid sort column: %s", sortColumn)
  }
  query := fmt.Sprintf("SELECT * FROM users ORDER BY %s", sortColumn)
  ```

  See also `references/security.md` for broader input sanitization rules.

## Connection Pooling

- Configure connection pool settings explicitly. The defaults (`MaxOpenConns=0` means unlimited) are rarely appropriate for production.

  ```go
  db, err := sql.Open("postgres", dsn)
  if err != nil {
      return nil, fmt.Errorf("open db: %w", err)
  }

  db.SetMaxOpenConns(25)                 // limit concurrent connections
  db.SetMaxIdleConns(10)                 // keep warm connections ready
  db.SetConnMaxLifetime(5 * time.Minute) // prevent stale connections
  db.SetConnMaxIdleTime(1 * time.Minute) // close long-idle connections
  ```

- Always verify the connection works after opening.

  ```go
  if err := db.PingContext(ctx); err != nil {
      return nil, fmt.Errorf("ping db: %w", err)
  }
  ```

## Transactions

- Use `db.BeginTx` with the request context. Always defer a rollback — it's a no-op after commit.

  ```go
  func (s *Store) TransferFunds(ctx context.Context, from, to string, amount int) error {
      tx, err := s.db.BeginTx(ctx, nil)
      if err != nil {
          return fmt.Errorf("begin tx: %w", err)
      }
      defer tx.Rollback() // no-op after Commit

      _, err = tx.ExecContext(ctx,
          "UPDATE accounts SET balance = balance - $1 WHERE id = $2", amount, from)
      if err != nil {
          return fmt.Errorf("debit %s: %w", from, err)
      }

      _, err = tx.ExecContext(ctx,
          "UPDATE accounts SET balance = balance + $1 WHERE id = $2", amount, to)
      if err != nil {
          return fmt.Errorf("credit %s: %w", to, err)
      }

      if err := tx.Commit(); err != nil {
          return fmt.Errorf("commit transfer: %w", err)
      }
      return nil
  }
  ```

- For complex transactions, use a helper function to reduce boilerplate.

  ```go
  func withTx(ctx context.Context, db *sql.DB, fn func(tx *sql.Tx) error) error {
      tx, err := db.BeginTx(ctx, nil)
      if err != nil {
          return fmt.Errorf("begin tx: %w", err)
      }
      defer tx.Rollback()

      if err := fn(tx); err != nil {
          return err
      }
      return tx.Commit()
  }

  // Usage
  err := withTx(ctx, db, func(tx *sql.Tx) error {
      // all operations inside transaction
      _, err := tx.ExecContext(ctx, "INSERT INTO ...", args...)
      return err
  })
  ```

## pgx and sqlx

- Use `pgx` or `sqlx` for more ergonomic database access, but understand `database/sql` fundamentals first.
- `sqlx` adds struct scanning (`StructScan`, `Select`, `Get`) — reduces boilerplate.

  ```go
  // database/sql (verbose)
  var u User
  err := row.Scan(&u.ID, &u.Name, &u.Email)

  // sqlx (struct scanning)
  var u User
  err := db.GetContext(ctx, &u, "SELECT id, name, email FROM users WHERE id = $1", id)
  ```

- `pgx` is a PostgreSQL-specific driver with better performance and native type support. Use it directly (not via `database/sql`) for PostgreSQL projects.

  ```go
  // pgx native (batch queries, COPY, listen/notify)
  pool, err := pgxpool.New(ctx, os.Getenv("DATABASE_URL"))
  ```

## Repository Pattern

- Define store interfaces where they are consumed (handler package), not where implemented. See also `references/patterns.md` for dependency injection rules.

  ```go
  // In internal/handler/user.go (consumer)
  type UserStore interface {
      GetUser(ctx context.Context, id string) (*User, error)
      CreateUser(ctx context.Context, u *User) error
  }

  // In internal/store/postgres/user.go (implementation)
  type PostgresUserStore struct {
      db *sql.DB
  }

  func (s *PostgresUserStore) GetUser(ctx context.Context, id string) (*User, error) {
      // ...
  }
  ```
