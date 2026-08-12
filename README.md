# HH Goa 2026 — Frame / Builder ID Generator

Shortlisting task 1. Upload a photo, get a branded HH Goa 2026 graphic, download it
or post it to X. No login, no signup gate, one pass start to finish.

Both formats from the brief are built:

- **Format A — PFP frame**: 1000×1000. Photo stays full-bleed, the ornament ring
  and ribbon wrap it. Drop it straight in as an X profile picture.
- **Format B — Builder ID card**: 1080×1440 (3:4), a redraw of the printed HH
  Goa key-art poster. Torn yellow border, tapa-cloth green field, the palm and
  `GOA, INDIA` header, the wavy photo window, `28 – 31 OCT 2026`, and the
  `HACKER गोवा HOUSE` wordmark inside its cowrie-and-star-anise wreath. Your
  name, stack and generated builder class sit between the dates and the wreath —
  the only block the poster itself does not have.

## Run it

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # crop maths, title generator, generated art
```

## Deploy

```bash
npx vercel        # link the project
npx vercel deploy --prod
```

Then add a **Blob** store in the Vercel dashboard (Storage → Create → Blob) and
redeploy. That gives `BLOB_READ_WRITE_TOKEN`, which powers the share-link preview.
See `.env.example`.

## How the brief maps to the code

Requirements are the ones published on [hhgoa.com](https://hhgoa.com/) for
Task #1 — HH Goa Frame / ID Card Generator.

| Requirement | Where |
|---|---|
| Upload jpg / png / webp / **HEIC** | `lib/render.js` → `decodeFile`. `createImageBitmap` first; the HEIC converter is dynamically imported only when a HEIC actually shows up, so nobody else pays for it. EXIF rotation via `imageOrientation: 'from-image'`. |
| Near-instant | Everything renders on a client canvas. The SVG ornaments are decoded once and cached, so typing in the name field re-renders in ~10 ms. Nothing round-trips a server to make the image. |
| Handles real photos | `coverRect` centre-crops to fill any aspect ratio, biased upward so portrait shots don't get beheaded — with a tighter bias on the PFP, whose top band would otherwise eat the head. |
| Downloadable output | `canvas.toBlob` → real PNG file on disk. |
| Share to X, pre-filled | `POST /api/share` stores the PNG in Vercel Blob and returns an id. The button opens `x.com/intent/post` with the caption and a link to `/f/<id>`. |
| Link preview shows the graphic | `app/f/[id]/page.js` sets `og:image` / `twitter:image` to the stored PNG, `summary_large_image`. |
| Share works even if the store is down | The API answers `501`, the client downloads the PNG and opens the composer with the caption, telling the user to attach it. Mobile also gets the native share sheet with the file attached. |
| `#FrameInGoa` | In the caption constant in `app/page.js`. |
| Mobile-friendly | Single-column, 16px inputs (no iOS zoom), tap-anywhere dropzone, `accept="image/*"` opens the camera roll. |
| Instantly recognisable branding | Format B is the key-art poster itself, redrawn as vectors: same palette, same border, same wordmark-in-a-wreath lockup. |
| Personalisation: name, stack, builder class | `lib/render.js` → `drawCard`. The class comes from `builderTitle`, hashed off name+stack so it never rerolls on a typo fix. Stack and class share a line, and split onto two when they would overrun. |

## Layout

```
lib/brand.js    palette, fonts, event copy  (mirrors ../brand/BRAND.md)
lib/art.js      generated SVG: the poster (border, tapa field, palm, wreath,
                photo window) and the Format A beach scene
lib/render.js   canvas pipeline for both formats + file decoding
preview.html    dev-only: renders a card straight to a canvas, no Next needed
                (`python3 -m http.server 8931`, then /preview.html?photo=1)
app/page.js     the whole UI
app/api/share/  PNG → Vercel Blob
app/f/[id]/     share landing page whose OG image is the generated graphic
```

Art is generated SVG rather than image assets, so every ornament scales to any
canvas size and the whole app ships in ~5 kB of page JS.

## Not built yet

The brief also asks for a **combined frame with your teammates** — one graphic
holding several builders. Single-photo generation is done; the multi-photo
layout is not.

## Known ceilings

- Blobs are never garbage-collected — fine for a hackathon, add a TTL sweep if
  this outlives the event.
- Format A is still the mint beach card, not the poster. The two formats no
  longer look like one system.
