// ---------- Ränge ----------
export const RANKS = [
  { id: 'unranked', name: 'Unranked', color: '#8a8f98', min: -1 },
  { id: 'bronze', name: 'Bronze', color: '#c9854a', min: 0 },
  { id: 'silber', name: 'Silber', color: '#cfd6dd', min: 100 },
  { id: 'gold', name: 'Gold', color: '#f2c14e', min: 250 },
  { id: 'platin', name: 'Platin', color: '#3fd4c0', min: 450 },
  { id: 'diamant', name: 'Diamant', color: '#4aa8ff', min: 700 },
  { id: 'elite', name: 'Elite', color: '#ff4d5e', min: 1000 },
  { id: 'master', name: 'Master', color: '#b46bff', min: 1400 },
  { id: 'mythik', name: 'Mythik', color: '#ff7a2f', min: 1900 },
  { id: 'champion', name: 'Champion', color: '#ffd84a', min: 2500 },
];
export const PLACEMENT_MATCHES = 3;
const ROMAN = ['III', 'II', 'I'];

export function getRank(rp, rankedPlayed) {
  if (rankedPlayed < PLACEMENT_MATCHES) {
    return { idx: 0, rank: RANKS[0], tier: '', label: 'Unranked', progress: rankedPlayed / PLACEMENT_MATCHES, next: null, placing: true };
  }
  let idx = 1;
  for (let i = 1; i < RANKS.length; i++) if (rp >= RANKS[i].min) idx = i;
  const rank = RANKS[idx];
  const next = RANKS[idx + 1] || null;
  let tier = '', progress = 1;
  if (next) {
    const span = next.min - rank.min;
    const f = Math.min(0.999, Math.max(0, (rp - rank.min) / span));
    tier = ROMAN[Math.floor(f * 3)];
    progress = f;
  }
  return { idx, rank, tier, label: rank.name + (tier ? ' ' + tier : ''), progress, next, placing: false };
}

// RP-Änderung pro Ranked-Match
export function rpForMatch(placement, kills, rankIdx) {
  let base;
  if (placement === 1) base = 60;
  else if (placement <= 5) base = 40;
  else if (placement <= 10) base = 28;
  else if (placement <= 25) base = 14;
  else if (placement <= 50) base = 0;
  else base = -(12 + Math.max(0, rankIdx - 1) * 2);
  return base + Math.min(kills, 10) * 5;
}

// ---------- Munition & Seltenheit ----------
export const AMMO = {
  light: { name: 'Leichte Munition', color: '#ffd24a' },
  medium: { name: 'Mittlere Munition', color: '#7ad0ff' },
  heavy: { name: 'Schwere Munition', color: '#ff7a7a' },
  shells: { name: 'Schrotpatronen', color: '#ff9a4a' },
  rocket: { name: 'Raketen', color: '#c06bff' },
};
export const RARITY = [
  { id: 'common', name: 'Gewöhnlich', color: '#b8c0c8' },
  { id: 'uncommon', name: 'Ungewöhnlich', color: '#5fd35f' },
  { id: 'rare', name: 'Selten', color: '#4aa3ff' },
  { id: 'epic', name: 'Episch', color: '#b25cff' },
  { id: 'legendary', name: 'Legendär', color: '#ffb020' },
];

