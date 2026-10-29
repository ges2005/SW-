import { CFG } from './config.js';
import { createGame, step, commandStop, ownedCount, unitCount, capacity, spawnInterval, buff } from './sim.js';
import { createAI, stepAI, DIFFICULTY } from './ai.js';
import { render, toScreen, toWorld, clampCam } from './iso.js';
import { bindInput } from './input.js';
import { createFx } from './fx.js';
import { createVision, updateVision, isVisible } from './vision.js';
import { LEVELS, ENEMY_SEATS, loadProgress, saveProgress, isUnlocked } from './levels.js';
import { createTutorial } from './tutorial.js';
import { unlockAudio, playEvent, setMuted, isMuted, clickSound } from './audio.js';

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const hud = document.getElementById('hud');
const msg = document.getElementById('msg');
let game = createGame();
let ais = [], started = false, ended = false, current = null, tut = null;
let diff = 'normal', enemyCount = 3, mapMode = 'rand', progress = loadProgress();
try { const d = localStorage.getItem('sw-diff'); if (d in DIFFICULTY) diff = d; } catch { /* kayıt yoksa varsayılan */ }
const cam = { x: 0, y: 0, zoom: 1, w: 0, h: 0 };
const fx = createFx();
const vision = createVision();
const ui = { selected: new Set(), box: null, time: 0, mode: 'attack', groups: [[], [], []], fx, vision, project: (i, j) => toScreen(cam, i, j) };

function fit() {
  const dpr = window.devicePixelRatio || 1;
  cam.w = window.innerWidth; cam.h = window.innerHeight;
  canvas.width = cam.w * dpr; canvas.height = cam.h * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const small = cam.w < 700;
  cam.zoom = small ? 0.7 : 1;
}
function focusBase() {
  const b = game.points.find(p => p.base && p.team === 0), w = toWorld(b.x, b.y);
  cam.x = w.x; cam.y = w.y; clampCam(cam);
}
fit(); focusBase();
window.addEventListener('resize', fit);
bindInput(canvas, cam, () => game, ui);
canvas.addEventListener('pointerdown', unlockAudio);
document.getElementById('mute').onclick = e => { unlockAudio(); setMuted(!isMuted()); e.target.textContent = isMuted() ? '🔇' : '🔊'; };

document.getElementById('all').onclick = () => { ui.selected.clear(); game.units.forEach(u => u.team === 0 && ui.selected.add(u.id)); };
document.getElementById('none').onclick = () => ui.selected.clear();
document.getElementById('base').onclick = focusBase;
document.getElementById('all').addEventListener('click', clickSound);

// Komutlar: kip değiştirme ve dur
const modeBtn = document.getElementById('mode');
const showMode = () => { modeBtn.textContent = ui.mode === 'attack' ? '⚔️ Saldır' : '🏃 Yürü'; };
modeBtn.onclick = () => { ui.mode = ui.mode === 'attack' ? 'move' : 'attack'; showMode(); clickSound(); };
document.getElementById('stop').onclick = () => { commandStop(game, [...ui.selected]); clickSound(); };
showMode();

// Gruplar: boşsa dokununca seçimi kaydeder, doluysa seçer; basılı tutunca üzerine yazar
const groupBtns = [...document.querySelectorAll('[data-group]')];
const alive = id => game.units.some(u => u.id === id);
const saveGroup = n => { ui.groups[n] = [...ui.selected].filter(alive); };
const recallGroup = n => { ui.groups[n] = ui.groups[n].filter(alive); ui.selected.clear(); ui.groups[n].forEach(id => ui.selected.add(id)); };
groupBtns.forEach(b => {
  const n = +b.dataset.group; let t = null, long = false;
  b.addEventListener('pointerdown', () => { long = false; t = setTimeout(() => { long = true; saveGroup(n); clickSound(); }, 500); });
  const up = () => { clearTimeout(t); };
  b.addEventListener('pointerleave', up); b.addEventListener('pointercancel', up);
  b.addEventListener('pointerup', () => {
    up(); if (long) return;
    ui.groups[n] = ui.groups[n].filter(alive);
    if (ui.groups[n].length) recallGroup(n); else if (ui.selected.size) saveGroup(n);
    clickSound();
  });
});
const showGroups = () => groupBtns.forEach(b => { const n = +b.dataset.group; b.textContent = `${n + 1}·${ui.groups[n].filter(alive).length}`; });

// Masaüstü kısayolları (isteğe bağlı): 1-3 seç, Ctrl+1-3 kaydet, S dur, A kip
window.addEventListener('keydown', e => {
  if (e.key >= '1' && e.key <= '3') { const n = +e.key - 1; if (e.ctrlKey || e.metaKey) { e.preventDefault(); saveGroup(n); } else recallGroup(n); }
  else if (e.key === 's' || e.key === 'S') commandStop(game, [...ui.selected]);
  else if (e.key === 'a' || e.key === 'A') modeBtn.click();
});
const prodBtns = [...document.querySelectorAll('[data-prod]')];
const showProd = () => prodBtns.forEach(b => b.classList.toggle('on', game.teams[0].prod === b.dataset.prod));
prodBtns.forEach(b => b.onclick = () => { game.teams[0].prod = b.dataset.prod; showProd(); clickSound(); });


