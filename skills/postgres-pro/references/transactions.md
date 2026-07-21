# Transactions and Locking

Best practices for PostgreSQL transaction isolation, locking, advisory locks, and deadlock prevention.

---

## Transaction Basics

- Always **wrap multi-statement mutations** in explicit transactions. Without `BEGIN`, each statement is auto-committed.

  ```sql
  -- Before (partial failure leaves inconsistent state)
  UPDATE accounts SET balance = balance - 100 WHERE id = 1;
  UPDATE accounts SET balance = balance + 100 WHERE id = 2;

  -- After (atomic — both succeed or both fail)
  BEGIN;
  UPDATE accounts SET balance = balance - 100 WHERE id = 1;
  UPDATE accounts SET balance = balance + 100 WHERE id = 2;
  COMMIT;
  ```

- **Keep transactions short** — long-running transactions hold locks and prevent autovacuum from reclaiming dead tuples. No transaction should be open for minutes.

- Use **`SAVEPOINT`** for partial rollback within a transaction.

  ```sql
  BEGIN;
  INSERT INTO orders (user_id, total) VALUES (1, 99.99);
  SAVEPOINT before_items;
  INSERT INTO order_items (order_id, product_id, qty) VALUES (1, 999, 1);
  -- If the item insert fails:
  ROLLBACK TO SAVEPOINT before_items;
  -- Transaction continues — the order insert is preserved
  COMMIT;
  ```

## Isolation Levels

PostgreSQL supports four isolation levels. The default is **Read Committed**.

| Level                                     | Dirty Read | Non-Repeatable Read | Phantom Read | Serialization Anomaly |
| ----------------------------------------- | ---------- | ------------------- | ------------ | --------------------- |
| Read Uncommitted (= Read Committed in PG) | No         | Yes                 | Yes          | Yes                   |
| **Read Committed** (default)              | No         | Yes                 | Yes          | Yes                   |
| Repeatable Read                           | No         | No                  | No           | Yes                   |
| Serializable                              | No         | No                  | No           | No                    |

- **Read Committed** (default) — each statement sees a snapshot as of statement start. Sufficient for most OLTP workloads.

- **Repeatable Read** — the transaction sees a snapshot as of its first non-transaction-control statement. Useful for reporting queries that need consistent reads.

  ```sql
  BEGIN ISOLATION LEVEL REPEATABLE READ;
  SELECT sum(balance) FROM accounts;  -- reads snapshot
  SELECT count(*) FROM accounts;       -- same snapshot
  COMMIT;
  ```

  **Warning:** In Repeatable Read, concurrent updates to the same row will cause a serialization failure (`ERROR: could not serialize access`). Your application **must retry** the transaction.

- **Serializable** — guarantees that concurrent transactions produce the same result as some serial execution. Use for correctness-critical workloads.

  ```sql
  BEGIN ISOLATION LEVEL SERIALIZABLE;
  -- ... complex reads + writes ...
  COMMIT;
  ```

  **Warning:** Serializable transactions can fail with `ERROR: could not serialize access due to read/write dependencies`. Your application **must implement retry logic**.

  ```typescript
  // Application retry pattern for serializable transactions
  async function withSerializableRetry<T>(
    fn: () => Promise<T>,
    maxRetries = 3,
  ): Promise<T> {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await fn();
      } catch (err: any) {
        if (err.code === '40001' && attempt < maxRetries - 1) continue; // serialization failure
        throw err;
      }
    }
    throw new Error('Max retries exceeded');
  }
  ```

## Row-Level Locking

- Use **`SELECT ... FOR UPDATE`** to lock rows you intend to modify — prevents concurrent updates to the same rows.

  ```sql
  BEGIN;
  SELECT * FROM accounts WHERE id = 1 FOR UPDATE;
  -- Row is now locked — other transactions block on this row
  UPDATE accounts SET balance = balance - 100 WHERE id = 1;
  COMMIT;
  ```

- Use **`FOR UPDATE SKIP LOCKED`** for queue-style processing — skip rows already locked by another worker.

  ```sql
  -- Worker picks the next unlocked task
  BEGIN;
  SELECT * FROM tasks
  WHERE status = 'pending'
  ORDER BY created_at
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  UPDATE tasks SET status = 'processing' WHERE id = <selected_id>;
  COMMIT;
  ```

- Use **`FOR UPDATE NOWAIT`** to fail immediately if the row is locked rather than waiting.

  ```sql
  BEGIN;
  SELECT * FROM accounts WHERE id = 1 FOR UPDATE NOWAIT;
  -- Throws ERROR if row is already locked
  COMMIT;
  ```

- Use **`FOR SHARE`** when you need to prevent updates/deletes but allow other readers.

## Advisory Locks

- Use **advisory locks** for application-level coordination that doesn't map to row locks (e.g., preventing concurrent migrations, singleton job execution).

- Prefer **transaction-level** advisory locks (`pg_advisory_xact_lock`) — they auto-release at transaction end, preventing leak bugs.

  ```sql
  -- Prevent concurrent execution of a migration
  BEGIN;
  SELECT pg_advisory_xact_lock(hashtext('run_migration'));
  -- ... run migration ...
  COMMIT;  -- lock released automatically
  ```

- **Session-level** advisory locks (`pg_advisory_lock`) persist until explicitly released or the session ends. Use `pg_try_advisory_lock` for non-blocking attempts.

  ```sql
  -- Non-blocking: returns false if lock not available
  SELECT pg_try_advisory_lock(12345);
  -- ... do work ...
  SELECT pg_advisory_unlock(12345);
  ```

  **Warning:** Session-level advisory locks are **not compatible with PgBouncer transaction mode** because the session is shared. Use transaction-level locks instead.

## Deadlock Prevention

- **Acquire locks in a consistent order** across all code paths. Deadlocks occur when two transactions lock resources in opposite order.

  ```sql
  -- Deadlock scenario:
  -- TX1: UPDATE accounts SET ... WHERE id = 1; UPDATE accounts SET ... WHERE id = 2;
  -- TX2: UPDATE accounts SET ... WHERE id = 2; UPDATE accounts SET ... WHERE id = 1;

  -- Fix: always lock in ascending ID order
  BEGIN;
  UPDATE accounts SET balance = balance - 100 WHERE id = LEAST(1, 2);
  UPDATE accounts SET balance = balance + 100 WHERE id = GREATEST(1, 2);
  COMMIT;
  ```

- Set **`deadlock_timeout`** (default 1s) — PostgreSQL detects deadlocks and aborts one transaction after this interval. If you see frequent deadlock errors, fix the lock ordering rather than increasing the timeout.

- Set **`lock_timeout`** to prevent waiting indefinitely for a lock.

  ```sql
  SET lock_timeout = '5s';
  ALTER TABLE large_table ADD COLUMN new_col text;
  -- Fails after 5s if a conflicting lock is held
  ```

See also `references/performance.md` for transaction timeout settings.