// ---------- 20 Waffen ----------
// dmg = Schaden pro Treffer (pro Kugel), rpm = Schuss/Minute, spread = Streuung (Grad) Hüftschuss
export const WEAPONS = [
  { id: 'sidekick', name: 'Sidekick', cls: 'Pistole', model: 'pistol', rarity: 0, dmg: 24, rpm: 420, auto: false, mag: 12, ammo: 'light', reload: 1.4, spread: 2.0, range: 90, pellets: 1, recoil: 0.7, zoom: 1.25, speed: 1.0 },
  { id: 'magnum', name: 'Magnum .357', cls: 'Revolver', model: 'pistol', rarity: 2, dmg: 64, rpm: 140, auto: false, mag: 6, ammo: 'medium', reload: 2.3, spread: 1.4, range: 130, pellets: 1, recoil: 2.4, zoom: 1.3, speed: 1.0 },
  { id: 'viper', name: 'Viper', cls: 'MP', model: 'smg', rarity: 0, dmg: 17, rpm: 900, auto: true, mag: 30, ammo: 'light', reload: 1.9, spread: 3.2, range: 55, pellets: 1, recoil: 0.5, zoom: 1.4, speed: 1.0 },
  { id: 'hornet', name: 'Hornet', cls: 'MP', model: 'smg', rarity: 1, dmg: 19, rpm: 760, auto: true, mag: 32, ammo: 'light', reload: 2.0, spread: 2.8, range: 62, pellets: 1, recoil: 0.55, zoom: 1.4, speed: 1.0 },
  { id: 'stinger', name: 'Stinger', cls: 'MP', model: 'smg', rarity: 1, dmg: 14, rpm: 1100, auto: true, mag: 40, ammo: 'light', reload: 2.2, spread: 3.8, range: 45, pellets: 1, recoil: 0.45, zoom: 1.4, speed: 1.0 },
  { id: 'falcon', name: 'Falcon AR', cls: 'Sturmgewehr', model: 'ar', rarity: 1, dmg: 27, rpm: 660, auto: true, mag: 30, ammo: 'medium', reload: 2.3, spread: 2.4, range: 110, pellets: 1, recoil: 1.0, zoom: 1.7, speed: 0.97 },
  { id: 'ranger', name: 'Ranger', cls: 'Sturmgewehr', model: 'ar', rarity: 2, dmg: 31, rpm: 580, auto: true, mag: 30, ammo: 'medium', reload: 2.4, spread: 2.2, range: 118, pellets: 1, recoil: 1.2, zoom: 1.7, speed: 0.97 },
  { id: 'bulldog', name: 'Bulldog', cls: 'Sturmgewehr', model: 'ar', rarity: 2, dmg: 34, rpm: 520, auto: true, mag: 25, ammo: 'medium', reload: 2.5, spread: 2.3, range: 125, pellets: 1, recoil: 1.45, zoom: 1.7, speed: 0.95 },
  { id: 'titan', name: 'Titan', cls: 'Sturmgewehr', model: 'ar', rarity: 3, dmg: 38, rpm: 450, auto: true, mag: 20, ammo: 'medium', reload: 2.6, spread: 2.0, range: 135, pellets: 1, recoil: 1.7, zoom: 1.8, speed: 0.95 },
  { id: 'marksman', name: 'Marksman', cls: 'DMR', model: 'dmr', rarity: 2, dmg: 54, rpm: 230, auto: false, mag: 15, ammo: 'medium', reload: 2.6, spread: 1.4, range: 230, pellets: 1, recoil: 1.5, zoom: 2.5, speed: 0.95 },
  { id: 'hawk', name: 'Hawk', cls: 'DMR', model: 'dmr', rarity: 3, dmg: 62, rpm: 180, auto: false, mag: 10, ammo: 'medium', reload: 2.8, spread: 1.2, range: 250, pellets: 1, recoil: 1.8, zoom: 3.0, speed: 0.93 },
  { id: 'hammer', name: 'Hammer LMG', cls: 'LMG', model: 'lmg', rarity: 3, dmg: 29, rpm: 720, auto: true, mag: 100, ammo: 'heavy', reload: 5.0, spread: 3.4, range: 120, pellets: 1, recoil: 1.1, zoom: 1.6, speed: 0.86 },
  { id: 'anvil', name: 'Anvil LMG', cls: 'LMG', model: 'lmg', rarity: 3, dmg: 35, rpm: 600, auto: true, mag: 75, ammo: 'heavy', reload: 5.4, spread: 3.2, range: 130, pellets: 1, recoil: 1.35, zoom: 1.6, speed: 0.84 },
  { id: 'breacher', name: 'Breacher', cls: 'Schrotflinte', model: 'shotgun', rarity: 1, dmg: 14, rpm: 70, auto: false, mag: 6, ammo: 'shells', reload: 3.0, spread: 5.5, range: 32, pellets: 10, recoil: 2.6, zoom: 1.2, speed: 0.98 },
  { id: 'scatter', name: 'Scatter-X', cls: 'Schrotflinte', model: 'shotgun', rarity: 2, dmg: 11, rpm: 90, auto: false, mag: 8, ammo: 'shells', reload: 3.2, spread: 5.0, range: 30, pellets: 12, recoil: 2.2, zoom: 1.2, speed: 0.98 },
  { id: 'auto12', name: 'Auto-12', cls: 'Schrotflinte', model: 'shotgun', rarity: 3, dmg: 9, rpm: 250, auto: true, mag: 12, ammo: 'shells', reload: 3.5, spread: 5.8, range: 26, pellets: 8, recoil: 1.9, zoom: 1.2, speed: 0.95 },
  { id: 'longshot', name: 'Longshot', cls: 'Scharfschütze', model: 'sniper', rarity: 3, dmg: 110, rpm: 48, auto: false, mag: 5, ammo: 'heavy', reload: 3.2, spread: 0.1, range: 650, pellets: 1, recoil: 3.4, zoom: 6.0, speed: 0.92 },
  { id: 'phantom', name: 'Phantom', cls: 'Scharfschütze', model: 'sniper', rarity: 4, dmg: 88, rpm: 115, auto: false, mag: 8, ammo: 'heavy', reload: 3.4, spread: 0.15, range: 550, pellets: 1, recoil: 2.6, zoom: 5.0, speed: 0.92 },
  { id: 'reaper', name: 'Reaper .50', cls: 'Scharfschütze', model: 'sniper', rarity: 4, dmg: 135, rpm: 38, auto: false, mag: 3, ammo: 'heavy', reload: 3.8, spread: 0.1, range: 750, pellets: 1, recoil: 4.4, zoom: 8.0, speed: 0.88 },
  { id: 'boomstick', name: 'Boomstick', cls: 'Raketenwerfer', model: 'launcher', rarity: 4, dmg: 140, rpm: 40, auto: false, mag: 1, ammo: 'rocket', reload: 3.6, spread: 0.6, range: 400, pellets: 1, recoil: 3.0, zoom: 1.3, speed: 0.85, rocket: true, splash: 7.5 },
];
export const WEAPON_BY_ID = Object.fromEntries(WEAPONS.map((w) => [w.id, w]));

