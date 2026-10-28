// Saf oyun mantığı: çizim ve girdiden bağımsız. Tarayıcıda da Node'da da çalışır.
import { CFG } from './config.js';

const N = CFG.mapSize;
const C = N / 2;
const KINDS = ['eko', 'eko', 'demirci', 'kule']; // yerel noktaların türleri (layout sırasıyla)
const rot = ([x, y]) => [-y, x]; // merkez etrafında 90 derece

function layout() {
  // Takım 0 sektörü (merkezden sapma); diğer takımlar döndürülerek simetrik kurulur.
  const base = [9, -9];
  const local = [[6, -9], [9, -6], [5, -5], [0, -7]];
  const points = [];
  let b = base, l = local;
  for (let t = 0; t < 4; t++) {
    points.push({ x: C + b[0], y: C + b[1], owner: t, base: true, team: t, kind: 'ana' });
    l.forEach((p, k) => points.push({ x: C + p[0], y: C + p[1], owner: -1, kind: KINDS[k] }));
    b = rot(b); l = l.map(rot);
  }
  points.push({ x: C, y: C, owner: -1, kind: 'kule' });
  return points.map((p, i) => ({ id: i, prog: 0, capTeam: -1, cd: 0, suit: i % 2 ? 'S' : 'H', ...p }));
}

export function createGame() {
  const g = {
    t: 0, nextId: 1, units: [], points: layout(),
    teams: CFG.teams.map((_, i) => ({ id: i, alive: true, spawnT: 0, prod: 'piyon' })),
    winner: -1, events: [], // çizim/ses katmanının tükettiği olaylar
  };
  for (let t = 0; t < 4; t++) for (let k = 0; k < 3; k++) spawn(g, t, k, 'piyon');
  return g;
}

export const ownedCount = (g, t) => g.points.filter(p => p.owner === t).length;
export const unitCount = (g, t) => g.units.filter(u => u.team === t).length;
export const spawnInterval = (g, t) => {
  const e = CFG.economy;
  return Math.max(e.spawnMin, e.spawnBase - e.spawnPerPoint * (ownedCount(g, t) - 1));
};
export const capacity = (g, t) => CFG.economy.capBase + CFG.economy.capPerPoint * (ownedCount(g, t) - 1);
export const buff = (g, t) => {
  const forges = g.points.filter(p => p.owner === t && p.kind === 'demirci').length;
  return 1 + CFG.economy.buffPerPoint * (ownedCount(g, t) - 1 + forges);
};
const mult = (a, d) => (a === d ? 1 : CFG.types[a].beats === d ? CFG.counter.advantage : CFG.types[d].beats === a ? CFG.counter.disadvantage : 1);

function basePoint(g, t) { return g.points.find(p => p.base && p.team === t); }

export function spawnUnit(g, t, type, x, y) {
  const hp = CFG.types[type].hp * buff(g, t);
  const u = { id: g.nextId++, team: t, type, x, y, hp, maxHp: hp, tx: null, ty: null, cd: 0, atk: 0, moving: false, fx: 0, fy: 0 };
  g.units.push(u);
  return u;
}

function spawn(g, t, k = 0, type = g.teams[t].prod) {
  const b = basePoint(g, t);
  const a = k * 2.1;
  spawnUnit(g, t, type, b.x + Math.cos(a) * 1.2, b.y + Math.sin(a) * 1.2);
  g.events.push({ type: 'spawn', x: b.x, y: b.y, team: t });
}

export function commandMove(g, ids, x, y) {
  const set = new Set(ids);
  const us = g.units.filter(u => set.has(u.id));
  us.forEach((u, i) => { // hedef çevresinde dağıt
    const a = i * 2.4, r = Math.sqrt(i) * 0.45;
    u.tx = Math.min(N - .5, Math.max(.5, x + Math.cos(a) * r));
    u.ty = Math.min(N - .5, Math.max(.5, y + Math.sin(a) * r));
  });
}

