'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Landing, { Coconuts } from './Landing';
import GoaSticker from './GoaSticker';
import { loadFonts, EVENT } from '../lib/brand';
import {
  decodeFile, renderPfp, renderCard, viewRect, loadImage, windows, bias,
  PFP_SIZE, CARD_W, CARD_H, PFP_FRAME_SRC, CARD_FRAME_SRC,
} from '../lib/render';

// The post carries two links: this one is the event itself, the share link X
// appends is what renders the graphic as a card. Everything stated here comes
// from the brand sheet and hhgoa.com — nothing about the event is invented.
const SITE = 'hhgoa.com';

function caption(format) {
  const what = format === 'pfp' ? 'PFP frame' : 'builder ID';
  return [
    `Locked in for Hacker House Goa 2026 🌴`,
    `${EVENT.dates.replace(/\s+/g, ' ')} · ${EVENT.place} · 500 builders, one beach.`,
    `Just made my ${what} with the HH Goa generator.`,
    `Details: ${SITE}`,
    EVENT.hashtag,
  ].join('\n');
}

const ZOOM_MIN = 1;
const ZOOM_MAX = 8;
const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

// How to tell someone to paste, which is a keyboard shortcut on a desktop and
// a long-press on a phone. Only ever read inside a click handler, so the
// server's undefined navigator picks a branch nothing renders from.
const UA = typeof navigator === 'undefined' ? '' : navigator.userAgent;
const PASTE_HINT = /Android|iP(hone|ad|od)/.test(UA)
  ? 'long-press the post box and paste it'
  : `press ${/Mac/.test(UA) ? '⌘V' : 'Ctrl+V'} in the post box`;

function toBlob(canvas) {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}

function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export default function Home() {
  const [tool, setTool] = useState(false);
  const [landing, setLanding] = useState(true);

  return (
    <>
      {tool && <Tool />}
      {landing && (
        <Landing onReveal={() => setTool(true)} onDone={() => setLanding(false)} />
      )}
    </>
  );
}

