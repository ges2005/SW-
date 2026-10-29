// Dosyasız, WebAudio ile üretilen kısa sesler. Mobilde ilk dokunuşta açılır.
let ac = null, muted = false;
export function unlockAudio() {
  try { ac = ac || new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === 'suspended') ac.resume(); } catch { /* ses yoksa sessiz devam */ }
}
export const setMuted = m => { muted = m; };
export const isMuted = () => muted;

function tone(freq, dur, type = 'square', vol = 0.05, slide = 0) {
  if (!ac || muted || ac.state !== 'running') return;
  const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime;
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(ac.destination); o.start(t); o.stop(t + dur);
}

let lastHit = 0;
export function playEvent(e, myTeam) {
  const now = performance.now();
  if (e.type === 'hit') { if (now - lastHit < 60) return; lastHit = now; tone(180, 0.08, 'square', 0.035, -80); }
  else if (e.type === 'death') tone(220, 0.25, 'sawtooth', 0.04, -170);
  else if (e.type === 'capture') { const mine = e.team === myTeam; tone(mine ? 520 : 260, 0.18, 'triangle', 0.06); setTimeout(() => tone(mine ? 780 : 200, 0.25, 'triangle', 0.06), 120); }
  else if (e.type === 'skill') {
    if (e.skill === 'sifa') [523, 659, 784].forEach((f, i) => setTimeout(() => tone(f, 0.18, 'sine', 0.05), i * 90));
    else if (e.skill === 'yagmur') { tone(120, 0.35, 'sawtooth', 0.05, -60); setTimeout(() => tone(90, 0.3, 'sawtooth', 0.05, -40), 140); }
    else tone(300, 0.3, 'triangle', 0.05, 500);
  }
  else if (e.type === 'spawn' && e.team === myTeam) tone(400, 0.06, 'sine', 0.025);
}
export const clickSound = () => tone(600, 0.05, 'sine', 0.04);
