# React Security Best Practices

XSS prevention, injection risks, and safe coding patterns — for React 19+.

## XSS via `dangerouslySetInnerHTML` (Critical)

- **Never pass user-controlled input directly to `dangerouslySetInnerHTML`** — it bypasses React's automatic output escaping and enables Cross-Site Scripting (XSS) attacks.

  ```tsx
  // Before ❌ — CRITICAL XSS vulnerability
  const post = { content: `<img src="" onerror='alert("hacked")'>` }; // from DB/user input

  export function MarkdownPreview() {
    const markup = { __html: post.content }; // 🔴 SECURITY HOLE
    return <div dangerouslySetInnerHTML={markup} />;
  }

  // After ✅ — sanitize with a trusted library before injecting
  import DOMPurify from 'dompurify';

  export function MarkdownPreview({ html }: { html: string }) {
    const clean = DOMPurify.sanitize(html);
    return <div dangerouslySetInnerHTML={{ __html: clean }} />;
  }
  ```

  **Why:** React's JSX output is escaped — all JSX text content is safe. `dangerouslySetInnerHTML` opts out of that protection entirely. Use it only with server-generated or library-processed HTML you trust.

- **Process user Markdown through a trusted parser, not raw string concatenation.** Even with a parser, sanitize the output.

  ```tsx
  // Before ❌ — trusting the parser to be bug-free (it isn't always)
  import { Remarkable } from 'remarkable';
  const md = new Remarkable();
  function MarkdownPreview({ markdown }: { markdown: string }) {
    return <div dangerouslySetInnerHTML={{ __html: md.render(markdown) }} />;
  }

  // After ✅ — parse then sanitize
  import { Remarkable } from 'remarkable';
  import DOMPurify from 'dompurify';
  const md = new Remarkable();
  function MarkdownPreview({ markdown }: { markdown: string }) {
    const rendered = md.render(markdown);
    const clean = DOMPurify.sanitize(rendered);
    return <div dangerouslySetInnerHTML={{ __html: clean }} />;
  }
  ```

## React's Built-In Escaping — Don't Bypass It

- **React automatically escapes all JSX expressions.** Content rendered via `{userInput}` is safe. Never convert user content to raw HTML to "fix" a display issue — fix the UI approach instead.

  ```tsx
  // Safe ✅ — React escapes the string
  function Comment({ text }: { text: string }) {
    return <p>{text}</p>; // if text = '<script>...', rendered as literal text
  }

  // Unsafe ❌ — unnecessarily bypasses escaping
  function Comment({ text }: { text: string }) {
    return <p dangerouslySetInnerHTML={{ __html: text }} />; // don't do this for plain text
  }
  ```

## `eval()` and Dynamic Code Execution

- **Never use `eval()`, `new Function()`, or dynamic `import()` with user-controlled strings in components.** These allow arbitrary code execution and are incompatible with React Compiler's static analysis.

  ```tsx
  // Before ❌ — eval with user input
  function Calculator({ expression }: { expression: string }) {
    const result = eval(expression); // 🔴 remote code execution risk
    return <div>{result}</div>;
  }

  // After ✅ — use a safe parser library
  import { evaluate } from 'mathjs';
  function Calculator({ expression }: { expression: string }) {
    let result: string;
    try {
      result = String(evaluate(expression));
    } catch {
      result = 'Invalid expression';
    }
    return <div>{result}</div>;
  }
  ```

## Open Redirect via `href` Props

- **Validate URLs from user input before placing them in `href` or `src` props.** `javascript:` URLs execute code when clicked.

  ```tsx
  // Before ❌ — javascript: href executes code
  function ProfileLink({ url }: { url: string }) {
    return <a href={url}>Visit profile</a>; // url = "javascript:alert(1)"
  }

  // After ✅ — validate protocol before rendering
  function ProfileLink({ url }: { url: string }) {
    const isSafe = url.startsWith('http://') || url.startsWith('https://');
    if (!isSafe) return <span>Invalid link</span>;
    return (
      <a href={url} rel="noreferrer noopener" target="_blank">
        Visit profile
      </a>
    );
  }
  ```

## External Links — `rel="noreferrer noopener"`

- **Always add `rel="noreferrer noopener"` to external links opened in a new tab.** Without it, the linked page can access `window.opener` and redirect the parent tab (reverse tab-napping).

  ```tsx
  // Before ❌ — opener vulnerability
  <a href="https://external.com" target="_blank">External</a>

  // After ✅
  <a href="https://external.com" target="_blank" rel="noreferrer noopener">External</a>
  ```

## Form Actions and Server Validation

- **Never trust client-side validation alone.** React form validation (including with `useActionState`) is UX only — always validate on the server side too.

  ```tsx
  // Before ❌ — validates only in the client action
  const [error, submitAction] = useActionState(async (prev, formData) => {
    const name = formData.get('name') as string;
    if (name.length < 2) return 'Too short'; // skipped if JS is disabled
    await saveName(name); // ← server receives unvalidated data
    return null;
  }, null);

  // After ✅ — validate on the server too
  const [error, submitAction] = useActionState(async (prev, formData) => {
    const name = formData.get('name') as string;
    if (name.length < 2) return 'Too short'; // UX validation
    const result = await saveNameOnServer(name); // server validates again
    if (result.error) return result.error;
    return null;
  }, null);
  ```

## URL Construction

- **Use the `URL` constructor instead of string concatenation** to build URLs. Concatenation is vulnerable to path traversal and injection.

  ```tsx
  // Before ❌ — path traversal possible if productId = '../admin'
  const url = '/api/products/' + productId;

  // After ✅ — URL constructor encodes path segments
  const base = new URL('https://api.example.com');
  const url = new URL(`/api/products/${encodeURIComponent(productId)}`, base);
  fetch(url.toString());
  ```

## Environment Variables

- **Never embed sensitive secrets in client-side code.** In Vite/CRA/Next.js, only variables prefixed with the framework's public prefix (`VITE_`, `NEXT_PUBLIC_`, `REACT_APP_`) are safe for the browser. API secrets, signing keys, and credentials must stay server-side only.

  ```tsx
  // Before ❌ — secret key bundled into client JS
  const client = new APIClient({ apiKey: process.env.SECRET_API_KEY });

  // After ✅ — only public config on the client; secrets in server routes
  const client = new APIClient({ baseUrl: import.meta.env.VITE_API_BASE_URL });
  ```
