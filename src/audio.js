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
  }
  setVolume(v) { this.vol = v; if (this.master) this.master.gain.value = v; }
  frame() { this.budget = 10; }
  _out(pan) {
    const c = this.ctx;
    if (!c.createStereoPanner) return this.master;
    const p = c.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan));
    p.connect(this.master); return p;
  }
  _noise(dur, freq, q, gain, pan = 0, type = 'lowpass', t0 = 0) {
    const c = this.ctx, t = c.currentTime + t0;
    const s = c.createBufferSource(); s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.frequency.exponentialRampToValueAtTime(Math.max(60, freq * 0.25), t + dur); f.Q.value = q;
    const g = c.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(this._out(pan));
    s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }
  _tone(freq, dur, gain, type = 'sine', pan = 0, t0 = 0, slide = 0) {
    const c = this.ctx, t = c.currentTime + t0;
    const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this._out(pan)); o.start(t); o.stop(t + dur + 0.05);
  }
  shot(cls, vol = 1, pan = 0) {
    if (!this.ctx || vol < 0.02 || this.budget-- <= 0) return;
    const v = vol;
    switch (cls) {
      case 'Pistole': case 'Revolver': this._noise(0.18, 3500, 0.7, 0.8 * v, pan); this._tone(180, 0.1, 0.5 * v, 'triangle', pan, 0, -100); break;
      case 'MP': this._noise(0.1, 5000, 0.6, 0.6 * v, pan); this._tone(220, 0.06, 0.3 * v, 'square', pan, 0, -120); break;
      case 'Schrotflinte': this._noise(0.35, 2200, 0.5, 1.0 * v, pan); this._tone(90, 0.25, 0.7 * v, 'sawtooth', pan, 0, -50); break;
      case 'Scharfschütze': this._noise(0.7, 2600, 0.4, 1.0 * v, pan); this._tone(70, 0.5, 0.8 * v, 'sine', pan, 0, -40); break;
      case 'Raketenwerfer': this._noise(0.6, 1500, 0.4, 0.9 * v, pan); this._tone(110, 0.4, 0.5 * v, 'sawtooth', pan, 0, -70); break;
      default: this._noise(0.16, 3000, 0.6, 0.8 * v, pan); this._tone(140, 0.12, 0.45 * v, 'triangle', pan, 0, -80);
    }
  }
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
}