// ---------- Skins (Shop) ----------
export const SKINS = [
  { id: 'default', name: 'Wüsten-Camo', price: 0, rarity: 0, color: 0xc9761a, accent: 0x2a2216, emissive: 0x000000, camo: ['#c9761a', '#7a4e1c', '#1b1611'] },
  { id: 'desert', name: 'Wüstensand', price: 400, rarity: 1, color: 0xb99a63, accent: 0x7d6638, emissive: 0x000000 },
  { id: 'arctic', name: 'Arktis', price: 600, rarity: 1, color: 0xcfd8de, accent: 0x8fa1ad, emissive: 0x000000 },
  { id: 'toxic', name: 'Toxic', price: 900, rarity: 2, color: 0x2f3a2c, accent: 0x66ff3a, emissive: 0x1d8a00 },
  { id: 'crimson', name: 'Crimson Ops', price: 1200, rarity: 2, color: 0x3a1417, accent: 0xff2a3d, emissive: 0x7a0010 },
  { id: 'violet', name: 'Neon Violett', price: 1800, rarity: 3, color: 0x3a2a33, accent: 0xb43cff, emissive: 0x6a12b8 },
  { id: 'gold', name: 'Königsgold', price: 3000, rarity: 4, color: 0xd9a520, accent: 0xfff0a0, emissive: 0x5a3c00 },
  { id: 'diamond', name: 'Diamant', price: 4000, rarity: 4, color: 0x4aa8ff, accent: 0xbfe6ff, emissive: 0x0b4a8a },
  { id: 'digital', name: 'Digital-Camo', price: 1000, rarity: 1, color: 0x5a6a4a, accent: 0x2a3322, emissive: 0, camo: ['#6a7a52', '#3f4a33', '#8a9a70'], pattern: 'digital' },
  { id: 'tiger', name: 'Tigerstreifen', price: 1600, rarity: 2, color: 0xd08a20, accent: 0x2a1c08, emissive: 0, camo: ['#d99a2a', '#2b1a08', '#a8661a'], pattern: 'stripes' },
  { id: 'carbon', name: 'Karbonfaser', price: 1400, rarity: 2, color: 0x22262b, accent: 0x7a8088, emissive: 0, camo: ['#1c1f23', '#2c3137', '#0f1113'], pattern: 'carbon' },
  { id: 'marble', name: 'Marmor', price: 2200, rarity: 3, color: 0xe8e8ee, accent: 0x9aa0b0, emissive: 0, camo: ['#ececf2', '#9aa0b4', '#5a6078'], pattern: 'marble' },
  { id: 'hex', name: 'Hex-Tech', price: 2600, rarity: 3, color: 0x14303a, accent: 0x30e0ff, emissive: 0x0a6a80, camo: ['#102a34', '#14424e', '#30e0ff'], pattern: 'hex' },
  { id: 'flame', name: 'Inferno', price: 3200, rarity: 4, color: 0x2a0c06, accent: 0xff6a1a, emissive: 0x802000, camo: ['#2a0c06', '#c0360a', '#ffb020'], pattern: 'flame' },
];
// Skin-Farben: färben die ausgerüstete Waffenlackierung um
export const COLORS = [
  { id: 'orig', name: 'Original', price: 0, rarity: 0, hex: null },
  { id: 'crimson', name: 'Karmesin', price: 500, rarity: 1, hex: 0xe03030 },
  { id: 'ocean', name: 'Ozean', price: 500, rarity: 1, hex: 0x2f7fe0 },
  { id: 'toxic', name: 'Gift', price: 600, rarity: 1, hex: 0x40d040 },
  { id: 'sun', name: 'Sonne', price: 700, rarity: 2, hex: 0xf0c020 },
  { id: 'violet', name: 'Violett', price: 800, rarity: 2, hex: 0xa040e0 },
  { id: 'pink', name: 'Pink', price: 900, rarity: 2, hex: 0xff5aa0 },
  { id: 'cyan', name: 'Cyan', price: 900, rarity: 2, hex: 0x20d0d0 },
  { id: 'snow', name: 'Schnee', price: 1200, rarity: 3, hex: 0xeeeeee },
  { id: 'shadow', name: 'Schatten', price: 1500, rarity: 3, hex: 0x303036 },
];
export const COLOR_BY_ID = Object.fromEntries(COLORS.map((c) => [c.id, c]));
// Charakter-Skins: Tönung des Soldaten
export const CHARS = [
  { id: 'standard', name: 'Standard', price: 0, rarity: 0, tint: 0xffffff },
  { id: 'desert', name: 'Wüstenjäger', price: 600, rarity: 1, tint: 0xe0c898 },
  { id: 'forest', name: 'Waldläufer', price: 600, rarity: 1, tint: 0x9cc89c },
  { id: 'arctic', name: 'Polar', price: 900, rarity: 2, tint: 0xeaf2ff },
  { id: 'night', name: 'Nachtschatten', price: 1200, rarity: 2, tint: 0x6a6a78 },
  { id: 'blood', name: 'Blutrot', price: 1400, rarity: 3, tint: 0xe08080 },
  { id: 'royal', name: 'Königsgarde', price: 1800, rarity: 3, tint: 0x9ab0ff },
  { id: 'gold', name: 'Goldelite', price: 3000, rarity: 4, tint: 0xffd860 },
];
export const CHAR_BY_ID = Object.fromEntries(CHARS.map((c) => [c.id, c]));
export const ITEMS = { skin: SKINS, color: COLORS, char: CHARS };
export const ITEM_LABEL = { skin: 'Waffenlackierung', color: 'Skin-Farbe', char: 'Charakter-Skin' };
export const ITEM_BY = (type, id) => (type === 'skin' ? SKIN_BY_ID : type === 'color' ? COLOR_BY_ID : CHAR_BY_ID)[id];

