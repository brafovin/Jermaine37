import { SKIN_BY_ID, ITEM_BY, DEFAULT_KEYS, BP_TIERS, BP_XP, BP_PREMIUM_PRICE, bpReward, getRank, rpForMatch } from './data.js';

const KEY = 'jermaine37_br_profile_v1';

function fresh() {
  return {
    playerId: (globalThis.crypto && crypto.randomUUID) ? crypto.randomUUID() : 'p' + Math.random().toString(36).slice(2) + Date.now().toString(36),
    name: 'Spieler' + ((Math.random() * 9000 + 1000) | 0),
    xp: 0,
    coins: 2500,
    rp: 0,
    rankedPlayed: 0,
    owned: ['default'],
    skin: 'default',
    ownedColors: ['orig'],
    skinColor: 'orig',
    ownedChars: ['standard'],
    charSkin: 'standard',
    bpXp: 0,
    bpPremium: false,
    bpClaimed: { free: [], prem: [] },
    seasonEnd: Date.now() + 41 * 86400000,
    stats: { matches: 0, wins: 0, kills: 0, top10: 0, best: 100 },
    settings: { quality: 'high', sens: 1.0, volume: 0.7, fov: 80, server: '', keys: {}, aimToggle: false, swapMouse: false },
  };
}

export const xpForLevel = (lvl) => 300 + lvl * 60;

export class Profile {
  constructor() {
    this.data = fresh();
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) this.data = { ...this.data, ...JSON.parse(raw) };
      this.data.settings = { ...fresh().settings, ...this.data.settings };
      const f = fresh(); for (const k of ['ownedColors', 'ownedChars', 'skinColor', 'charSkin', 'playerId']) if (this.data[k] === undefined) this.data[k] = f[k];
    } catch (e) { /* ignore */ }
    this.listeners = new Set();
  }
  save() {
    try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch (e) { /* ignore */ }
    this.listeners.forEach((f) => f());
  }
  onChange(f) { this.listeners.add(f); }
  get level() {
    let xp = this.data.xp, lvl = 1;
    while (xp >= xpForLevel(lvl)) { xp -= xpForLevel(lvl); lvl++; }
    return { level: lvl, cur: xp, need: xpForLevel(lvl) };
  }
  get rank() { return getRank(this.data.rp, this.data.rankedPlayed); }
  get bpTier() { return Math.min(BP_TIERS, Math.floor(this.data.bpXp / BP_XP)); }
  get daysLeft() { return Math.max(0, Math.ceil((this.data.seasonEnd - Date.now()) / 86400000)); }

  get keys() { return { ...DEFAULT_KEYS, ...(this.data.settings.keys || {}) }; }
  _list(type) { return type === 'skin' ? this.data.owned : type === 'color' ? this.data.ownedColors : this.data.ownedChars; }
  _slot(type) { return type === 'skin' ? 'skin' : type === 'color' ? 'skinColor' : 'charSkin'; }
  owns(type, id) { return this._list(type).includes(id); }
  equipped(type) { return this.data[this._slot(type)]; }
  buy(type, id) {
    const it = ITEM_BY(type, id); if (!it || this.owns(type, id) || this.data.coins < it.price) return false;
    this.data.coins -= it.price; this._list(type).push(id); this.save(); return true;
  }
  equip(type, id) { if (this.owns(type, id)) { this.data[this._slot(type)] = id; this.save(); } }
  unlock(type, id) { if (!this.owns(type, id)) this._list(type).push(id); }
  buySkin(id) { return this.buy('skin', id); }
  equipSkin(id) { this.equip('skin', id); }
  get tokenRound() { return (this.data.stats.matches + 1) % 100 === 0; }
  claimToken() { // Token-Truhe: Battle Pass gratis, sonst Münzen
    if (!this.data.bpPremium) { this.data.bpPremium = true; this.save(); return 'premium'; }
    this.data.coins += BP_PREMIUM_PRICE; this.save(); return 'coins';
  }
  buyPremium() {
    if (this.data.bpPremium || this.data.coins < BP_PREMIUM_PRICE) return false;
    this.data.coins -= BP_PREMIUM_PRICE; this.data.bpPremium = true; this.save(); return true;
  }
  canClaim(track, t) {
    if (t > this.bpTier) return false;
    if (track === 'prem' && !this.data.bpPremium) return false;
    return !this.data.bpClaimed[track].includes(t);
  }
  claim(track, t) {
    if (!this.canClaim(track, t)) return null;
    const r = bpReward(t)[track];
    if (r.type === 'coins') this.data.coins += r.amount;
    else this.unlock(r.type, r.id);
    this.data.bpClaimed[track].push(t);
    this.save();
    return r;
  }
  claimAll() { for (let t = 1; t <= this.bpTier; t++) { this.claim('free', t); this.claim('prem', t); } }

  // Matchende verbuchen. Gibt Zusammenfassung zurück.
  applyMatch({ placement, kills, surviveSec, cash, ranked }) {
    const d = this.data;
    const win = placement === 1;
    const xp = Math.round((win ? 400 : 0) + Math.max(0, 100 - placement) * 3 + kills * 50 + surviveSec / 60 * 30);
    const before = this.rank;
    let rpDelta = 0;
    if (ranked) {
      rpDelta = rpForMatch(placement, kills, Math.max(1, before.idx));
      d.rankedPlayed++;
      d.rp = Math.max(0, d.rp + rpDelta);
    }
    const lvBefore = this.level.level;
    d.xp += xp;
    d.bpXp = Math.min(BP_TIERS * BP_XP, d.bpXp + xp);
    d.coins += cash;
    d.stats.matches++; d.stats.kills += kills;
    if (win) d.stats.wins++;
    if (placement <= 10) d.stats.top10++;
    d.stats.best = Math.min(d.stats.best, placement);
    this.save();
    return { xp, rpDelta, before, after: this.rank, levelUp: this.level.level > lvBefore, level: this.level.level, coins: cash };
  }
}
