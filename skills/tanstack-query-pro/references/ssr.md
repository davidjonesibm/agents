# SSR — Server-Side Rendering and Hydration

Rules for using TanStack Query with Next.js App Router, Pages Router, and other SSR frameworks.

---

## Prefetch on the Server, Hydrate on the Client

- **Prefetch queries in server components and wrap client components in `<HydrationBoundary>`.** This prevents the client from re-fetching on mount for data that was already loaded on the server.

  ```typescript
  // Before (no server prefetch — client fetches on mount; loading spinner always shown on first render)
  // app/posts/page.tsx (Server Component — App Router)
  export default function PostsPage() {
    return <Posts />
  }

  // posts.tsx (Client Component)
  'use client'
  export default function Posts() {
    const { data, isPending } = useQuery({ queryKey: ['posts'], queryFn: getPosts })
    if (isPending) return <Spinner />
    return <ul>{data?.map((p) => <li key={p.id}>{p.title}</li>)}</ul>
  }

  // After (prefetch on server — data ready on first client render, no loading state)
  // app/posts/page.tsx (Server Component — App Router)
  import { dehydrate, HydrationBoundary, QueryClient } from '@tanstack/react-query'
  import Posts from './posts'

  export default async function PostsPage() {
    const queryClient = new QueryClient()

    await queryClient.prefetchQuery({
      queryKey: ['posts'],
      queryFn: getPosts,
    })

    return (
      <HydrationBoundary state={dehydrate(queryClient)}>
        <Posts />
      </HydrationBoundary>
    )
  }

  // posts.tsx (Client Component)
  'use client'
  import { useQuery } from '@tanstack/react-query'

  export default function Posts() {
    const { data } = useQuery({ queryKey: ['posts'], queryFn: getPosts })
    return <ul>{data?.map((p) => <li key={p.id}>{p.title}</li>)}</ul>
  }
  ```

---

## Create a New `QueryClient` on Every Server Request

- **Never share a `QueryClient` across requests on the server.** A singleton would leak data between users. Use a factory that creates a fresh client per request, reused only on the browser.

  ```typescript
  // Before (singleton QueryClient — leaks cached data across server requests and users)
  // lib/query-client.ts
  import { QueryClient } from '@tanstack/react-query';

  const queryClient = new QueryClient(); // shared across all requests — data leak risk
  export default queryClient;

  // After (factory function — fresh client per server request, reused on browser)
  // lib/query-client.ts
  import { isServer, QueryClient } from '@tanstack/react-query';

  function makeQueryClient() {
    return new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 60 * 1000, // avoid immediate re-fetch on client mount
        },
      },
    });
  }

  let browserQueryClient: QueryClient | undefined;

  export function getQueryClient() {
    if (isServer) {
      return makeQueryClient(); // always new on server
    }
    // Reuse browser instance (avoid re-creation during Suspense)
    if (!browserQueryClient) browserQueryClient = makeQueryClient();
    return browserQueryClient;
  }
  ```

---

## Set `staleTime` Above 0 for SSR

- **Always set a non-zero `staleTime` when using SSR.** With `staleTime: 0` (the default), the client immediately considers server-prefetched data stale and refetches on mount, defeating the purpose of prefetching.

  ```typescript
  // Before (staleTime: 0 — data refetched on client mount even though just prefetched)
  const queryClient = new QueryClient();

  // After (data stays fresh long enough for client render to use it)
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000, // 1 minute — adjust to match your invalidation frequency
      },
    },
  });
  ```

---

## Use `<HydrationBoundary>` Not the Removed `<Hydrate>`

- **Replace the removed `<Hydrate>` component with `<HydrationBoundary>`.** This was renamed in v5 — see `references/api.md` for the full before/after migration example.

---

## Pages Router — Dehydrate in `getStaticProps` / `getServerSideProps`

- **Dehydrate the QueryClient and pass it as a prop** in Next.js Pages Router; wrap the page with `<HydrationBoundary>` inside `_app.tsx` or the page component.

  ```typescript
  // Before (no dehydration — data fetched on server but not hydrated; client refetches on mount)
  export async function getStaticProps() {
    const posts = await getPosts()
    return { props: { posts } }
  }

  function Posts({ posts }: { posts: { id: number; title: string }[] }) {
    // Static prop — no cache integration; QueryClient cannot invalidate or refetch this data
    return <ul>{posts.map((p) => <li key={p.id}>{p.title}</li>)}</ul>
  }

  export default Posts

  // After (dehydrated QueryClient — cache hydrated on client, no duplicate fetch)
  // pages/posts.tsx
  import { dehydrate, HydrationBoundary, QueryClient, useQuery } from '@tanstack/react-query'

  export async function getStaticProps() {
    const queryClient = new QueryClient()
    await queryClient.prefetchQuery({ queryKey: ['posts'], queryFn: getPosts })
    return { props: { dehydratedState: dehydrate(queryClient) } }
  }

  function Posts() {
    const { data } = useQuery({ queryKey: ['posts'], queryFn: getPosts }) // cache hit
    return <ul>{data?.map((p) => <li key={p.id}>{p.title}</li>)}</ul>
  }

  export default function PostsPage({ dehydratedState }) {
    return (
      <HydrationBoundary state={dehydratedState}>
        <Posts />
      </HydrationBoundary>
    )
  }
  ```

---

## Streaming — Use `ReactQueryStreamedHydration` with Suspense

- **Use `ReactQueryStreamedHydration` (from `@tanstack/react-query-next-experimental`)** to stream query data as it resolves on the server instead of waiting for all queries to complete before sending HTML.

  ```typescript
  // Before (no streaming — all queries must resolve before any HTML is sent; higher TTFB)
  // app/providers.tsx
  'use client'
  import { QueryClientProvider } from '@tanstack/react-query'
  import { getQueryClient } from '@/lib/query-client'

  export function Providers({ children }: { children: React.ReactNode }) {
    const queryClient = getQueryClient()
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    )
  }

  // After (ReactQueryStreamedHydration — query data streams as it resolves; lower TTFB)
  // app/providers.tsx
  'use client'
  import { QueryClientProvider } from '@tanstack/react-query'
  import { ReactQueryStreamedHydration } from '@tanstack/react-query-next-experimental'
  import { getQueryClient } from '@/lib/query-client'

  export function Providers({ children }: { children: React.ReactNode }) {
    const queryClient = getQueryClient()
    return (
      <QueryClientProvider client={queryClient}>
        <ReactQueryStreamedHydration>
          {children}
        </ReactQueryStreamedHydration>
      </QueryClientProvider>
    )
  }
  ```

  **Note:** Requires `useSuspenseQuery` in client components for streaming to work. Queries using plain `useQuery` are not streamed.

---

## Don't Render Server-Fetched Data in the Server Component Directly

- **Avoid rendering `fetchQuery` results in the server component HTML** alongside the `<HydrationBoundary>`. This creates a mismatch when the query revalidates on the client.

  ```typescript
  // Before (server-rendered count diverges from client after revalidation)
  const posts = await queryClient.fetchQuery({ queryKey: ['posts'], queryFn: getPosts })
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div>Total: {posts.length}</div> {/* stale after client refetch */}
      <Posts />
    </HydrationBoundary>
  )

  // After (let the client component render dynamic counts)
  await queryClient.prefetchQuery({ queryKey: ['posts'], queryFn: getPosts })
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Posts /> {/* Posts internally renders the count via useQuery */}
    </HydrationBoundary>
  )
  ```
