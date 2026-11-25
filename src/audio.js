// Kleiner Synth: alle Sounds werden zur Laufzeit erzeugt (keine Dateien nötig)
export class AudioFX {
  constructor() { this.ctx = null; this.master = null; this.vol = 0.7; this.noiseBuf = null; this.budget = 0; }
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.vol;
    const comp = this.ctx.createDynamicsCompressor();
    this.master.connect(comp); comp.connect(this.ctx.destination);
    const len = this.ctx.sampleRate * 1.5;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    // Hall (Impulsantwort aus abklingendem, zunehmend dumpferem Rauschen)
    const rl = Math.floor(this.ctx.sampleRate * 2.2), ir = this.ctx.createBuffer(2, rl, this.ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const dd = ir.getChannelData(ch); let lp = 0; for (let i = 0; i < rl; i++) { const t = i / rl, a = 0.35 + 0.6 * t; lp += ((Math.random() * 2 - 1) - lp) * a; dd[i] = lp * Math.pow(1 - t, 3.2); } }
    this.rev = this.ctx.createConvolver(); this.rev.buffer = ir; const rg = this.ctx.createGain(); rg.gain.value = 0.9; this.rev.connect(rg); rg.connect(this.master);
  }
  setVolume(v) { this.vol = v; if (this.master) this.master.gain.value = v; }
  frame() { this.budget = 10; }
  _out(pan, wet = 0) {
    const c = this.ctx;
    if (!c.createStereoPanner) return this.master;
    const p = c.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan));
    p.connect(this.master);
    if (wet > 0 && this.rev) { const w = c.createGain(); w.gain.value = wet; p.connect(w); w.connect(this.rev); }
    return p;
  }
  // Bus pro Schuss: Entfernungs-Tiefpass + Pan + Hallsend
  _bus(pan, wet, dist) {
    const c = this.ctx, out = this._out(pan, wet);
    if (dist < 25) return out;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = Math.max(700, 9000 / (1 + dist / 45)); lp.connect(out); return lp;
  }
  _noise(dur, freq, q, gain, pan = 0, type = 'lowpass', t0 = 0, bus = null) {
    const c = this.ctx, t = c.currentTime + t0;
    const s = c.createBufferSource(); s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.frequency.exponentialRampToValueAtTime(Math.max(60, freq * 0.25), t + dur); f.Q.value = q;
    const g = c.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(bus || this._out(pan));
    s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }
  _tone(freq, dur, gain, type = 'sine', pan = 0, t0 = 0, slide = 0, bus = null) {
    const c = this.ctx, t = c.currentTime + t0;
    const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(bus || this._out(pan)); o.start(t); o.stop(t + dur + 0.05);
  }
  // Realistischer Schuss: scharfer Knall + Körper + Wumms + Hall; Entfernung dämpft und verzögert (Schallgeschwindigkeit)
  shot(cls, vol = 1, pan = 0, dist = 0) {
    if (!this.ctx || vol < 0.02 || this.budget-- <= 0) return;
    const d = dist / 343, v = vol, big = { Pistole: 0.7, Revolver: 1.0, MP: 0.6, Sturmgewehr: 0.9, DMR: 1.0, LMG: 1.0, Schrotflinte: 1.2, 'Scharfschütze': 1.4, Raketenwerfer: 1.2 }[cls] ?? 0.9;
    const bus = this._bus(pan, Math.min(0.9, 0.22 + big * 0.2 + dist / 400), dist);
    const crackF = cls === 'Pistole' || cls === 'MP' ? 5200 : cls === 'Scharfschütze' ? 3000 : 4000;
    this._noise(0.035, crackF * 1.6, 0.8, 1.0 * v, pan, 'highpass', d, bus);
    this._noise(0.08 + big * 0.06, crackF, 0.7, 0.75 * v, pan, 'bandpass', d, bus);
    this._noise(0.16 + big * 0.2, 750 * big + 300, 0.6, 0.9 * v * big, pan, 'lowpass', d + 0.004, bus);
    this._tone(110 + (1.4 - big) * 60, 0.12 + big * 0.14, 0.7 * v * big, 'sine', pan, d, -70, bus);
    if (cls === 'Schrotflinte' || cls === 'Scharfschütze' || cls === 'LMG') this._tone(55, 0.3, 0.5 * v, 'sine', pan, d + 0.01, -25, bus);
    if (cls === 'Raketenwerfer') this._noise(0.7, 1400, 0.4, 0.8 * v, pan, 'lowpass', d, bus);
    if (dist > 120 && cls !== 'Raketenwerfer') this._noise(0.4, 600, 0.5, 0.35 * v, pan, 'lowpass', d + 0.15, bus); // dumpfes Echo in der Ferne
  }
  beep(v = 1) { if (!this.ctx) return; this._tone(1900, 0.09, 0.28 * v, 'square'); }
  casing() { if (!this.ctx || this.budget-- <= 0) return; this._tone(3600 + Math.random() * 1500, 0.07, 0.07, 'triangle'); this._tone(5200, 0.04, 0.04, 'sine', 0, 0.02); }
  flesh() { if (!this.ctx) return; this._noise(0.12, 500, 0.8, 0.5, 0, 'lowpass'); this._tone(95, 0.12, 0.45, 'sine', 0, 0, -40); }
  ping() { if (!this.ctx) return; this._tone(2400 + Math.random() * 900, 0.18, 0.1, 'sine', (Math.random() - 0.5) * 0.6, 0, -900); }
  explosion(vol = 1, pan = 0) { if (!this.ctx) return; this._noise(1.2, 900, 0.3, 1.2 * vol, pan); this._tone(55, 0.9, 0.9 * vol, 'sine', pan, 0, -30); }
  hit(head) { if (!this.ctx) return; this._tone(head ? 1900 : 1200, 0.07, 0.35, 'square'); if (head) this._tone(2600, 0.1, 0.25, 'square', 0, 0.04); }
  kill() { if (!this.ctx) return; this._tone(700, 0.12, 0.35, 'triangle'); this._tone(1050, 0.18, 0.35, 'triangle', 0, 0.09); }
  hurt() { if (!this.ctx) return; this._noise(0.12, 600, 0.5, 0.6, 0); this._tone(120, 0.15, 0.4, 'sine', 0, 0, -50); }
  reload() { if (!this.ctx) return; this._noise(0.05, 4000, 1, 0.3, 0, 'highpass'); this._noise(0.05, 3000, 1, 0.35, 0, 'highpass', 0.7); }
  click() { if (!this.ctx) return; this._tone(900, 0.04, 0.12, 'square'); }
  empty() { if (!this.ctx) return; this._tone(500, 0.05, 0.18, 'square'); }
  pickup() { if (!this.ctx) return; this._tone(600, 0.08, 0.25, 'sine'); this._tone(900, 0.12, 0.25, 'sine', 0, 0.07); }
  cash() { if (!this.ctx) return; this._tone(1400, 0.06, 0.2, 'triangle'); this._tone(1900, 0.1, 0.2, 'triangle', 0, 0.06); }
  crate() { if (!this.ctx) return; this._noise(0.25, 1500, 0.8, 0.5, 0); this._tone(300, 0.2, 0.25, 'sawtooth', 0, 0.05, 200); }
  warn() { if (!this.ctx) return; this._tone(440, 0.25, 0.3, 'square'); this._tone(440, 0.25, 0.3, 'square', 0, 0.35); }
  step(vol = 0.15) { if (!this.ctx) return; this._noise(0.07, 700, 0.7, vol, 0); }
  match() { if (!this.ctx) return; this._tone(520, 0.15, 0.3, 'triangle'); this._tone(780, 0.15, 0.3, 'triangle', 0, 0.14); this._tone(1040, 0.3, 0.3, 'triangle', 0, 0.28); }
  heal() { if (!this.ctx) return; this._tone(500, 0.3, 0.25, 'sine', 0, 0, 300); }
  engine(frac, thr) {
    if (!this.ctx) return;
    if (!this._eng) {
      const c = this.ctx, o = c.createOscillator(), o2 = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain();
      o.type = 'sawtooth'; o2.type = 'square'; f.type = 'lowpass'; f.frequency.value = 500; g.gain.value = 0; o.connect(f); o2.connect(f); f.connect(g); g.connect(this.master); o.start(); o2.start(); this._eng = { o, o2, f, g };
    }
    const e = this._eng, t = this.ctx.currentTime, hz = 38 + frac * 110 + Math.abs(thr) * 8;
    e.o.frequency.setTargetAtTime(hz, t, 0.08); e.o2.frequency.setTargetAtTime(hz * 0.5, t, 0.08); e.f.frequency.setTargetAtTime(300 + frac * 700 + Math.abs(thr) * 300, t, 0.1); e.g.gain.setTargetAtTime(0.07 + frac * 0.06 + Math.abs(thr) * 0.03, t, 0.1);
  }
  engineStop() { if (this._eng) this._eng.g.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1); }
}
