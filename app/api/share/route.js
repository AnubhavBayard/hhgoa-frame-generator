import { put } from '@vercel/blob';
import { writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// nodejs, not edge: without a blob store the PNG is parked on disk so the share
// link (and its OG card) still works.
export const runtime = 'nodejs';

const MAX_BYTES = 8 * 1024 * 1024;

export const SHARE_DIR = join(tmpdir(), 'hhgoa-share');

export async function POST(request) {
  const form = await request.formData();
  const file = form.get('image');
  if (!(file instanceof Blob)) {
    return Response.json({ error: 'no-image' }, { status: 400 });
  }
  if (file.type !== 'image/png' || file.size > MAX_BYTES) {
    return Response.json({ error: 'bad-image' }, { status: 400 });
  }

  const id = crypto.randomUUID().replace(/-/g, '').slice(0, 12);

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const blob = await put(`f/${id}.png`, file, {
      access: 'public',
      contentType: 'image/png',
      addRandomSuffix: false,
      cacheControlMaxAge: 31536000,
    });
    return Response.json({ id, url: blob.url });
  }

  // ponytail: local/tmp store, lost on restart or between serverless instances.
  // Set BLOB_READ_WRITE_TOKEN for a durable one — the code above takes over.
  await mkdir(SHARE_DIR, { recursive: true });
  await writeFile(join(SHARE_DIR, `${id}.png`), Buffer.from(await file.arrayBuffer()));
  return Response.json({ id });
}