// ---- Menü, bölümler, hızlı oyun ----
const $ = id => document.getElementById(id);
const menu = $('menu'), levelsEl = $('levels'), tutEl = $('tut');
const tabs = { camp: $('tab-camp'), quick: $('tab-quick') };
const showTab = t => { Object.entries(tabs).forEach(([k, el]) => { el.hidden = k !== t; }); document.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('on', b.dataset.tab === t)); };
document.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => showTab(b.dataset.tab));

function buildLevels() {
  levelsEl.textContent = '';
  LEVELS.forEach((lv, i) => {
    const open = isUnlocked(progress, i), done = progress.done.includes(lv.id);
    const b = document.createElement('button');
    b.className = 'level'; b.disabled = !open;
    b.innerHTML = `<b>${open ? (done ? '✓' : '▶') : '🔒'} ${i === 0 ? '' : i + '. '}${lv.ad}</b><small>${lv.ipucu}</small>`;
    b.onclick = () => { unlockAudio(); startGame({ ...lv, levelId: lv.id, idx: i }); };
    levelsEl.appendChild(b);
  });
}
const mark = (sel, attr, val) => document.querySelectorAll(sel).forEach(b => b.classList.toggle('on', b.dataset[attr] === String(val)));
const showQuick = () => { mark('[data-diff]', 'diff', diff); mark('[data-en]', 'en', enemyCount); mark('[data-map]', 'map', mapMode); };
document.querySelectorAll('[data-diff]').forEach(b => b.onclick = () => { diff = b.dataset.diff; try { localStorage.setItem('sw-diff', diff); } catch { /* sessiz */ } showQuick(); });
document.querySelectorAll('[data-en]').forEach(b => b.onclick = () => { enemyCount = +b.dataset.en; showQuick(); });
document.querySelectorAll('[data-map]').forEach(b => b.onclick = () => { mapMode = b.dataset.map; showQuick(); });
$('play').onclick = () => {
  unlockAudio();
  startGame({ seed: mapMode === 'classic' ? 0 : 1 + Math.floor(Math.random() * 999999), enemies: ENEMY_SEATS[enemyCount], diff, aiDelay: 0 });
};

function startGame(cfg) {
  current = cfg;
  game = createGame({ seed: cfg.seed, seats: [0, ...cfg.enemies], startUnits: 3 });
  ui.vision = createVision(); ui.selected.clear(); ui.groups = [[], [], []]; ui.mode = 'attack'; showMode();
  ais = cfg.enemies.map(t => createAI(t, cfg.diff, cfg.aiDelay || 0));
  fit(); focusBase();
  tut = cfg.tutorial ? createTutorial(game, cam, ui) : null;
  started = true; ended = false; menu.hidden = true; msg.hidden = true;
}
function showEnd(won) {
  msg.hidden = false; ended = true;
  msg.firstChild.textContent = won ? 'Kazandın!' : 'Kaybettin';
  if (won && current.levelId && !progress.done.includes(current.levelId)) { progress.done.push(current.levelId); saveProgress(progress); }
  const nextLv = won && current.idx != null ? LEVELS[current.idx + 1] : null;
  $('next').hidden = !nextLv;
  $('next').onclick = () => startGame({ ...nextLv, levelId: nextLv.id, idx: current.idx + 1 });
}
$('retry').onclick = () => startGame(current);
$('restart').onclick = () => { started = false; msg.hidden = true; buildLevels(); menu.hidden = false; };
buildLevels(); showQuick(); showTab('camp');

let last = performance.now(), acc = 0;
const DT = 1 / 20;
function frame(now) {
  acc = started ? acc + Math.min(0.25, (now - last) / 1000) : 0; last = now;
  while (started && acc >= DT) { ais.forEach(a => stepAI(game, a, DT)); step(game, DT); fx.update(DT); ui.time += DT; acc -= DT; }
  updateVision(ui.vision, game, 0);
  // sis altındaki olayların efekti ve sesi oyuncuya sızmaz
  for (const e of game.events) if (e.team === 0 || isVisible(ui.vision, e.x, e.y)) { fx.add(e); playEvent(e, 0); }
  game.events.length = 0;
  for (const id of [...ui.selected]) if (!game.units.some(u => u.id === id)) ui.selected.delete(id);
  render(ctx, cam, game, ui);
  const t = 0; showProd(); showGroups();
  hud.textContent = `Nokta ${ownedCount(game, t)} · Birim ${unitCount(game, t)}/${capacity(game, t)} · Üretim ${(spawnInterval(game, t) * CFG.types[game.teams[0].prod].cost).toFixed(1)}sn · Güç x${buff(game, t).toFixed(2)} · Seçili ${ui.selected.size}`;
  const sd = $('seed'); sd.hidden = !(started && current && current.seed); if (!sd.hidden) sd.textContent = 'Harita #' + current.seed;
  if (started && !ended && game.winner !== -1) showEnd(game.winner === 0);
  if (tut && !tut.finished()) {
    tut.update(now); tutEl.hidden = false;
    if (!tut.finished()) { $('tut-text').textContent = tut.step.text; $('tut-n').textContent = `${tut.index + 1}/${tut.total}`; $('tut-skip').textContent = tut.step.done ? 'Atla' : 'Bitti'; }
  } else tutEl.hidden = true;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
$('tut-skip').onclick = () => { if (tut) tut.skip(); };
window.__game = () => ({ game, cam, ui }); // test/hata ayıklama için

// PWA: internetsiz çalışma için hizmet çalışanı (yalnızca https ya da localhost'ta kayıt olur)
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
