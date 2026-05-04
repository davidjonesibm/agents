# Protocols

Protocol-specific request configuration in Insomnia 12.5+: GraphQL, gRPC, WebSocket, and SOAP.

## GraphQL

### Request Setup

Create a **GraphQL request** (not a plain HTTP request) to get IDE features:

```graphql
# Query panel — Insomnia provides auto-completion and inline validation
query GetUser($id: ID!) {
  user(id: $id) {
    id
    name
    email
  }
}
```

```json
// Variables panel (JSON)
{ "id": "usr_123" }
```

### Schema Introspection

Insomnia fetches the schema automatically on first use. To refresh manually:

**Request → Refresh Schema**

If introspection is disabled on the server:

1. Download the SDL or JSON introspection result.
2. **Request → Set Schema → From File**.

### Auth and Headers for GraphQL

GraphQL requests support all standard auth types. Set auth at the folder level to share across all GraphQL requests in a collection:

```
Authorization: Bearer {{ access_token }}
Content-Type: application/json   ← set automatically, do not override
```

**Critical:** Do not manually set `Content-Type: application/json` for GraphQL requests — Insomnia manages this header. Overriding it can break the request.

### GraphQL over WebSocket (subscriptions)

Use a **WebSocket** request type (not GraphQL type) for `graphql-ws` or `subscriptions-transport-ws` protocols. See the WebSocket section below.

---

## gRPC

### Creating a gRPC Request

1. **New Request → gRPC**.
2. Enter the server address — use `grpc://` for plaintext or `grpcs://` for TLS.
3. Load the service definition via one of:
   - **Server Reflection** (if the server has reflection enabled)
   - **Buf Schema Registry** (enter the BSR module URL)
   - **Proto files** (upload `.proto` files directly)

### Four RPC Styles

| Style                       | Request type                         | Use case                         |
| --------------------------- | ------------------------------------ | -------------------------------- |
| **Unary**                   | Single request → single response     | CRUD operations                  |
| **Server Streaming**        | Single request → stream of responses | Live feeds, file downloads       |
| **Client Streaming**        | Stream of requests → single response | File uploads, telemetry batching |
| **Bidirectional Streaming** | Stream ↔ stream                      | Chat, real-time control          |

```proto
// For bidirectional streaming, Insomnia renders a message composer
// allowing you to send multiple messages without ending the stream
service Chat {
  rpc Connect(stream ChatMessage) returns (stream ChatMessage);
}
```

### TLS for gRPC

```
// Before — plaintext (development only)
grpc://localhost:50051

// After — TLS (production servers)
grpcs://api.example.com:443
```

Insomnia trusts the system CA store. For self-signed certs, add the CA cert under **Preferences → Certificates**.

### Metadata

Add gRPC metadata (equivalent to HTTP headers) in the **Metadata** tab:

```
authorization: Bearer {{ access_token }}
x-tenant-id: {{ tenant_id }}
```

---

## WebSocket

### Creating a WebSocket Request

1. **New Request → WebSocket**.
2. Enter a `ws://` or `wss://` URL.
3. Set auth and custom headers in the **Headers** tab (sent during the HTTP upgrade handshake).
4. Click **Connect** — the connection persists until you click **Disconnect**.

### Sending Messages

```json
// JSON message — type in the message composer and click Send
{ "type": "subscribe", "channel": "orders", "token": "{{ access_token }}" }
```

```
// Raw message
PING
```

### Events Panel

All sent and received messages appear in the **Events** panel in chronological order with timestamps. Use this to debug real-time protocols.

### GraphQL Subscriptions over WebSocket

```json
// Send the connection_init message first (graphql-ws protocol)
{ "type": "connection_init", "payload": {} }

// Then subscribe
{
  "id": "1",
  "type": "subscribe",
  "payload": {
    "query": "subscription { orderUpdated { id status } }"
  }
}
```

---

## SOAP

Insomnia treats SOAP as a standard HTTP request with an XML body. There is no dedicated SOAP request type.

### WSDL Import

1. **Import → From URL** — paste the WSDL URL.
2. Insomnia generates requests for each WSDL operation with pre-filled XML bodies.

### Manual SOAP Request

```
Method: POST
URL: https://service.example.com/soap
Headers:
  Content-Type: text/xml; charset=utf-8
  SOAPAction: "http://example.com/GetUser"
```

```xml
<!-- Body — XML -->
<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope
  xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
  xmlns:tns="http://example.com/">
  <soap:Header/>
  <soap:Body>
    <tns:GetUser>
      <tns:UserId>{{ user_id }}</tns:UserId>
    </tns:GetUser>
  </soap:Body>
</soap:Envelope>
```

Variables (`{{ user_id }}`) are interpolated inside XML bodies like any other body type.

### SOAP 1.2

For SOAP 1.2, change the Content-Type and namespace:

```
Content-Type: application/soap+xml; charset=utf-8
```

```xml
xmlns:soap="http://www.w3.org/2003/05/soap-envelope/"
```

See also `references/environments.md` for using variables inside protocol-specific request bodies and headers. See also `references/scripting.md` for writing after-response scripts that parse XML responses using the `xml2js` library.
