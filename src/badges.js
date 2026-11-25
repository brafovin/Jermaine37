import { RANKS } from './data.js';

// Emblem-Pfade (100x100 Viewbox, Mitte 50/50)
const GLYPH = {
  0: '<text x="50" y="64" text-anchor="middle" font-size="40" font-weight="900" fill="#1a1d22" font-family="Arial Black,sans-serif">?</text>',
  1: '<path d="M30 58 L50 44 L70 58 L70 66 L50 52 L30 66Z" fill="#fff" fill-opacity=".9"/>',
  2: '<path d="M30 48 L50 34 L70 48 L70 56 L50 42 L30 56Z M30 64 L50 50 L70 64 L70 72 L50 58 L30 72Z" fill="#fff" fill-opacity=".9"/>',
  3: '<path d="M30 40 L50 26 L70 40 L70 47 L50 33 L30 47Z M30 54 L50 40 L70 54 L70 61 L50 47 L30 61Z M30 68 L50 54 L70 68 L70 75 L50 61 L30 75Z" fill="#fff" fill-opacity=".9"/>',
  4: '<path d="M50 28 L68 50 L50 74 L32 50Z" fill="#fff" fill-opacity=".92"/><path d="M50 28 L68 50 L50 50Z" fill="#000" fill-opacity=".18"/>',
  5: '<path d="M36 36 H64 L74 50 L50 78 L26 50Z" fill="#fff" fill-opacity=".92"/><path d="M36 36 L50 50 L64 36 M26 50 H74 M50 50 L50 78" stroke="#000" stroke-opacity=".25" fill="none" stroke-width="2"/>',
  6: '<path d="M56 24 L34 54 H48 L42 78 L68 46 H53Z" fill="#fff" fill-opacity=".95"/>',
  7: '<path d="M50 24 L57 42 L77 43 L61 55 L67 74 L50 63 L33 74 L39 55 L23 43 L43 42Z" fill="#fff" fill-opacity=".95"/>',
  8: '<path d="M50 22 C60 38 74 44 70 62 C68 72 58 78 50 78 C42 78 32 72 30 62 C28 52 38 46 42 36 C44 42 47 44 50 44 C52 38 50 30 50 22Z" fill="#fff" fill-opacity=".95"/>',
  9: '<path d="M26 66 L30 38 L42 52 L50 30 L58 52 L70 38 L74 66Z" fill="#fff"/><rect x="28" y="68" width="44" height="7" fill="#fff"/>',
};

export function badgeSVG(idx, size = 64) {
  const r = RANKS[idx];
  const id = 'g' + idx + '_' + size + '_' + Math.random().toString(36).slice(2, 6);
  const glow = idx === 9 ? `<circle cx="50" cy="50" r="48" fill="${r.color}" opacity=".25"/>` : '';
  return `<svg class="badge" width="${size}" height="${size}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="${r.color}"/><stop offset="1" stop-color="${r.color}" stop-opacity=".45"/></linearGradient></defs>
  ${glow}
  <path d="M50 4 L90 26 V70 L50 96 L10 70 V26Z" fill="#14171c" stroke="${r.color}" stroke-width="4"/>
  <path d="M50 12 L82 30 V66 L50 87 L18 66 V30Z" fill="url(#${id})" opacity=".85"/>
  ${idx === 0 ? '' : '<path d="M50 12 L82 30 V66 L50 87 L18 66 V30Z" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="1.5"/>'}
  ${GLYPH[idx]}
  </svg>`;
}
