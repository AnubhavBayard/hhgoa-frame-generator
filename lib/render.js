import { C, UI } from './brand.js';

export const PFP_SIZE = 1000;
// The supplied key-art frame is the card: 1792x2364 artwork served at 1:1 for a
// 1080-wide export. Every y below is a fraction of h so both track the artwork.
export const FRAME_SRC = '/frame.jpg';
// The same art with the photo window punched out (tools/cut-card.py). Drawn on
// top of the photo so the wavy yellow border overlaps its edges, exactly the way
// the PFP overlay works — a photo that stops short of the border reads as a
// picture dropped into a hole, not as part of the poster.
export const CARD_FRAME_SRC = '/card-frame.png';
export const CARD_W = 1080;
export const CARD_H = 1425;
// The PFP is two layers cut from profile.png: the printed art (its avatar
// silhouette is the empty state) and the same art with the well punched out, so
// an uploaded photo lands behind the wavy ring and the HACKER HOUSE sticker.
export const PFP_BACK_SRC = '/pfp-back.jpg';
export const PFP_FRAME_SRC = '/pfp-frame.png';
// Photo windows: the bounding box of each format's punched-out well.
// Measured off the cut: the bounds of the punched hole, which runs 3px under
// the wavy border on every side.
const WINDOW = { x: 0.2954, y: 0.1586, w: 0.4083, h: 0.3088 };
const PFP_WINDOW = { x: 0.179, y: 0.184, w: 0.645, h: 0.65 };
// Sampled off the artwork: its dark paper ground, and the two ink colours the
// print uses for text.
const CREAM = '#F4F0DF';
const YELLOW = '#F2E11C';

// --- pure helpers (covered by render.test.mjs) ------------------------------

// A window's fractions against the canvas it is drawn on.
export function windowRect(win, w, h) {
  return { x: win.x * w, y: win.y * h, w: win.w * w, h: win.h * h };
}

export const windows = { card: WINDOW, pfp: PFP_WINDOW };

// How far down the source each format's default crop starts. Exported so the
// crop dialog frames the photo exactly the way the export will.
export const bias = { card: 0.28, pfp: 0.22 };

// Centre-crop for a cover fit. Vertical crops are biased upward because faces
// live in the top half of a portrait photo — a centred crop beheads people.
// `bias` is how far down the source the crop window starts: the PFP needs a
// smaller one than the card, because its top band would otherwise eat the head.
export function coverRect(iw, ih, bw, bh, bias = 0.35) {
  const scale = Math.max(bw / iw, bh / ih);
  const sw = bw / scale;
  const sh = bh / scale;
  return { sx: (iw - sw) / 2, sy: (ih - sh) * bias, sw, sh };
}

// The user's pinch/drag on top of the cover fit. `zoom` shrinks the source crop
// (bigger photo), `x`/`y` slide it, both in units of the crop itself so a drag
// feels the same at any zoom. Clamped so the crop never leaves the source — a
// gap at the edge would show the printed well through the photo.
export function viewRect(iw, ih, bw, bh, bias = 0.35, view = {}) {
  const base = coverRect(iw, ih, bw, bh, bias);
  const zoom = Math.min(Math.max(view.zoom ?? 1, 1), 8);
  const sw = base.sw / zoom;
  const sh = base.sh / zoom;
  const clamp = (v, max) => Math.min(Math.max(v, 0), Math.max(max, 0));
  return {
    sx: clamp(base.sx + (base.sw - sw) / 2 - (view.x ?? 0) * sw, iw - sw),
    sy: clamp(base.sy + (base.sh - sh) / 2 - (view.y ?? 0) * sh, ih - sh),
    sw,
    sh,
  };
}

const TITLES = [
  'Ships At 3AM', 'Terminal Dweller', 'Merge Conflict Survivor', 'Rubber Duck Whisperer',
  'Prod Hotfix Legend', 'Regex Necromancer', 'Latency Hunter', 'Cache Invalidator',
  'Off-By-One Slayer', 'Yak Shaver Supreme', 'Green Build Believer', 'Feni-Powered Committer',
  'Beachside Debugger', 'Zero-Downtime Deployer', 'Stack Trace Diver', 'Semicolon Minimalist',
];

