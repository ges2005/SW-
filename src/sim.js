// Saf oyun mantığı: çizim ve girdiden bağımsız. Tarayıcıda da Node'da da çalışır.
import { CFG } from './config.js';
import { buildPoints } from './mapgen.js';

const N = CFG.mapSize;
// opts: { seed: 0 = klasik harita, seats: oyundaki takımlar, startUnits: başlangıç birimi }
export function createGame(opts = {}) {
  const { seed = 0, seats = [0, 1, 2, 3], startUnits = 3 } = opts;
  const g = {
    t: 0, nextId: 1, units: [], points: buildPoints(seed, seats), seed, seats,
    teams: CFG.teams.map((_, i) => ({ id: i, alive: seats.includes(i), spawnT: 0, prod: 'piyon' })),
    winner: -1, events: [], // çizim/ses katmanının tükettiği olaylar
  };
  for (const t of seats) for (let k = 0; k < startUnits; k++) spawn(g, t, k, 'piyon');
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
  const u = { id: g.nextId++, team: t, type, x, y, hp, maxHp: hp, tx: null, ty: null, mode: 'attack', hold: false, cd: 0, atk: 0, moving: false, fx: 0, fy: 0 };
  g.units.push(u);
  return u;
}

function spawn(g, t, k = 0, type = g.teams[t].prod) {
  const b = basePoint(g, t);
  const a = k * 2.1;
  spawnUnit(g, t, type, b.x + Math.cos(a) * 1.2, b.y + Math.sin(a) * 1.2);
  g.events.push({ type: 'spawn', x: b.x, y: b.y, team: t });
}

// Komut kipleri:
//   'attack' (varsayılan): yolda gördüğü düşmana saldırır, bitince yoluna devam eder
//   'move': düşmanı yok sayıp koşar (geri çekilme); varınca normale döner
export function commandMove(g, ids, x, y, mode = 'attack') {
  const set = new Set(ids);
  const us = g.units.filter(u => set.has(u.id));
  us.forEach((u, i) => { // hedef çevresinde dağıt
    u.mode = mode; u.hold = false;
    const a = i * 2.4, r = Math.sqrt(i) * 0.45;
    u.tx = Math.min(N - .5, Math.max(.5, x + Math.cos(a) * r));
    u.ty = Math.min(N - .5, Math.max(.5, y + Math.sin(a) * r));
  });
}

// Dur: hedefi iptal eder ve mevzi tutar (yalnızca menzildeki düşmana vurur, kovalamaz)
export function commandStop(g, ids) {
  const set = new Set(ids);
  for (const u of g.units) if (set.has(u.id)) { u.tx = u.ty = null; u.hold = true; }
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
    const marching = u.tx !== null && u.mode === 'move'; // koşarken savaşmaz
    if (!marching && foe && fd <= U.range) {
      u.fx = (foe.x - u.x) / (fd || 1); u.fy = (foe.y - u.y) / (fd || 1);
      if (u.cd === 0) {
        foe.hp -= U.dmg * buff(g, u.team) * mult(u.type, foe.type); u.cd = U.cooldown; u.atk = 0.25;
        g.events.push({ type: 'hit', x: foe.x, y: foe.y, team: u.team, from: U.range > 2 ? { x: u.x, y: u.y } : null });
      }
      continue; // dövüşürken yerinde durur
    }
    let gx = null, gy = null, chase = false;
    if (!marching && foe && fd <= CFG.sight && !(u.hold && u.tx === null)) { gx = foe.x; gy = foe.y; chase = true; } // yakındaki düşmanı kovala
    else if (u.tx !== null) { gx = u.tx; gy = u.ty; }
    if (gx !== null) {
      const dx = gx - u.x, dy = gy - u.y, d = Math.hypot(dx, dy);
      if (d < 0.1) { if (!chase) { u.tx = u.ty = null; u.mode = 'attack'; } }
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
