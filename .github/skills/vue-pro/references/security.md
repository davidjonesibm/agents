# Vue 3 Security Best Practices

Target: Vue 3.5+ with `<script setup lang="ts">`.

---

## XSS Prevention

- **Never use `v-html` with user-provided content** — it renders raw HTML and is the primary XSS vector in Vue apps.

  ```vue
  <!-- Before (DANGEROUS — XSS if content is user-provided) -->
  <template>
    <div v-html="userMessage" />
  </template>

  <!-- After (safe — auto-escaped by Vue) -->
  <template>
    <div>{{ userMessage }}</div>
  </template>
  ```

  If you **must** render HTML (e.g., from a trusted markdown renderer), sanitize it server-side or use a library like DOMPurify:

  ```vue
  <script setup lang="ts">
  import DOMPurify from 'dompurify';

  const props = defineProps<{ rawHtml: string }>();
  const sanitizedHtml = computed(() => DOMPurify.sanitize(props.rawHtml));
  </script>
  <template>
    <div v-html="sanitizedHtml" />
  </template>
  ```

- **Vue auto-escapes template interpolation** — `{{ }}` bindings are safe by default. Always prefer interpolation over `v-html`.

  ```vue
  <!-- Safe — Vue escapes '<script>alert("xss")</script>' automatically -->
  <template>
    <p>{{ userInput }}</p>
  </template>
  ```

## URL Injection

- **Never bind user-provided values to `href` without sanitization** — `javascript:` URIs execute code.

  ```vue
  <!-- Before (DANGEROUS — allows javascript: URLs) -->
  <template>
    <a :href="userProvidedUrl">Click</a>
  </template>

  <!-- After (sanitize URL) -->
  <script setup lang="ts">
  import { sanitizeUrl } from '@braintree/sanitize-url';

  const props = defineProps<{ url: string }>();
  const safeUrl = computed(() => sanitizeUrl(props.url));
  </script>
  <template>
    <a :href="safeUrl">Click</a>
  </template>
  ```

  **Best practice:** Sanitize URLs on the backend before storing. Frontend sanitization is a second line of defense, not the primary one.

## Style Injection

- **Never bind user-provided strings directly to `:style`** — it enables CSS-based click-jacking.

  ```vue
  <!-- Before (DANGEROUS — user can style transparent overlays) -->
  <template>
    <div :style="userProvidedStyles" />
  </template>

  <!-- After (restrict to specific properties) -->
  <template>
    <div
      :style="{
        color: userProvidedColor,
        backgroundColor: userProvidedBg,
      }"
    />
  </template>
  ```

- **Never render user content inside `<style>` tags** — Vue prevents this in templates but be cautious with render functions.

  ```vue
  <!-- Vue blocks this — but never attempt it -->
  <template>
    <style>
      {{ userProvidedCss }}
    </style>
  </template>
  ```

## Template Security

- **Never use user-provided content as component templates** — it allows arbitrary JavaScript execution.

  ```ts
  // NEVER DO THIS
  createApp({
    template: `<div>${userProvidedString}</div>`,
  }).mount('#app');

  // Instead — use data binding
  createApp({
    setup() {
      const content = ref(userProvidedString);
      return { content };
    },
    template: `<div>{{ content }}</div>`,
  }).mount('#app');
  ```

- **Never mount Vue on a DOM element that contains server-rendered user content** — the template compiler will execute expressions in that content.

## Event Handler Injection

- **Never bind user-provided strings to event attributes** like `@click`, `onclick`, etc.

  ```vue
  <!-- Before (DANGEROUS — user can inject JS via event binding) -->
  <template>
    <button v-bind="{ [userAttr]: userHandler }">Click</button>
  </template>

  <!-- After (only bind known event handlers) -->
  <template>
    <button @click="handleClick">Click</button>
  </template>
  ```

## Dynamic Components

- **Validate dynamic component names** — `<component :is="">` should never accept raw user input.

  ```vue
  <!-- Before (DANGEROUS — user controls which component renders) -->
  <template>
    <component :is="userInput" />
  </template>

  <!-- After (whitelist approach) -->
  <script setup lang="ts">
  const allowedComponents = {
    text: TextMessage,
    image: ImageMessage,
    giphy: GiphyMessage,
  } as const;

  const component = computed(
    () =>
      allowedComponents[props.type as keyof typeof allowedComponents] ?? null,
  );
  </script>
  <template>
    <component v-if="component" :is="component" />
  </template>
  ```

## CSRF / Backend Coordination

- **Include CSRF tokens with form submissions** when communicating with backends that require them.
- **The frontend is not the primary defense** — ensure the backend validates and sanitizes all input. Frontend sanitization is defense-in-depth.

## Content Security Policy (CSP)

- **Use `<style scoped>` or CSS Modules** instead of inline styles to maintain CSP compatibility.

  ```vue
  <!-- Before (inline styles — may violate CSP) -->
  <template>
    <div style="color: red;">Warning</div>
  </template>

  <!-- After (scoped CSS — CSP-friendly) -->
  <template>
    <div class="warning">Warning</div>
  </template>
  <style scoped>
  .warning {
    color: red;
  }
  </style>
  ```

- **Avoid `eval()`-based template compilation in production** — use pre-compiled SFC templates. The runtime compiler (`vue.esm-browser.js`) evaluates template strings at runtime.

## Third-Party Content

- **Sandbox user-generated content in iframes** when full HTML rendering is required.
- **Audit third-party component libraries** for `v-html` usage and other XSS vectors before adding them as dependencies.

See also `references/patterns.md` for dynamic component best practices.
