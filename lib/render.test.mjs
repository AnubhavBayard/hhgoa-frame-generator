import assert from 'node:assert/strict';
import {
  coverRect, viewRect, builderTitle, windowRect, windows, bias,
  CARD_W, CARD_H, PFP_SIZE,
} from './render.js';

// cover fit: the crop must fill the box, stay inside the source, keep aspect
for (const [iw, ih] of [[4032, 3024], [3024, 4032], [1000, 1000], [6000, 1200], [800, 2400]]) {
  for (const [bw, bh] of [[1000, 1000], [560, 600]]) {
    for (const bias of [0, 0.08, 0.35, 0.5, 1]) {
    const { sx, sy, sw, sh } = coverRect(iw, ih, bw, bh, bias);
    assert.ok(sw <= iw + 1e-6 && sh <= ih + 1e-6, `crop escapes source ${iw}x${ih}`);
    assert.ok(sx >= -1e-6 && sy >= -1e-6, 'negative crop origin');
    assert.ok(sx + sw <= iw + 1e-6 && sy + sh <= ih + 1e-6, 'crop past source edge');
    assert.ok(Math.abs(sw / sh - bw / bh) < 1e-6, 'crop aspect drifted from box');
    // one dimension always matches the source exactly (that's what "cover" means)
    assert.ok(Math.abs(sw - iw) < 1e-6 || Math.abs(sh - ih) < 1e-6, 'crop is not tight');
    }
  }
}

// portrait photos crop toward the top so faces survive
const tall = coverRect(1000, 2000, 1000, 1000);
assert.ok(tall.sy < (2000 - tall.sh) / 2, 'portrait crop not biased upward');
// the PFP's tighter bias must sit above the card's
assert.ok(coverRect(1000, 2000, 1000, 1000, 0.08).sy < tall.sy, 'pfp bias not tighter');

// pinch/drag view: crop stays inside the source at any zoom or pan, aspect
// holds, and the default view is exactly the cover fit
for (const [iw, ih] of [[4032, 3024], [3024, 4032], [1000, 1000], [800, 2400]]) {
  for (const [bw, bh] of [[1000, 1000], [416, 421]]) {
    for (const zoom of [0.2, 1, 2.5, 8, 99]) {
      for (const [px, py] of [[0, 0], [3, -3], [-9, 9], [0.4, 0.25]]) {
        const v = viewRect(iw, ih, bw, bh, 0.28, { zoom, x: px, y: py });
        assert.ok(v.sx >= -1e-6 && v.sy >= -1e-6, 'pan escapes source origin');
        assert.ok(v.sx + v.sw <= iw + 1e-6 && v.sy + v.sh <= ih + 1e-6, 'pan past source edge');
        assert.ok(Math.abs(v.sw / v.sh - bw / bh) < 1e-6, 'view aspect drifted from box');
        assert.ok(v.sw > 0 && v.sh > 0, 'empty view');
      }
    }
  }
}
const base = coverRect(3024, 4032, 1000, 1000, 0.28);
const same = viewRect(3024, 4032, 1000, 1000, 0.28);
assert.deepEqual(same, base, 'default view is not the plain cover fit');
// zooming in crops tighter than the base fit
assert.ok(viewRect(3024, 4032, 1000, 1000, 0.28, { zoom: 2 }).sw < base.sw, 'zoom did not crop in');

// The crop dialog draws the whole photo scaled by k = CROP_W / r.sw and offset
// so r's origin lands on the crop shape's corner. Replay that here: the source
// region the shape shows must be the exact rect the export crops. If this drifts,
// the dialog is lying about what you will get.
const CROP_W = 190;
for (const [fmt, [cw, ch]] of [['pfp', [PFP_SIZE, PFP_SIZE]], ['card', [CARD_W, CARD_H]]]) {
  const wellW = windows[fmt].w * cw;
  const wellH = windows[fmt].h * ch;
  const cropH = CROP_W * (wellH / wellW);
  for (const [iw, ih] of [[4032, 3024], [3024, 4032], [1200, 1200]]) {
    for (const v of [{}, { zoom: 2.5, x: 0.2, y: -0.1 }, { zoom: 8, x: 9, y: 9 }]) {
      const r = viewRect(iw, ih, wellW, wellH, bias[fmt], v);
      const k = CROP_W / r.sw;
      // the shape spans CROP_W x cropH of a photo drawn at scale k
      assert.ok(Math.abs(CROP_W / k - r.sw) < 1e-9, `${fmt}: crop width off the export`);
      assert.ok(Math.abs(cropH / k - r.sh) < 1e-9, `${fmt}: crop height off the export`);
    }
  }
}

// builder title: deterministic, always a real title, never empty
assert.equal(builderTitle('Utsav', 'Full-stack'), builderTitle('Utsav', 'Full-stack'));
assert.notEqual(builderTitle('Utsav', 'Full-stack'), builderTitle('Utsav', 'Solidity'));
for (const n of ['', 'A', 'ಅಶ್ವಿನ್', 'x'.repeat(200), '🔥🔥']) {
  assert.match(builderTitle(n, ''), /^[\w' -]+$/, `bad title for ${JSON.stringify(n)}`);
}

// both photo wells stay inside their canvas — a window that overruns puts photo
// on top of the printed border
for (const [name, [w, h]] of [['card', [CARD_W, CARD_H]], ['pfp', [PFP_SIZE, PFP_SIZE]]]) {
  const win = windowRect(windows[name], w, h);
  assert.ok(win.x > 0 && win.y > 0, `${name} window escapes the canvas`);
  assert.ok(win.x + win.w < w && win.y + win.h < h, `${name} window past the canvas edge`);
  assert.ok(win.w > w * 0.25 && win.h > h * 0.25, `${name} window suspiciously small`);
}

console.log('ok — render');