// Farbvariante einer Lackierung (Farbton der Palette wird verschoben)
const toHsl = (h) => { const r = ((h >> 16) & 255) / 255, g = ((h >> 8) & 255) / 255, b = (h & 255) / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2; let hh = 0, ss = 0; if (mx !== mn) { const d = mx - mn; ss = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); hh = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; hh /= 6; } return [hh, ss, l]; };
const hsl2 = (h, s, l) => { const f = (p, q, t) => { if (t < 0) t += 1; if (t > 1) t -= 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; }; const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q; return ((Math.round(f(p, q, h + 1 / 3) * 255) << 16) | (Math.round(f(p, q, h) * 255) << 8) | Math.round(f(p, q, h - 1 / 3) * 255)); };
const recolor = (hex, target) => { const [, s, l] = toHsl(hex), [th, ts, tl] = toHsl(target); return hsl2(th, Math.min(1, s * 0.35 + ts * 0.65), l * 0.65 + tl * 0.35); };
const css = (n) => '#' + n.toString(16).padStart(6, '0');
export function resolveSkin(skinId = 'default', colorId = 'orig') {
  const base = SKIN_BY_ID[skinId] || SKINS[0], col = COLOR_BY_ID[colorId];
  if (!col || !col.hex) return base;
  return { ...base, id: base.id + '_' + col.id, color: recolor(base.color, col.hex), accent: recolor(base.accent, col.hex), emissive: base.emissive ? recolor(base.emissive, col.hex) : 0, camo: base.camo ? base.camo.map((c) => css(recolor(parseInt(c.slice(1), 16), col.hex))) : undefined };
}

