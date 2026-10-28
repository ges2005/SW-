// Sis: görüş hesabı saf mantıktır (çizimden bağımsız, test edilebilir).
// vis = şu an görünen kareler, seen = bir zamanlar görülmüş kareler,
// known = noktaların en son görülen sahibi (sis altında eski bilgi gösterilir).
import { CFG } from './config.js';

const N = CFG.mapSize;

export function createVision() {
  return { vis: new Uint8Array(N * N), seen: new Uint8Array(N * N), known: {} };
}

function reveal(v, cx, cy, r) {
  const i0 = Math.max(0, Math.floor(cx - r)), i1 = Math.min(N - 1, Math.ceil(cx + r));
  const j0 = Math.max(0, Math.floor(cy - r)), j1 = Math.min(N - 1, Math.ceil(cy + r));
  for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
    if (Math.hypot(i + 0.5 - cx, j + 0.5 - cy) <= r) { v.vis[i * N + j] = 1; v.seen[i * N + j] = 1; }
  }
}

export function updateVision(v, g, team) {
  v.vis.fill(0);
  for (const u of g.units) if (u.team === team) reveal(v, u.x, u.y, CFG.types[u.type].vision);
  for (const p of g.points) if (p.owner === team) reveal(v, p.x, p.y, p.base ? CFG.fog.base : CFG.fog.point);
  for (const p of g.points) if (isVisible(v, p.x, p.y)) v.known[p.id] = p.owner;
}

export function isVisible(v, x, y) {
  if (!CFG.fog.enabled) return true;
  const i = Math.floor(x), j = Math.floor(y);
  return i >= 0 && j >= 0 && i < N && j < N && v.vis[i * N + j] === 1;
}
export function isSeen(v, x, y) {
  if (!CFG.fog.enabled) return true;
  const i = Math.floor(x), j = Math.floor(y);
  return i >= 0 && j >= 0 && i < N && j < N && v.seen[i * N + j] === 1;
}