// Deterministic so the same builder always gets the same title — regenerating
// after a typo fix shouldn't reroll their identity.
export function builderTitle(name = '', stack = '') {
  const seed = `${name}|${stack}`.toLowerCase().trim();
  if (!seed.replace('|', '')) return TITLES[0];
  let h = 2166136261;
  for (const ch of seed) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return TITLES[h % TITLES.length];
}

// --- canvas helpers ---------------------------------------------------------

// The artwork never changes, so decode it once. Keystrokes in the name field
// re-render the card; re-decoding a 316KB JPEG each time is what would make a
// "live preview" feel laggy.
const imgCache = new Map();

export function loadImage(src) {
  let hit = imgCache.get(src);
  if (!hit) {
    hit = new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
    imgCache.set(src, hit);
  }
  return hit;
}

// Renders await image decodes, so two of them can interleave on one canvas and
// stack text on top of text. Serialise: last render wins, cleanly.
let chain = Promise.resolve();
function serial(task) {
  const next = chain.then(task, task);
  chain = next.then(
    () => {},
    () => {},
  );
  return next;
}

function drawCover(ctx, img, x, y, w, h, bias, view) {
  const { sx, sy, sw, sh } = viewRect(img.width, img.height, w, h, bias, view);
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

// Letter-spaced text is wider than measureText says — every gap but the last
// is extra. Without this a long stack line runs off the poster.
function trackedFit(ctx, text, weight, family, size, maxW, spacing) {
  const gaps = Math.max([...text].length - 1, 0);
  return fitFont(ctx, text, weight, family, size, maxW - gaps * spacing);
}

// The stack line has a floor: shrinking "Full-stack · Solidity · ML infra ·
// Green Build Believer" until it fits would set it in 9px. Trim instead.
function elideTracked(ctx, text, weight, family, size, maxW, spacing) {
  ctx.font = `${weight} ${size}px "${family}", sans-serif`;
  const width = (s) => ctx.measureText(s).width + Math.max([...s].length - 1, 0) * spacing;
  if (width(text) <= maxW) return text;
  let out = text;
  while (out.length > 1 && width(`${out}…`) > maxW) out = out.slice(0, -1);
  return `${out.trimEnd()}…`;
}

// Shrink until it fits. Long names and "Full-stack + ML infra" both happen.
function fitFont(ctx, text, weight, family, size, maxW) {
  let px = size;
  do {
    ctx.font = `${weight} ${px}px "${family}", sans-serif`;
    if (ctx.measureText(text).width <= maxW) break;
    px -= 2;
  } while (px > 12);
  return px;
}

// Returns the drawn width so callers can hang something (the monitor glyph)
// off the end of a centred, letter-spaced line.
function tracked(ctx, text, x, y, spacing) {
  const chars = [...text];
  const total = chars.reduce((sum, ch) => sum + ctx.measureText(ch).width + spacing, -spacing);
  let cur = x - total / 2;
  for (const ch of chars) {
    ctx.fillText(ch, cur + ctx.measureText(ch).width / 2, y);
    cur += ctx.measureText(ch).width + spacing;
  }
  return total;
}

// The card's photo well. No clip and no rounding: the photo fills the window's
// bounding box and the overlay drawn after it puts the wavy border back on top,
// so the border is what shapes the photo's edge. No photo yet means the printed
// green well shows through with a hint of what goes there.
function drawWell(ctx, img, box, view) {
  if (img) {
    drawCover(ctx, img, box.x, box.y, box.w, box.h, bias.card, view);
    return;
  }
  ctx.fillStyle = CREAM;
  ctx.globalAlpha = 0.45;
  // tracked() centres on the pen position, so it needs both of these — the PFP
  // path never sets them itself.
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `700 ${box.w * 0.078}px "${UI}", sans-serif`;
  tracked(ctx, 'YOUR PHOTO HERE', box.x + box.w / 2, box.y + box.h / 2, box.w * 0.028);
  ctx.globalAlpha = 1;
  ctx.textBaseline = 'alphabetic';
}

// --- Format A: PFP frame ----------------------------------------------------

export function renderPfp(canvas, img, view) {
  return serial(() => drawPfp(canvas, img, view));
}

async function drawPfp(canvas, img, view) {
  const s = PFP_SIZE;
  canvas.width = s;
  canvas.height = s;
  const ctx = canvas.getContext('2d');
  const [back, frame] = await Promise.all([
    loadImage(PFP_BACK_SRC),
    loadImage(PFP_FRAME_SRC),
  ]);
  // Back first, so the printed avatar shows until a photo replaces it and the
  // export is never transparent behind the cut-out's feathered edge.
  ctx.drawImage(back, 0, 0, s, s);
  // No clip: the overlay's punched well is the mask, and it puts the ring and
  // the sticker back on top of whatever the photo covers.
  if (img) {
    const well = windowRect(PFP_WINDOW, s, s);
    drawCover(ctx, img, well.x, well.y, well.w, well.h, bias.pfp, view);
  }
  ctx.drawImage(frame, 0, 0, s, s);
  return canvas;
}

// --- Format B: builder ID card ---------------------------------------------

export function renderCard(canvas, img, fields, view) {
  return serial(() => drawCard(canvas, img, fields, view));
}

async function drawCard(canvas, img, { name, role }, view) {
  const w = CARD_W;
  const h = CARD_H;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  // The artwork carries the border, palm, GOA INDIA, the dates and the wordmark
  // — nothing below redraws any of it.
  ctx.drawImage(await loadImage(FRAME_SRC), 0, 0, w, h);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  drawWell(ctx, img, windowRect(WINDOW, w, h), view);
  // border and everything else printed goes back over the photo's edges
  ctx.drawImage(await loadImage(CARD_FRAME_SRC), 0, 0, w, h);

  // Identity block — the part the artwork does not have and the brief requires:
  // name, stack, generated builder class.
  const safe = w * 0.7;
  // Stack and builder class share one line when they fit, and split onto two
  // when they don't — both are required by the brief, so neither may be cut.
  // Measured off frame.jpg: the printed wordmark above ends at 0.539h and the
  // wreath below starts at 0.660h, so the identity block lives in between. The
  // split tightens its line spacing rather than moving the name, which has no
  // room to rise — a two-line block on the old spacing ran into the wreath.
  const size = w * 0.025;
  const gap = w * 0.008;
  const cls = builderTitle(name, role).toUpperCase();
  const stack = (role || '').trim().slice(0, 48).toUpperCase();
  const joined = stack ? `${stack}  ·  ${cls}` : cls;
  ctx.font = `500 ${size}px "${UI}", sans-serif`;
  const width = (s) => ctx.measureText(s).width + Math.max([...s].length - 1, 0) * gap;
  const split = width(joined) > safe;

  const displayName = (name || 'YOUR NAME').trim().slice(0, 40).toUpperCase();
  ctx.fillStyle = YELLOW;
  trackedFit(ctx, displayName, 700, UI, w * 0.056, safe, w * 0.006);
  tracked(ctx, displayName, w / 2, h * (split ? 0.583 : 0.598), w * 0.006);

  ctx.fillStyle = C.leaf;
  ctx.font = `500 ${size}px "${UI}", sans-serif`;
  if (!split) {
    tracked(ctx, joined, w / 2, h * 0.634, gap);
  } else {
    tracked(ctx, elideTracked(ctx, stack, 500, UI, size, safe, gap), w / 2, h * 0.610, gap);
    ctx.font = `500 ${size}px "${UI}", sans-serif`;
    tracked(ctx, elideTracked(ctx, cls, 500, UI, size, safe, gap), w / 2, h * 0.638, gap);
  }
  return canvas;
}

// --- input ------------------------------------------------------------------

// HEIC only decodes natively in Safari, so everyone else pays for the converter
// — but only when they actually hand us a HEIC.
export async function decodeFile(file) {
  let source = file;
  const heic = /hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name || '');
  try {
    return await createImageBitmap(source, { imageOrientation: 'from-image' });
  } catch (err) {
    if (!heic) throw err;
  }
  const heic2any = (await import('heic2any')).default;
  source = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.92 });
  return createImageBitmap(source, { imageOrientation: 'from-image' });
}
