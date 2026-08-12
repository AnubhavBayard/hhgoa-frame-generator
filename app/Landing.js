'use client';

import { useState } from 'react';
import GoaSticker from './GoaSticker';
import { EVENT, C } from '../lib/brand';

// Sun swallows the screen, then the tool fades in underneath. Two timers, no
// animation library: onReveal mounts the tool, onDone unmounts this overlay.
const BURST_MS = 1000;
const FADE_MS = 750;

// Blade + midrib, tip pointing along +x. Rotated copies make the corner cluster.
function Leaf({ rotate, len }) {
  return (
    <g transform={`rotate(${rotate}) scale(${len})`}>
      <path d="M0 0 C40 -32 110 -38 152 -5 C112 24 40 26 0 0 Z" />
      <path d="M4 0 C50 -4 108 -8 148 -6" fill="none" stroke="#0d4d1c" strokeWidth="3" />
    </g>
  );
}

function Palm() {
  return (
    <svg className="palm" viewBox="-14 -190 220 200" aria-hidden="true">
      <g fill="#3f9942" stroke="#0d4d1c" strokeWidth="4.5" strokeLinejoin="round">
        <Leaf rotate={-8} len={1} />
        <Leaf rotate={-40} len={1.1} />
        <Leaf rotate={-74} len={1.05} />
        <Leaf rotate={-104} len={0.85} />
      </g>
    </svg>
  );
}

// Screen-printed sunburst: wedges that widen as they leave the sun, long ones
// alternating with short, all fading out through a radial mask. Equal straight
// strokes were the tell — real print rays taper and never end on a hard line.
const RAYS = Array.from({ length: 17 }, (_, i) => {
  const long = i % 2 === 0;
  return {
    a: -96 + i * 12,
    r1: long ? 112 : 86,
    w: long ? 3.6 : 2.1,
    o: long ? 0.95 : 0.6,
  };
});

// The sun disc is ~52 units across every breakpoint (its clamp and the svg's
// track the same vw), so the beams start inside it and emerge from behind the
// rim — begin them outside it and every ray shows a hairline gap at its base.
const R0 = 46;

function wedge({ a, r1, w }) {
  const p = (r, deg) => {
    const t = (deg * Math.PI) / 180;
    return `${(r * Math.sin(t)).toFixed(2)} ${(-r * Math.cos(t)).toFixed(2)}`;
  };
  // narrow at the sun, wide at the tip
  return [p(R0, a - w * 0.3), p(r1, a - w), p(r1, a + w), p(R0, a + w * 0.3)].join(' ');
}

// Fixed table, not Math.random — random values differ between the server and
// client render and React would flag the mismatch. `front` puts a coconut in
// the layer above the wordmark; the rest fall behind it.
const COCONUTS = [
  { left: '4%', size: 30, delay: -1.5, dur: 11, drift: 26, spin: 300 },
  { left: '13%', size: 62, delay: -7.1, dur: 7.6, drift: -34, spin: -220, front: true },
  { left: '24%', size: 24, delay: -5.2, dur: 13, drift: 44, spin: 460 },
  { left: '33%', size: 46, delay: -9.4, dur: 9.2, drift: -18, spin: 180 },
  { left: '44%', size: 34, delay: -5.6, dur: 12.4, drift: 30, spin: -340, front: true },
  { left: '56%', size: 72, delay: -6.3, dur: 7.2, drift: -46, spin: 240 },
  { left: '64%', size: 27, delay: -11.2, dur: 14, drift: 22, spin: 520 },
  { left: '75%', size: 52, delay: -2.4, dur: 8.6, drift: 38, spin: -260, front: true },
  { left: '86%', size: 33, delay: -8.8, dur: 10.8, drift: -28, spin: 380 },
  { left: '95%', size: 58, delay: -4.4, dur: 8, drift: -40, spin: 200 },
];

export function Coconuts({ layer }) {
  return (
    <div className={`coconuts ${layer}`} aria-hidden="true">
      {COCONUTS.filter((c) => Boolean(c.front) === (layer === 'front')).map((c) => (
        <svg
          key={c.left}
          className="coconut"
          viewBox="0 0 40 40"
          style={{
            left: c.left,
            width: c.size,
            animationDelay: `${c.delay}s`,
            animationDuration: `${c.dur}s`,
            '--drift': `${c.drift}px`,
            '--spin': `${c.spin}deg`,
          }}
        >
          <circle cx="20" cy="20" r="18" fill="#6b3a17" stroke="#3d1f0b" strokeWidth="2" />
          <path d="M8 13 C16 8 26 8 33 14" fill="none" stroke="#8d5326" strokeWidth="3" />
          <g fill="#3d1f0b">
            <circle cx="15" cy="24" r="2.6" />
            <circle cx="24" cy="22" r="2.6" />
            <circle cx="20" cy="30" r="2.6" />
          </g>
        </svg>
      ))}
    </div>
  );
}

export default function Landing({ onReveal, onDone }) {
  const [burst, setBurst] = useState(false);

  function go() {
    if (burst) return;
    setBurst(true);
    setTimeout(onReveal, BURST_MS);
    setTimeout(onDone, BURST_MS + FADE_MS);
  }

  return (
    <div className={`landing${burst ? ' burst' : ''}`}>
      <Coconuts layer="back" />

      <div className="hero">
        <div className="topbar">
          <div className="logo">
            <span>2:47<em>PM</em></span>
            <span>STUDIO</span>
          </div>
          <div className="nav">
            <span className="hype">LET&apos;S GO</span>
            <span className="ticket">
              <button onClick={go}>GENERATE ID</button>
            </span>
          </div>
        </div>

        <div className="wordmark">
          <h1>HACKER HOUSE</h1>
          <span className="goa-float">
            <GoaSticker className="goa" />
          </span>
        </div>

        <div className="meta">
          <span>{EVENT.place} &nbsp;·&nbsp; {EVENT.dates}</span>
          <span>2:47 PM STUDIO</span>
        </div>

        <Palm />
        <Palm />
      </div>

      <Coconuts layer="front" />

      <svg className="rays" viewBox="-100 -100 200 100" aria-hidden="true">
        <defs>
          {/* the beams have no end, they just run out of light */}
          {/* userSpaceOnUse: the fade has to radiate from the sun at 0,0, not
              from the middle of the mask's bounding box */}
          <radialGradient id="ray-fade" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="118">
            <stop offset="0.44" stopColor="#fff" stopOpacity="1" />
            <stop offset="0.74" stopColor="#fff" stopOpacity="0.7" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
          {/* the mask's own box has to hold the long rays, which overshoot the
              viewBox — .rays is overflow: visible and they are meant to */}
          <mask id="ray-mask" maskUnits="userSpaceOnUse" x="-125" y="-125" width="250" height="125">
            <rect x="-125" y="-125" width="250" height="125" fill="url(#ray-fade)" />
          </mask>
        </defs>
        <g mask="url(#ray-mask)">
          {RAYS.map((r) => (
            <polygon key={r.a} points={wedge(r)} fill={C.yellow} opacity={r.o} />
          ))}
        </g>
      </svg>
      <div className="sun" />
    </div>
  );
}