// ---------- Steuerung ----------
export const DEFAULT_KEYS = { forward: 'KeyW', back: 'KeyS', left: 'KeyA', right: 'KeyD', jump: 'Space', sprint: 'ShiftLeft', crouch: 'KeyC', reload: 'KeyR', interact: 'KeyF', vehicle: 'KeyE', medkit: 'KeyH', map: 'KeyM', nextWeapon: 'KeyQ', slot1: 'Digit1', slot2: 'Digit2', slot3: 'Digit3', slot4: 'Digit4' };
export const KEY_LABELS = { forward: 'Vorwärts', back: 'Rückwärts', left: 'Links', right: 'Rechts', jump: 'Springen / Fallschirm / Handbremse', sprint: 'Sprinten', crouch: 'Ducken', reload: 'Nachladen', interact: 'Interagieren (Kisten, Bombe, Flagge)', vehicle: 'Fahrzeug ein-/aussteigen', medkit: 'Medkit benutzen', map: 'Karte', nextWeapon: 'Nächste Waffe', slot1: 'Waffe 1 / Loadout 1', slot2: 'Waffe 2 / Loadout 2', slot3: 'Waffe 3 / Loadout 3', slot4: 'Loadout 4' };
export const keyName = (code) => (code || '—').replace(/^Key/, '').replace(/^Digit/, '').replace('Left', ' L').replace('Right', ' R').replace('Arrow', 'Pfeil ').replace('Space', 'Leertaste').replace('Control', 'Strg').replace('Shift', 'Shift').replace('Backquote', '^');

export const SKIN_BY_ID = Object.fromEntries(SKINS.map((s) => [s.id, s]));
export const hex = (n) => '#' + n.toString(16).padStart(6, '0');

// ---------- Battle Pass ----------
export const BP_TIERS = 30;
export const BP_XP = 800;
export const BP_PREMIUM_PRICE = 1500;
export function bpReward(t) {
  const freeItems = { 5: ['color', 'ocean'], 10: ['char', 'desert'], 15: ['skin', 'digital'], 20: ['color', 'toxic'], 25: ['char', 'forest'], 30: ['skin', 'tiger'] };
  const premItems = { 1: ['color', 'crimson'], 3: ['skin', 'carbon'], 5: ['char', 'arctic'], 7: ['color', 'sun'], 10: ['skin', 'hex'], 12: ['color', 'violet'], 14: ['char', 'night'], 16: ['skin', 'marble'], 18: ['color', 'pink'], 20: ['char', 'blood'], 22: ['color', 'cyan'], 24: ['skin', 'flame'], 26: ['char', 'royal'], 28: ['color', 'snow'], 30: ['char', 'gold'] };
  const f = freeItems[t], p = premItems[t];
  return { free: f ? { type: f[0], id: f[1] } : { type: 'coins', amount: 50 + t * 10 }, prem: p ? { type: p[0], id: p[1] } : { type: 'coins', amount: 120 + t * 20 } };
}

// ---------- Namen ----------
export const NAME_A = ['Shadow', 'Ghost', 'Viper', 'Falke', 'Blitz', 'Nova', 'Rogue', 'Wolf', 'Storm', 'Raven', 'Cobra', 'Frost', 'Dark', 'Iron', 'Toxic', 'Neo', 'Zero', 'Alpha', 'Omega', 'Crimson', 'Phantom', 'Hunter', 'Turbo', 'Nitro', 'Sniper', 'Killer', 'Pixel', 'Cyber', 'Lucky', 'Mad'];
export const NAME_B = ['X', 'Pro', 'Max', 'Boss', 'King', '99', '777', 'YT', 'HD', 'Jäger', 'Bär', 'Gamer', 'Master', 'Queen', 'One', 'Z', 'TV', 'DE', 'Elite', 'Prime'];
export function randomName(rnd = Math.random) {
  const a = NAME_A[(rnd() * NAME_A.length) | 0], b = NAME_B[(rnd() * NAME_B.length) | 0];
  const sep = rnd() < 0.3 ? '_' : rnd() < 0.5 ? '' : '.';
  return a + sep + b + (rnd() < 0.4 ? ((rnd() * 99) | 0) : '');
}
export const PLAYER_NAMES_LOBBY = ['Du'];
