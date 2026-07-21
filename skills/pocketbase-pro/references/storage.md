# PocketBase File Storage & Handling

Target: PocketBase v0.25+ with JS SDK v0.25+

## File Field Configuration

```js
// In migration
{
  type: "file",
  name: "avatar",
  maxSelect: 1,         // single file
  maxSize: 5242880,     // 5MB in bytes
  mimeTypes: ["image/jpeg", "image/png", "image/webp"],
}

// Multi-file field
{
  type: "file",
  name: "documents",
  maxSelect: 5,
  maxSize: 10485760,    // 10MB per file
  mimeTypes: ["application/pdf", "image/jpeg", "image/png"],
}
```

- Always set `maxSize` to prevent abuse. PocketBase defaults can be large.
- Always set `mimeTypes` to restrict upload types. An empty array allows any type.

## Uploading Files (Client SDK)

Files must be sent as `FormData` or the SDK handles it automatically:

```ts
// Create record with file
const record = await pb.collection('posts').create({
  title: 'Hello',
  image: fileInput.files[0],
});

// Multi-file upload
const formData = new FormData();
formData.append('title', 'Hello');
formData.append('documents', file1);
formData.append('documents', file2);
const record = await pb.collection('posts').create(formData);
```

## Updating Files

```ts
// Replace file
await pb.collection('posts').update('RECORD_ID', {
  image: newFile,
});

// Delete file (set to null)
await pb.collection('posts').update('RECORD_ID', {
  image: null,
});
```

## Getting File URLs

```ts
// Public file URL
const url = pb.files.getURL(record, record.avatar);

// With thumb transform (for images)
const thumbUrl = pb.files.getURL(record, record.avatar, { thumb: '100x100' });

// Protected file with token
const token = await pb.files.getToken();
const url = pb.files.getURL(record, record.document, { token });
```

**Thumb formats:** `WxH` (e.g., `100x100`), `WxHt` (top crop), `WxHb` (bottom crop), `WxHf` (fit), `0xH` (resize by height), `Wx0` (resize by width).

## Server-Side File Operations (JSVM)

### Creating files from various sources

```js
const record = $app.findRecordById('articles', 'RECORD_ID');

// From local path
const f1 = $filesystem.fileFromPath('/local/path/to/file.txt');

// From bytes
const f2 = $filesystem.fileFromBytes('file content', 'file.txt');

// From URL
const f3 = $filesystem.fileFromURL('https://example.com/file.pdf');

record.set('documents', [f1, f2, f3]);
$app.save(record);
```

### Reading file content

```js
const record = $app.findAuthRecordByEmail('users', 'test@example.com');
const avatarKey = record.baseFilesPath() + '/' + record.get('avatar');

let fsys, reader, content;
try {
  fsys = $app.newFilesystem();
  reader = fsys.getReader(avatarKey);
  content = toString(reader);
} finally {
  reader?.close();
  fsys?.close();
}
```

### Modifying files before save

```js
onRecordCreate((e) => {
  const files = e.record.getUnsavedFiles('documents');
  for (const f of files) {
    f.name = 'doc_' + f.name; // prefix file names
  }
  e.next();
}, 'articles');
```

## File Access Hooks

```js
onFileTokenRequest((e) => {
  // e.record — the authenticated record requesting the token
  // e.token — the generated file token
  e.next();
}, 'users');
```

## Batch File Uploads

Use the batch API with `multipart/form-data` for multi-record file operations:

```ts
const formData = new FormData();
formData.append(
  '@jsonPayload',
  JSON.stringify({
    requests: [
      {
        method: 'POST',
        url: '/api/collections/posts/records',
        body: { title: 'A' },
      },
      {
        method: 'PATCH',
        url: '/api/collections/posts/records/ID',
        body: { title: 'B' },
      },
    ],
  }),
);
formData.append('requests.0.image', file1);
formData.append('requests.1.image', file2);

await pb.send('/api/batch', { method: 'POST', body: formData });
```

## Storage Best Practices

- Always validate file types on the server (via `mimeTypes` in field config) — never rely solely on client-side validation.
- Set reasonable `maxSize` limits per field to prevent storage abuse.
- Use protected files (`maxSelect` + file tokens) for sensitive documents — do not rely on URL obscurity.
- Old files are automatically deleted when replaced via `record.set("file", newFile)` + `app.save(record)`.
- For S3 storage, configure via PocketBase settings — the API and code remain the same.