function Tool() {
  const canvasRef = useRef(null);
  const [format, setFormat] = useState('pfp');
  const [img, setImg] = useState(null);
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [over, setOver] = useState(false);
  // pinch/drag on the photo inside its well; reset whenever the photo changes
  const [view, setView] = useState({ zoom: 1, x: 0, y: 0 });
  const [cropping, setCropping] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  // Latest canvas as a PNG, kept current by the draw effect. Sharing has to
  // reach navigator.share with nothing awaited in front of it, so the encode
  // cannot happen inside the click — and state rather than a ref because the
  // buttons stay disabled until there is something to hand over.
  const [png, setPng] = useState(null);

  useEffect(() => {
    loadFonts();
  }, []);

  // Re-render on every input change. A 1080px canvas draw is ~10ms, so there
  // is nothing here worth debouncing.
  useEffect(() => {
    // Both formats draw their own empty state, so the preview is live from the
    // first paint — you see the poster before you commit a photo to it.
    if (!canvasRef.current) return;
    let stale = false;
    setPng(null);
    loadFonts()
      .then(() => {
        if (stale) return;
        return format === 'pfp'
          ? renderPfp(canvasRef.current, img, view)
          : renderCard(canvasRef.current, img, { name, role }, view);
      })
      .then(() => (stale ? null : toBlob(canvasRef.current)))
      .then((blob) => {
        if (!stale && blob) setPng(blob);
      })
      .catch(() => setError('Could not draw that image. Try another one.'));
    return () => {
      stale = true;
    };
  }, [img, format, name, role, view]);

  const accept = useCallback(async (file) => {
    if (!file) return;
    setError('');
    setBusy('Reading photo…');
    try {
      setImg(await decodeFile(file));
      setView({ zoom: 1, x: 0, y: 0 });
      setNote('');
    } catch {
      setError('That file would not open. JPG, PNG, WEBP or HEIC please.');
    } finally {
      setBusy('');
    }
  }, []);

  const filename = `hh-goa-2026-${format === 'pfp' ? 'frame' : 'id-card'}.png`;

  async function download() {
    setBusy('Exporting…');
    saveBlob(png ?? (await toBlob(canvasRef.current)), filename);
    setBusy('');
  }

  async function shareToX(text) {
    setError('');
    setNote('');
    setBusy('Opening X…');

    // Straight to the composer: no share sheet to pick through, and no `url`
    // param, which X would paste into the post body as a link after the
    // hashtag. The graphic is attached by hand — nothing a web page can hand
    // X carries media, so the choice is a visible link or a manual attach.
    // Opened first, while the click still counts as a user gesture; `noopener`
    // in the features string would hand back null, so the opener is cut
    // manually.
    let tab = window.open('', '_blank');
    if (tab) tab.opener = null;

    // Clipboard first so the attach is a paste where that works — the X web
    // composer takes pasted images. Downloading and picking the file is the
    // fallback for browsers that will not write image/png.
    let pasteable = false;
    try {
      // ClipboardItem takes the promise unresolved: Safari rejects a write
      // whose data was awaited first. The encoded PNG is normally already in
      // hand, so this only re-encodes if a click beat the draw effect to it.
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': png ?? toBlob(canvasRef.current) }),
      ]);
      pasteable = true;
    } catch {
      /* no permission, no ClipboardItem, or no image/png support */
    }
    setNote(
      pasteable
        ? `Image copied — ${PASTE_HINT} to attach it.`
        : 'Use DOWNLOAD PNG and attach it to the post.',
    );
    const url = new URL('https://x.com/intent/post');
    url.searchParams.set('text', text);
    // The blank tab is already open; navigating it is never blocked. If the
    // browser refused it up front, take this tab instead of losing the post.
    if (tab) tab.location.href = url.toString();
    else window.location.href = url.toString();
    setBusy('');
  }

  // Same activation rule as shareToX: reach navigator.share with the PNG the
  // draw effect already encoded, never with one awaited inside the click.
  async function shareNative() {
    if (!png) return;
    const file = new File([png], filename, { type: 'image/png' });
    try {
      await navigator.share({ files: [file], text: caption(format) });
    } catch {
      /* user dismissed the sheet */
    }
  }

  const canShareFiles =
    typeof navigator !== 'undefined' &&
    navigator.canShare?.({
      files: [new File([], 'x.png', { type: 'image/png' })],
    });

  return (
    <main className="revealed">
      <Coconuts layer="back" />
      <div className="panel">
        <header>
          <p className="eyebrow">{EVENT.place}</p>
          <div className="lockup">
            <h1>
              HACKER
              <br />
              HOUSE
            </h1>
            <GoaSticker className="goa-mark" />
          </div>
          <p className="dates">{EVENT.dates}</p>
        </header>

        <div className="rule" />

        <div className="tabs" role="group" aria-label="Graphic format">
          <button aria-pressed={format === 'pfp'} onClick={() => setFormat('pfp')}>
            PFP FRAME
          </button>
          <button aria-pressed={format === 'card'} onClick={() => setFormat('card')}>
            BUILDER ID
          </button>
        </div>

        <label
          className={`drop${over ? ' over' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            accept(e.dataTransfer.files[0]);
          }}
        >
          <strong>{img ? 'Swap photo' : 'Drop or tap to add your photo'}</strong>
          <span>JPG · PNG · WEBP · HEIC — any crop, we handle it</span>
          <input
            type="file"
            accept="image/*,.heic,.heif"
            onChange={(e) => accept(e.target.files[0])}
          />
        </label>

        {format === 'card' && (
          <div className="fields">
            <div>
              <label htmlFor="name">NAME</label>
              <input
                id="name"
                type="text"
                value={name}
                maxLength={40}
                placeholder="Utsav"
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="role">STACK / ROLE</label>
              <input
                id="role"
                type="text"
                value={role}
                maxLength={48}
                placeholder="Full-stack · Solidity"
                onChange={(e) => setRole(e.target.value)}
              />
            </div>
            <p className="muted">
              Builder class is generated from your name and stack — it lands on the card
              next to your role.
            </p>
          </div>
        )}

        <div className="preview">
          <canvas
            ref={canvasRef}
            className={img ? 'clickable' : undefined}
            width={format === 'pfp' ? PFP_SIZE : CARD_W}
            height={format === 'pfp' ? PFP_SIZE : CARD_H}
            onClick={() => img && setCropping(true)}
          />
          {img && (
            <p className="muted">
              <button type="button" className="linky" onClick={() => setCropping(true)}>
                Tap the photo to crop it
              </button>
            </p>
          )}
        </div>

        {error && <p className="muted err">{error}</p>}
        {note && <p className="muted">{note}</p>}
        {busy && <p className="muted">{busy}</p>}

        <div className="actions">
          <button className="btn primary" disabled={!img || !png || !!busy} onClick={download}>
            DOWNLOAD PNG
          </button>
          <button className="btn x" disabled={!img || !png || !!busy} onClick={() => shareToX(caption(format))}>
            SHARE TO X
          </button>
          {canShareFiles && (
            <button className="btn" disabled={!img || !png || !!busy} onClick={shareNative}>
              SHARE ELSEWHERE
            </button>
          )}
        </div>

        <footer>{EVENT.hashtag} · LESS NOISE. MORE SIGNAL.</footer>
      </div>

      {cropping && img && (
        <Cropper
          img={img}
          format={format}
          view={view}
          onCancel={() => setCropping(false)}
          onApply={(next) => {
            setView(next);
            setCropping(false);
          }}
        />
      )}
    </main>
  );
}

// --- crop dialog -------------------------------------------------------------
// The whole photo is drawn on a stage; the crop shape sits over it — a circle
// for the PFP well, a rectangle for the ID card window — and everything outside
// that shape is dimmed. Framing is computed with the same viewRect() the export
// uses, so what the shape holds is exactly what lands on the artwork.
const STAGE_W = 264;
const STAGE_H = 300;
const CROP_W = 190;

function Cropper({ img, format, view, onCancel, onApply }) {
  const stageRef = useRef(null);
  const canvasRef = useRef(null);
  const [draft, setDraft] = useState(view);
  // Both arts sit ON the photo, not just around it: the PFP's HACKER HOUSE
  // sticker covers half the well's bottom-left quadrant, and the card's wavy
  // border runs over every edge. Painting the overlay inside the crop shape is
  // the only honest preview of what survives.
  const [overlay, setOverlay] = useState(null);

  useEffect(() => {
    let stale = false;
    loadImage(format === 'pfp' ? PFP_FRAME_SRC : CARD_FRAME_SRC).then(
      (el) => !stale && setOverlay(el),
      () => {},
    );
    return () => {
      stale = true;
    };
  }, [format]);

  const win = windows[format];
  const size = format === 'pfp' ? { w: PFP_SIZE, h: PFP_SIZE } : { w: CARD_W, h: CARD_H };
  // the well in export pixels — the crop shape carries its aspect exactly
  const wellW = win.w * size.w;
  const wellH = win.h * size.h;
  const cropH = CROP_W * (wellH / wellW);
  const cropX = (STAGE_W - CROP_W) / 2;
  const cropY = (STAGE_H - cropH) / 2;

  useEffect(() => {
    const el = canvasRef.current;
    const dpr = window.devicePixelRatio || 1;
    el.width = STAGE_W * dpr;
    el.height = STAGE_H * dpr;
    const ctx = el.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, STAGE_W, STAGE_H);
    // the crop shape shows viewRect's source window, so scale the whole photo by
    // however much that window has to grow to fill it, then slide it into place
    const r = viewRect(img.width, img.height, wellW, wellH, bias[format], draft);
    const k = CROP_W / r.sw;
    ctx.drawImage(img, cropX - r.sx * k, cropY - r.sy * k, img.width * k, img.height * k);

    // the overlay is clipped to the crop shape: outside it the dimmed photo
    // still shows the context you are panning through
    if (overlay) {
      const s = CROP_W / wellW;
      ctx.save();
      ctx.beginPath();
      if (format === 'pfp') {
        ctx.ellipse(cropX + CROP_W / 2, cropY + cropH / 2, CROP_W / 2, cropH / 2, 0, 0, Math.PI * 2);
      } else {
        ctx.rect(cropX, cropY, CROP_W, cropH);
      }
      ctx.clip();
      ctx.drawImage(
        overlay,
        cropX - win.x * size.w * s,
        cropY - win.y * size.h * s,
        size.w * s,
        size.h * s,
      );
      ctx.restore();
    }
  }, [img, format, draft, overlay, win, size, wellW, wellH, cropH, cropX, cropY]);

  // one pointer pans, two pinch — same gestures, now inside the dialog
  const pointers = useRef(new Map());
  const pinch = useRef(0);

  function onPointerDown(e) {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    pinch.current = 0;
  }

  function onPointerMove(e) {
    const pts = pointers.current;
    const prev = pts.get(e.pointerId);
    if (!prev) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pts.size > 1) {
      const [a, b] = [...pts.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch.current) {
        const factor = dist / pinch.current;
        setDraft((v) => ({ ...v, zoom: clamp(v.zoom * factor, ZOOM_MIN, ZOOM_MAX) }));
      }
      pinch.current = dist;
      return;
    }

    // deltas are fractions of the crop shape, which is the unit viewRect pans in
    const dx = (e.clientX - prev.x) / CROP_W;
    const dy = (e.clientY - prev.y) / cropH;
    setDraft((v) => ({ ...v, x: v.x + dx, y: v.y + dy }));
  }

  function endPointer(e) {
    pointers.current.delete(e.pointerId);
    pinch.current = 0;
  }

  useEffect(() => {
    const el = stageRef.current;
    const onWheel = (e) => {
      e.preventDefault();
      setDraft((v) => ({
        ...v,
        zoom: clamp(v.zoom * Math.exp(-e.deltaY / 300), ZOOM_MIN, ZOOM_MAX),
      }));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  return (
    <div
      className="modal-back"
      role="dialog"
      aria-modal="true"
      aria-label="Crop your photo"
      onMouseDown={(e) => e.target === e.currentTarget && onCancel()}
      onKeyDown={(e) => e.key === 'Escape' && onCancel()}
    >
      <div className="modal">
        <h2>FRAME YOUR PHOTO</h2>

        <div
          ref={stageRef}
          className="crop-stage"
          style={{ width: STAGE_W, height: STAGE_H }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endPointer}
          onPointerCancel={endPointer}
        >
          <canvas
            className="crop-photo"
            ref={canvasRef}
            style={{ width: STAGE_W, height: STAGE_H }}
          />
          <div
            className={`crop-shape${format === 'pfp' ? ' round' : ''}`}
            style={{
              left: cropX,
              top: cropY,
              width: CROP_W,
              height: cropH,
              // the card's photo is clipped with this same radius on export
              borderRadius: format === 'pfp' ? undefined : CROP_W * 0.055,
            }}
          />
        </div>

        <button className="linky reset" onClick={() => setDraft({ zoom: 1, x: 0, y: 0 })}>
          reset
        </button>

        <label htmlFor="zoom">ZOOM</label>
        <input
          id="zoom"
          type="range"
          min={ZOOM_MIN}
          max={ZOOM_MAX}
          step={0.02}
          value={draft.zoom}
          onChange={(e) => setDraft((v) => ({ ...v, zoom: Number(e.target.value) }))}
        />
        <p className="muted">Drag to move · pinch, scroll or use the slider to zoom</p>

        <div className="modal-actions">
          <button className="btn" onClick={onCancel}>
            CANCEL
          </button>
          <button className="btn primary" onClick={() => onApply(draft)}>
            USE THIS CROP
          </button>
        </div>
      </div>
    </div>
  );
}
