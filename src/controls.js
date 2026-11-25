import { DEFAULT_KEYS, KEY_LABELS, keyName } from './data.js';

// Steuerungs-Editor: Taste anklicken, dann neue Taste drücken. Wird in den Lobby-Einstellungen und im Pause-Menü benutzt.
export function controlsUI(root, profile, onChange) {
  const s = profile.data.settings; let listening = null;
  const render = () => {
    const keys = profile.keys;
    root.innerHTML = `<div class="ctl">${Object.keys(DEFAULT_KEYS).map((a) => `<div class="ctl-row"><span>${KEY_LABELS[a]}</span><button class="keybtn ${listening === a ? 'on' : ''}" data-a="${a}">${listening === a ? 'Taste drücken…' : keyName(keys[a])}</button></div>`).join('')}</div>
      <label class="chk"><input type="checkbox" id="c-aim" ${s.aimToggle ? 'checked' : ''}> Zielen umschalten statt halten</label>
      <label class="chk"><input type="checkbox" id="c-swap" ${s.swapMouse ? 'checked' : ''}> Maustasten tauschen (links zielen, rechts schießen)</label>
      <button class="btn sm" id="c-reset">Standard wiederherstellen</button>`;
    root.querySelectorAll('.keybtn').forEach((b) => (b.onclick = () => { listening = b.dataset.a; render(); }));
    root.querySelector('#c-aim').onchange = (e) => { s.aimToggle = e.target.checked; profile.save(); onChange && onChange(); };
    root.querySelector('#c-swap').onchange = (e) => { s.swapMouse = e.target.checked; profile.save(); onChange && onChange(); };
    root.querySelector('#c-reset').onclick = () => { s.keys = {}; s.aimToggle = false; s.swapMouse = false; profile.save(); listening = null; render(); onChange && onChange(); };
  };
  const onKey = (e) => {
    if (!listening) return;
    e.preventDefault(); e.stopImmediatePropagation();
    if (e.code === 'Escape') { listening = null; render(); return; }
    const keys = { ...profile.keys }, other = Object.keys(keys).find((a) => keys[a] === e.code && a !== listening);
    if (other) keys[other] = keys[listening]; // Tasten tauschen, wenn schon belegt
    keys[listening] = e.code; s.keys = keys; profile.save(); listening = null; render(); onChange && onChange();
  };
  addEventListener('keydown', onKey, true); render();
  return { destroy() { removeEventListener('keydown', onKey, true); } };
}
