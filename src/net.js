// Dünner WebSocket-Client mit Event-Handlern
export class Net {
  constructor(url) {
    this.url = url; this.h = {}; this.open = false; this.closed = false;
    this.ws = new WebSocket(url);
    this.ws.onopen = () => { this.open = true; this.h.open && this.h.open(); };
    this.ws.onmessage = (e) => { let m; try { m = JSON.parse(e.data); } catch { return; } const f = this.h[m.t]; if (f) f(m); };
    this.ws.onclose = () => { this.closed = true; this.h.close && this.h.close(); };
    this.ws.onerror = () => { this.h.error && this.h.error(); };
  }
  on(t, f) { this.h[t] = f; return this; }
  send(o) { if (this.ws.readyState === 1) this.ws.send(JSON.stringify(o)); }
  close() { this.h = {}; try { this.ws.close(); } catch (e) { /* ignore */ } }
}
