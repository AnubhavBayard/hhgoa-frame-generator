import { list } from '@vercel/blob';
import { headers } from 'next/headers';
import Link from 'next/link';
import { access } from 'node:fs/promises';
import { join } from 'node:path';
import { SHARE_DIR } from '../../api/share/route';

// X fetches this page for the link preview, so the OG image has to be the
// actual generated graphic — not a default thumbnail.
async function blobUrl(id) {
  if (!/^[a-f0-9]{12}$/.test(id)) return null;
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { blobs } = await list({ prefix: `f/${id}.png`, limit: 1 });
    return blobs[0]?.url ?? null;
  }
  // No blob store: the PNG sits in the tmp store, served by /api/share/[id].
  // OG images must be absolute, so rebuild the origin from the request.
  try {
    await access(join(SHARE_DIR, `${id}.png`));
  } catch {
    return null;
  }
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host');
  const proto = h.get('x-forwarded-proto') ?? 'http';
  return `${proto}://${host}/api/share/${id}`;
}

export async function generateMetadata({ params }) {
  const { id } = await params;
  const url = await blobUrl(id);
  const title = 'I got my HH Goa 2026 frame';
  const description = 'Hacker House Goa 2026 · 28–31 Oct · Goa, India. Make yours. #FrameInGoa';
  return {
    title,
    description,
    // No width/height: the two formats are 1080x1425 and 1000x1000, and a wrong
    // pair here is what makes X fall back to a small thumbnail.
    openGraph: { title, description, images: url ? [{ url }] : [] },
    twitter: { card: 'summary_large_image', title, description, images: url ? [url] : [] },
  };
}

export default async function SharePage({ params }) {
  const { id } = await params;
  const url = await blobUrl(id);
  return (
    <main className="share">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="HH Goa 2026 graphic" />
      ) : (
        <p className="muted">This frame has expired or never existed.</p>
      )}
      <Link className="btn primary" href="/">Make your own</Link>
    </main>
  );
}
