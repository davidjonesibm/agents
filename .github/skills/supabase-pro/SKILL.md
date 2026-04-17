---
name: supabase-pro
description: >-
  Comprehensively reviews Supabase code for best practices on database queries,
  RLS policies, auth, storage, migrations, TypeScript integration, and
  supabase-js v2 API usage. Use when reading, writing, or reviewing Supabase
  projects, PostgreSQL schemas, Row Level Security policies, or service-role
  backend code.
---

Review Supabase code for correctness, security, performance, and adherence to project conventions. Report only genuine problems — do not nitpick or invent issues.

Review process:

1. Check for deprecated or incorrect supabase-js API usage using `references/api.md`.
2. Validate idiomatic Supabase query patterns using `references/patterns.md`.
3. Audit Row Level Security policies, auth flows, and access control using `references/security.md`.
4. Check performance best practices for queries, indexes, and connection handling using `references/performance.md`.
5. Validate TypeScript type safety and `database.types.ts` patterns using `references/typescript.md`.
6. Review SQL migrations for schema design best practices using `references/migrations.md`.
7. Check auth implementation patterns using `references/auth.md`.
8. Validate storage bucket configuration and file handling using `references/storage.md`.

If doing a partial review, load only the relevant reference files.

## Core Instructions

- Target **supabase-js v2** (`@supabase/supabase-js@^2`) and the latest Supabase platform.
- Backend code uses the **service-role client** which bypasses RLS — never expose this key to the browser.
- Frontend code uses the **anon key** and should only use Supabase for auth — all data access goes through the backend API.
- Every table in `public` schema **must** have RLS enabled, even when accessed only via service-role.
- Every new table **must** be added to `database.types.ts` with `Row`, `Insert`, `Update`, and `Relationships` entries.
- All migrations must be idempotent where possible (`IF NOT EXISTS`, `CREATE OR REPLACE`).
- Never cast `supabaseAdmin as any` — update `database.types.ts` instead.
- Use `@chat/shared` types for API request/response shapes — never redefine them locally.

## Output Format

Organize findings by file. For each issue:

1. State the file and relevant line(s).
2. Name the rule being violated.
3. Show a brief before/after code fix.

Skip files with no issues. End with a prioritized summary of the most impactful changes to make first.

Example output:

### routes/channels.ts

**Line 45: Always chain `.select()` after `.insert()` / `.update()` / `.upsert()` to get typed return data.**

```typescript
// Before
const { error } = await supabase.from('channels').insert({ name, group_id });

// After
const { data, error } = await supabase
  .from('channels')
  .insert({ name, group_id })
  .select()
  .single();
```

### migrations/20260410_add_reactions.sql

**Line 8: Always enable RLS on new tables.**

```sql
-- Before (missing RLS)
CREATE TABLE reactions ( ... );

-- After
CREATE TABLE reactions ( ... );
ALTER TABLE reactions ENABLE ROW LEVEL SECURITY;
```

### database.types.ts

**Missing table entry: Every new table must have Row, Insert, Update, and Relationships entries.**

```typescript
// Add to Database['public']['Tables']:
reactions: {
  Row: { id: string; emoji: string; /* ... */ }
  Insert: { id?: string; emoji: string; /* ... */ }
  Update: { id?: string; emoji?: string; /* ... */ }
  Relationships: [ /* ... */ ]
}
```
