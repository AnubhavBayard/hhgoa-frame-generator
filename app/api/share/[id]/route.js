import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { SHARE_DIR } from '../route';

export const runtime = 'nodejs';

// Serves the PNGs parked by POST /api/share when no blob store is configured.
export async function GET(_request, { params }) {
  const { id } = await params;
  if (!/^[a-f0-9]{12}$/.test(id)) return new Response('bad id', { status: 400 });
  try {
    const png = await readFile(join(SHARE_DIR, `${id}.png`));
    return new Response(png, {
      headers: {
        'content-type': 'image/png',
        'cache-control': 'public, max-age=31536000, immutable',
      },
    });
  } catch {
    return new Response('gone', { status: 404 });
  }
}
