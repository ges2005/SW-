// Harita üretimi. Her harita 4 köşeye 90° döndürülerek kurulduğu için her takım için adildir.
// seed 0 = klasik (sabit) harita; diğer seed'ler tekrarlanabilir rastgele haritadır.
import { CFG } from './config.js';

const N = CFG.mapSize, C = N / 2;
const rot = ([x, y]) => [-y, x]; // merkez etrafında 90 derece

export function mulberry32(a) {
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const BASE = [9, -9];
const CLASSIC = { local: [[6, -9], [9, -6], [5, -5], [0, -7]], kinds: ['eko', 'eko', 'demirci', 'kule'], center: 'kule' };

// Rastgele sektör: ana noktaya yakın bir ekonomi noktası + diğerleri, her sektörde en az 1 demirci, 1 kule, 2 ekonomi.
function randomSector(rng) {
  for (let attempt = 0; attempt < 500; attempt++) {
    const count = 4 + (rng() < 0.5 ? 1 : 0);
    const local = [];
    const ok = (p, withRot = true) => {
      if (p[0] < 1.5 || p[0] > 10.5 || p[1] > -1.5 || p[1] < -10.5) return false;
      const all = [BASE, ...local, p];
      // dört dönüşteki tüm noktalar arasında en az 2.8 uzaklık
      const copies = []; let cur = all;
      for (let r = 0; r < 4; r++) { copies.push(...cur.map(q => [q[0], q[1], r])); cur = cur.map(rot); }
      for (let i = 0; i < copies.length; i++) for (let j = i + 1; j < copies.length; j++)
        if (Math.hypot(copies[i][0] - copies[j][0], copies[i][1] - copies[j][1]) < 2.8) return false;
      // merkezden de uzak dur
      return Math.hypot(p[0], p[1]) > 2.8 || !withRot;
    };
    // ilk nokta: ana noktaya 3-4.5 uzaklıkta
    let first = null;
    for (let k = 0; k < 80 && !first; k++) {
      const a = rng() * Math.PI * 2, d = 3 + rng() * 1.5, p = [BASE[0] + Math.cos(a) * d, BASE[1] + Math.sin(a) * d];
      if (ok(p)) first = p;
    }
    if (!first) continue;
    local.push(first);
    while (local.length < count) {
      let placed = false;
      for (let k = 0; k < 120 && !placed; k++) {
        const p = [1.5 + rng() * 9, -(1.5 + rng() * 9)];
        if (ok(p)) { local.push(p); placed = true; }
      }
      if (!placed) break;
    }
    if (local.length < count) continue;
    const kinds = ['eko', 'demirci', 'kule'];
    while (kinds.length < count) { const r = rng(); kinds.push(r < 0.5 ? 'eko' : r < 0.75 ? 'demirci' : 'kule'); }
    if (kinds.filter(k => k === 'eko').length < 2) kinds[kinds.length - 1] = 'eko';
    // ilk nokta ekonomi kalsın, kalanları karıştır
    const rest = kinds.slice(1), firstKind = kinds[0];
    for (let i = rest.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [rest[i], rest[j]] = [rest[j], rest[i]]; }
    return { local: local.map(p => [+p[0].toFixed(2), +p[1].toFixed(2)]), kinds: [firstKind, ...rest], center: rng() < 0.7 ? (rng() < 0.5 ? 'kule' : 'demirci') : null };
  }
  return CLASSIC; // üretilemezse klasik haritaya dön
}

// seats: oyunda yer alan takımlar; kullanılmayan köşeler sıradan tarafsız noktaya dönüşür.
export function buildPoints(seed = 0, seats = [0, 1, 2, 3]) {
  const sec = seed === 0 ? CLASSIC : randomSector(mulberry32(seed));
  const pts = [];
  let b = BASE, l = sec.local;
  for (let t = 0; t < 4; t++) {
    if (seats.includes(t)) pts.push({ x: C + b[0], y: C + b[1], owner: t, base: true, team: t, kind: 'ana' });
    else pts.push({ x: C + b[0], y: C + b[1], owner: -1, kind: 'eko' });
    l.forEach((p, k) => pts.push({ x: C + p[0], y: C + p[1], owner: -1, kind: sec.kinds[k] }));
    b = rot(b); l = l.map(rot);
  }
  if (sec.center) pts.push({ x: C, y: C, owner: -1, kind: sec.center });
  return pts.map((p, i) => ({ id: i, prog: 0, capTeam: -1, cd: 0, suit: i % 2 ? 'S' : 'H', ...p }));
}
