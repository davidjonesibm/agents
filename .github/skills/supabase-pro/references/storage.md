# Supabase Storage Patterns

Target: Supabase Storage with `@supabase/supabase-js` v2.

---

## Bucket Configuration

- Always set `fileSizeLimit` and `allowedMimeTypes` when creating buckets to prevent abuse.

  ```typescript
  // Before (no restrictions)
  const { data, error } = await supabase.storage.createBucket('avatars', {
    public: true,
  });

  // After
  const { data, error } = await supabase.storage.createBucket('avatars', {
    public: true,
    fileSizeLimit: 5242880, // 5MB
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
  });
  ```

- Use **private buckets** by default. Only use public buckets for assets that should be accessible without authentication (app icons, public media).

  ```typescript
  // User-uploaded content → private
  await supabase.storage.createBucket('chat-images', {
    public: false,
    fileSizeLimit: 10485760,
    allowedMimeTypes: ['image/*'],
  });

  // Public assets → public
  await supabase.storage.createBucket('public-assets', {
    public: true,
  });
  ```

## File Uploads

- Use unique file paths to prevent collisions. Include user ID and timestamp/UUID as prefixes.

  ```typescript
  // Before (collision risk with common filenames)
  const { error } = await supabase.storage
    .from('avatars')
    .upload('avatar.jpg', file);

  // After
  const filePath = `${userId}/${crypto.randomUUID()}.${extension}`;
  const { data, error } = await supabase.storage
    .from('avatars')
    .upload(filePath, file, {
      contentType: file.type,
      upsert: false,
    });
  ```

- Use `upsert: true` when replacing an existing file (e.g., updating a user's avatar).

  ```typescript
  // Before (fails if file already exists)
  await supabase.storage.from('avatars').upload(path, file);

  // After (replaces if exists)
  const { data, error } = await supabase.storage
    .from('avatars')
    .upload(`${userId}/avatar.webp`, file, {
      contentType: 'image/webp',
      upsert: true,
    });
  ```

## File Access

- Use `getPublicUrl()` for public buckets — no auth needed, CDN-cached.

  ```typescript
  const { data } = supabase.storage
    .from('public-assets')
    .getPublicUrl('images/logo.png');

  console.log(data.publicUrl);
  // https://xyz.supabase.co/storage/v1/object/public/public-assets/images/logo.png
  ```

- Use `createSignedUrl()` for private buckets — time-limited access.

  ```typescript
  // Before (trying getPublicUrl on private bucket — returns 403)
  const { data } = supabase.storage
    .from('chat-images')
    .getPublicUrl('uploads/file.jpg');

  // After (signed URL, expires in 1 hour)
  const { data, error } = await supabase.storage
    .from('chat-images')
    .createSignedUrl('uploads/file.jpg', 3600);

  if (data) {
    console.log(data.signedUrl);
  }
  ```

- Use `createSignedUrls()` (plural) for batch URL generation instead of looping.

  ```typescript
  // Before (N requests)
  const urls = [];
  for (const path of filePaths) {
    const { data } = await supabase.storage
      .from('chat-images')
      .createSignedUrl(path, 3600);
    urls.push(data?.signedUrl);
  }

  // After (1 request)
  const { data, error } = await supabase.storage
    .from('chat-images')
    .createSignedUrls(filePaths, 3600);
  ```

## Image Transformations

- Use the `transform` option on `getPublicUrl()` to resize images on the fly via Supabase's image proxy.

  ```typescript
  // Before (serving full-resolution avatar everywhere)
  const { data } = supabase.storage
    .from('avatars')
    .getPublicUrl('user/avatar.jpg');

  // After (optimized thumbnail)
  const { data } = supabase.storage
    .from('avatars')
    .getPublicUrl('user/avatar.jpg', {
      transform: {
        width: 100,
        height: 100,
        resize: 'cover',
        quality: 80,
      },
    });
  ```

- Available transform options: `width`, `height`, `resize` (`cover`, `contain`, `fill`), `quality` (1-100), `format` (`origin`).

## URL Storage

- Store **relative paths** (not full URLs) in the database. Construct full URLs at the API layer.

  ```typescript
  // Before (full URL in DB — breaks if Supabase URL changes)
  const imageUrl =
    'https://xyz.supabase.co/storage/v1/object/public/avatars/user/pic.jpg';
  await supabase.from('profiles').update({ avatar: imageUrl });

  // After (relative path)
  const avatarPath = '/storage/v1/object/public/avatars/user/pic.jpg';
  await supabase.from('profiles').update({ avatar: avatarPath });
  ```

  **Why:** If you change Supabase projects or use a proxy (e.g., Caddy), relative paths keep working. See project migration `20260406000003_normalize_storage_urls.sql` for the data fix pattern.

## File Deletion

- Delete files when the associated record is deleted. Use an array for batch deletion.

  ```typescript
  // Before (orphaned files in storage after record deletion)
  await supabase.from('messages').delete().eq('id', messageId);

  // After (clean up storage first)
  if (message.image_url) {
    const storagePath = message.image_url.replace(
      '/storage/v1/object/public/chat-images/',
      '',
    );
    await supabase.storage.from('chat-images').remove([storagePath]);
  }
  await supabase.from('messages').delete().eq('id', messageId);
  ```

- Batch-delete files with a single call.

  ```typescript
  // Before (N separate delete calls)
  for (const file of files) {
    await supabase.storage.from('uploads').remove([file.path]);
  }

  // After
  const paths = files.map((f) => f.path);
  const { error } = await supabase.storage.from('uploads').remove(paths);
  ```

## Storage Policies (SQL)

- Create RLS-style policies on storage buckets via the `storage.objects` table.

  ```sql
  -- Allow authenticated users to upload to their own folder
  CREATE POLICY "users_upload_own_files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

  -- Allow authenticated users to read files in buckets they have access to
  CREATE POLICY "users_read_own_files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

  -- Allow users to delete their own files
  CREATE POLICY "users_delete_own_files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );
  ```

  See also `references/security.md` for general RLS patterns.

## Error Handling

- Always check for errors on storage operations. Common error causes: bucket doesn't exist, file too large, disallowed MIME type.

  ```typescript
  // Before (error ignored)
  await supabase.storage.from('avatars').upload(path, file);

  // After
  const { data, error } = await supabase.storage
    .from('avatars')
    .upload(path, file, { contentType: file.type });

  if (error) {
    if (error.message.includes('Payload too large')) {
      throw fastify.httpErrors.badRequest('File size exceeds limit');
    }
    if (error.message.includes('mime type')) {
      throw fastify.httpErrors.badRequest('File type not allowed');
    }
    fastify.log.error(error);
    throw fastify.httpErrors.internalServerError('Upload failed');
  }
  ```
