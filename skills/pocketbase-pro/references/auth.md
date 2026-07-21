# PocketBase Authentication

Target: PocketBase v0.25+ with JS SDK v0.25+

## Auth Collection Configuration

Auth collections support multiple authentication methods, configured via the collection's auth options:

| Method         | Description                                  |
| -------------- | -------------------------------------------- |
| `passwordAuth` | Email/username + password                    |
| `otp`          | One-time password via email                  |
| `oauth2`       | Third-party providers (Google, GitHub, etc.) |
| `mfa`          | Multi-factor authentication                  |

## Password Authentication (Client SDK)

```ts
import PocketBase from 'pocketbase';
const pb = new PocketBase('http://127.0.0.1:8090');

// Sign in
const authData = await pb
  .collection('users')
  .authWithPassword('user@example.com', 'password123');
console.log(authData.token);
console.log(authData.record);

// The auth store is automatically updated
console.log(pb.authStore.isValid);
console.log(pb.authStore.token);
console.log(pb.authStore.record);
```

## OAuth2 Authentication (Client SDK)

```ts
// Popup-based (no redirect needed)
const authData = await pb.collection('users').authWithOAuth2({
  provider: 'google',
  scopes: ['email', 'profile'],
  createData: {
    name: 'Default Name',
    emailVisibility: false,
  },
});

// Custom URL callback (for mobile / webview)
const authData = await pb.collection('users').authWithOAuth2({
  provider: 'github',
  urlCallback: (url) => {
    window.open(url, '_blank');
  },
});
```

## OTP Authentication (Client SDK)

```ts
// Step 1: Request OTP
const result = await pb.collection('users').requestOTP('user@example.com');

// Step 2: Authenticate with OTP
const authData = await pb
  .collection('users')
  .authWithOTP(result.otpId, 'OTP_CODE');
```

## Auth Store

The SDK manages an `authStore` that persists the token and record:

```ts
// Check auth state
pb.authStore.isValid; // has non-expired token
pb.authStore.isSuperuser; // is superuser
pb.authStore.token; // JWT string
pb.authStore.record; // authenticated record model

// Clear (logout)
pb.authStore.clear();

// Refresh token and record data
await pb.collection('users').authRefresh();

// Listen to changes
pb.authStore.onChange((token, record) => {
  console.log('Auth changed:', token, record);
});
```

## Cookie-Based Auth (SSR)

For SSR frameworks (SvelteKit, Nuxt, etc.), persist the auth store via cookies:

```ts
// Load from cookie (server-side)
pb.authStore.loadFromCookie(request.headers.get('cookie') || '');

// Refresh if valid
if (pb.authStore.isValid) {
  try {
    await pb.collection('users').authRefresh();
  } catch {
    pb.authStore.clear();
  }
}

// Send back to client
response.headers.append('set-cookie', pb.authStore.exportToCookie());
```

## Custom Auth Store

Extend `BaseAuthStore` for custom persistence (e.g., React Native AsyncStorage):

```ts
import PocketBase, { BaseAuthStore } from 'pocketbase';

class CustomAuthStore extends BaseAuthStore {
  save(token: string, record: any) {
    super.save(token, record);
    // persist to your storage
  }

  clear() {
    super.clear();
    // remove from your storage
  }
}

const pb = new PocketBase('http://127.0.0.1:8090', new CustomAuthStore());
```

## Email Verification Flow

```ts
// Request verification email
await pb.collection('users').requestVerification('user@example.com');

// Confirm (from the email link)
await pb.collection('users').confirmVerification(verificationToken);
```

## Password Reset Flow

```ts
// Request password reset email
await pb.collection('users').requestPasswordReset('user@example.com');

// Confirm reset
await pb
  .collection('users')
  .confirmPasswordReset(resetToken, 'newPassword', 'newPassword');
```

## Server-Side Token Generation (JSVM)

```js
// In pb_hooks
const record = $app.findAuthRecordByEmail('users', 'test@example.com');

const authToken = record.newAuthToken();
const verifyToken = record.newVerificationToken();
const resetToken = record.newPasswordResetToken();
const fileToken = record.newFileToken();
const staticToken = record.newStaticAuthToken(3600); // non-refreshable, custom duration
```

## Server-Side Custom Auth Route (JSVM)

```js
routerAdd('POST', '/phone-login', (e) => {
  const data = new DynamicModel({ phone: '', password: '' });
  e.bindBody(data);

  const record = $app.findFirstRecordByData('users', 'phone', data.phone);
  if (!record.validatePassword(data.password)) {
    throw new BadRequestError('Invalid credentials');
  }

  return $apis.recordAuthResponse(e, record, 'phone');
});
```

## Auth Best Practices

- Always use `authRefresh()` on app load to verify the token is still valid.
- Never store tokens in localStorage for high-security apps — prefer httpOnly cookies via `exportToCookie()`.
- Use the `manageRule` on auth collections only when one user needs to fully modify another user's auth data.
- Set appropriate token durations in the collection auth options — shorter for sensitive apps.
- Use `emailVisibility: false` by default to protect user email addresses.
