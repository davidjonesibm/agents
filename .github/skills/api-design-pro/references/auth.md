# Authentication & Authorization

Patterns for securing APIs. Framework-agnostic principles for OAuth2, JWT, API keys, and scope-based authorization.

## Authentication Methods

### Bearer Token (JWT)

The most common pattern for modern APIs. Client sends a JWT in the `Authorization` header.

```http
GET /orders HTTP/1.1
Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Rules:**

- Validate the JWT signature on every request (never trust without verification).
- Check `exp` (expiration), `iss` (issuer), `aud` (audience) claims.
- Use short-lived access tokens (15–60 minutes) with refresh tokens for renewal.
- Use RS256 (RSA) or ES256 (ECDSA) for signing — avoid HS256 for public APIs (shared secret).
- Never store JWTs in localStorage for browser clients (XSS vulnerable). Use httpOnly cookies or memory.

```typescript
// Pseudocode — JWT validation checklist
function validateToken(token: string): TokenClaims {
  const decoded = verifySignature(token, publicKey); // 1. Verify signature
  if (decoded.exp < now()) throw new UnauthorizedError(); // 2. Check expiration
  if (decoded.iss !== expectedIssuer) throw new UnauthorizedError(); // 3. Check issuer
  if (!decoded.aud.includes(myApiId)) throw new UnauthorizedError(); // 4. Check audience
  return decoded;
}
```

### API Key

Simple authentication for server-to-server communication. Sent as a header or query parameter.

```http
GET /data HTTP/1.1
X-API-Key: some_secret_key
```

**Rules:**

- Send API keys in headers (`X-API-Key` or `Authorization: ApiKey {key}`), never in query parameters (logged in URLs).
- API keys identify the **application**, not the user. Pair with user auth for user-specific access.
- Store keys hashed (bcrypt/scrypt) — never in plaintext.
- Support key rotation: allow multiple active keys per application with expiry dates.
- Prefix keys with environment: `sk_live_`, `sk_test_` to prevent accidental use of test keys in production.

### OAuth 2.0

Standard authorization framework for delegated access. The client obtains an access token from an authorization server.

**Common flows:**

| Flow                      | Use Case                           |
| ------------------------- | ---------------------------------- |
| Authorization Code + PKCE | Browser/mobile apps (user-facing)  |
| Client Credentials        | Server-to-server (no user context) |
| Device Code               | Smart TVs, CLI tools, IoT devices  |

**Authorization Code + PKCE (recommended for user-facing apps):**

```
1. Client generates code_verifier (random string) and code_challenge (SHA256 hash)
2. Client redirects user to authorization server with code_challenge
3. User authenticates and grants consent
4. Authorization server redirects back with authorization code
5. Client exchanges code + code_verifier for access token
6. Client uses access token to call API
```

**Client Credentials (server-to-server):**

```http
POST /oauth/token HTTP/1.1
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials
&client_id=myapp
&client_secret=secret123
&scope=orders.read orders.write
```

**Rules:**

- Always use PKCE with Authorization Code flow (even for confidential clients).
- Never use the Implicit flow — it's deprecated in OAuth 2.1.
- Never use Resource Owner Password Credentials (ROPC) — it's deprecated.
- Store client secrets securely (environment variables, secret manager). Never in code.

## Authorization (Scopes & Permissions)

Use **scopes** to limit what an access token can do. Define scopes per resource and access mode.

**Scope naming convention:**

```
<application-id>.<resource-name>.<access-mode>
```

Examples:

- `orders.read` — read access to orders
- `orders.write` — write access to orders
- `users.admin` — administrative access to user management

**Apply scopes per operation in OpenAPI:**

```yaml
paths:
  /orders:
    get:
      summary: List orders
      security:
        - BearerAuth: [orders.read]
    post:
      summary: Create an order
      security:
        - BearerAuth: [orders.write]
```

**Rules:**

- Use the **principle of least privilege** — request only needed scopes.
- Validate scopes on every request at the API handler level.
- Use coarse-grained scopes (read/write per resource) unless fine-grained control is required.
- Return `403 Forbidden` when the token is valid but lacks the required scope.
- Return `401 Unauthorized` when the token is missing, expired, or has an invalid signature.

```typescript
// Before (violation: no scope check)
app.get('/admin/users', authenticate, async (req, res) => {
  return await userService.listAll(); // anyone with a valid token can list all users
});

// After (correct: scope-based authorization)
app.get(
  '/admin/users',
  authenticate,
  requireScope('users.admin'),
  async (req, res) => {
    return await userService.listAll();
  },
);
```

## Token Refresh

- Access tokens should be short-lived (15–60 minutes).
- Refresh tokens should be long-lived (days to weeks) and single-use (rotate on each refresh).
- Store refresh tokens securely (encrypted, server-side or httpOnly cookie).

```http
POST /oauth/token HTTP/1.1
Content-Type: application/x-www-form-urlencoded

grant_type=refresh_token
&refresh_token=dGhpcyBpcyBhIHJlZnJlc2ggdG9rZW4
&client_id=myapp
```

## API Security Checklist

- [ ] All endpoints require authentication (or explicitly opt out with documentation)
- [ ] JWT signatures are verified with the correct algorithm and key
- [ ] Token expiration is enforced
- [ ] Scopes/permissions are checked on every protected endpoint
- [ ] API keys are not logged or included in URLs
- [ ] HTTPS is enforced (no plain HTTP)
- [ ] CORS is configured to allow only trusted origins
- [ ] Rate limiting is applied per API key / user / IP (see `references/rate-limiting.md`)
- [ ] Sensitive errors return 404 instead of 403 to prevent information disclosure

## Anti-Patterns

- **API key in query string:** `GET /data?apiKey=secret` — visible in logs, browser history, referrers.
- **No token expiration:** Tokens that never expire. Use short-lived tokens with refresh.
- **Shared secrets for public clients:** Using HS256 JWT signing for browser apps exposes the signing key.
- **Implicit flow:** Deprecated. Use Authorization Code + PKCE instead.
- **Checking auth only at the gateway:** Also validate at the service level for defense in depth.
- **Hard-coded credentials:** API keys or secrets in source code. Use environment variables or secret managers.
