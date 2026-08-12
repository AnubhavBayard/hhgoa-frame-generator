// Sampled from the official HH Goa 2026 key art. See ../../brand/BRAND.md
export const C = {
  green: '#074C18',
  greenDeep: '#073914',
  yellow: '#F8E206',
  pink: '#E30670',
  leaf: '#99C953',
  orange: '#E59F11',
  cream: '#FFF7E0',
};

export const DISPLAY = 'Playfair Display';
export const DEVANAGARI = 'Yatra One';
export const UI = 'Space Grotesk';

export const EVENT = {
  dates: '28 – 31 OCT 2026',
  place: 'GOA, INDIA',
  hashtag: '#FrameInGoa',
};

// Canvas can't use a font it hasn't loaded — without this the first render
// silently falls back to Times.
export function loadFonts() {
  if (typeof document === 'undefined') return Promise.resolve();
  return Promise.all([
    document.fonts.load(`900 100px "${DISPLAY}"`),
    document.fonts.load(`400 100px "${DEVANAGARI}"`),
    document.fonts.load(`700 100px "${UI}"`),
    document.fonts.load(`400 100px "${UI}"`),
  ]).then(() => document.fonts.ready);
}