export function step(g, dt) {
  if (g.winner !== -1) return;
  g.t += dt;

  // üretim
  for (const tm of g.teams) {
    if (!tm.alive) continue;
    tm.spawnT += dt;
    if (tm.spawnT >= spawnInterval(g, tm.id) * CFG.types[tm.prod].cost) {
      tm.spawnT = 0;
      if (unitCount(g, tm.id) < capacity(g, tm.id)) spawn(g, tm.id, g.nextId);
    }
  }

  // savaş ve hareket
  for (const u of g.units) {
    u.cd = Math.max(0, u.cd - dt);
    u.atk = Math.max(0, u.atk - dt);
    u.moving = false;
    let foe = null, fd = Infinity;
    for (const v of g.units) {
      if (v.team === u.team) continue;
      const d = Math.hypot(v.x - u.x, v.y - u.y);
      if (d < fd) { fd = d; foe = v; }
    }
    const U = CFG.types[u.type];
    if (foe && fd <= U.range) {
      u.fx = (foe.x - u.x) / (fd || 1); u.fy = (foe.y - u.y) / (fd || 1);
      if (u.cd === 0) {
        foe.hp -= U.dmg * buff(g, u.team) * mult(u.type, foe.type); u.cd = U.cooldown; u.atk = 0.25;
        g.events.push({ type: 'hit', x: foe.x, y: foe.y, team: u.team, from: U.range > 2 ? { x: u.x, y: u.y } : null });
      }
      continue; // dövüşürken yerinde durur
    }
    let gx = u.tx, gy = u.ty;
    if (gx === null && foe && fd <= CFG.sight) { gx = foe.x; gy = foe.y; } // boştaki birim yakındakine saldırır
    if (gx !== null) {
      const dx = gx - u.x, dy = gy - u.y, d = Math.hypot(dx, dy);
      if (d < 0.1) { if (u.tx !== null && gx === u.tx) { u.tx = u.ty = null; } }
      else { const s = Math.min(d, U.speed * dt); u.x += dx / d * s; u.y += dy / d * s; u.moving = true; u.fx = dx / d; u.fy = dy / d; }
    }
  }
  // ayrışma (üst üste binmesinler)
  for (let i = 0; i < g.units.length; i++) for (let j = i + 1; j < g.units.length; j++) {
    const a = g.units[i], b = g.units[j];
    const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
    if (d > 0 && d < 0.5) { const p = (0.5 - d) / 2 / d; a.x -= dx * p; a.y -= dy * p; b.x += dx * p; b.y += dy * p; }
  }
  // kuleler: sahibi olan takımın birimi dışındaki en yakın düşmana ateş eder
  for (const p of g.points) {
    if (p.kind !== 'kule' || p.owner < 0) continue;
    p.cd = Math.max(0, p.cd - dt);
    if (p.cd > 0) continue;
    let foe = null, fd = CFG.tower.range;
    for (const v of g.units) { if (v.team === p.owner) continue; const d = Math.hypot(v.x - p.x, v.y - p.y); if (d < fd) { fd = d; foe = v; } }
    if (foe) { foe.hp -= CFG.tower.dmg * buff(g, p.owner); p.cd = CFG.tower.cooldown; g.events.push({ type: 'hit', x: foe.x, y: foe.y, team: p.owner, from: { x: p.x, y: p.y } }); }
  }
  for (const u of g.units) if (u.hp <= 0) g.events.push({ type: 'death', x: u.x, y: u.y, team: u.team });
  g.units = g.units.filter(u => u.hp > 0);

  // nokta ele geçirme: tek takım bekliyorsa ilerler, çekişme varsa durur
  for (const p of g.points) {
    const present = new Set();
    for (const u of g.units) if (Math.hypot(u.x - p.x, u.y - p.y) <= CFG.capture.radius) present.add(u.team);
    if (present.size !== 1) continue;
    const t = [...present][0];
    if (t === p.owner) { p.prog = 0; p.capTeam = -1; continue; }
    if (p.capTeam !== t) { p.capTeam = t; p.prog = 0; }
    p.prog += dt / CFG.capture.seconds;
    if (p.prog >= 1) {
      const prev = p.owner;
      p.owner = t; p.prog = 0; p.capTeam = -1;
      g.events.push({ type: 'capture', x: p.x, y: p.y, team: t });
      if (p.base && prev >= 0) eliminate(g, prev);
    }
  }
}

// Geçici kural: ana noktası düşen takım elenir. Kalan tek takım kazanır.
function eliminate(g, t) {
  g.teams[t].alive = false;
  g.units = g.units.filter(u => u.team !== t);
  for (const p of g.points) if (p.owner === t) p.owner = -1;
  const alive = g.teams.filter(x => x.alive);
  if (alive.length === 1) g.winner = alive[0].id;
  if (t === 0) g.winner = -2; // oyuncu elendi (kayıp)
}
