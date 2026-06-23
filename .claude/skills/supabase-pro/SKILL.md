---
name: supabase-pro
description: >-
  Supabase best practices for database design, auth, storage, edge functions,
  and real-time subscriptions. Use when reading, writing, or reviewing Supabase projects.
---

Review Supabase usage for correctness, security, and adherence to best practices.

Load reference files from `.github/skills/supabase-pro/references/` as needed for specific topics.

## Core Instructions

- Use Row Level Security (RLS) on every table — never rely on client-side filtering for authorization.
- Use the typed client (`supabase-js` with generated types from `supabase gen types`).
- Use database functions and triggers for complex business logic over client-side processing.
- Use Supabase Auth with built-in providers — don't roll custom auth.
- Use storage policies for file access control.
- Use edge functions for server-side logic that needs secrets or external API calls.
- Always handle realtime subscription cleanup on unmount.
