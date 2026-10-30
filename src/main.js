import { CFG } from './config.js';
import { createGame, step, commandStop, castSkill, spawnProgress, ownedCount, unitCount, capacity, spawnInterval, buff } from './sim.js';
import { createAI, stepAI, DIFFICULTY } from './ai.js';
import { render, toScreen, toWorld, clampCam } from './iso.js';
import { bindInput } from './input.js';
import { createFx } from './fx.js';
import { createVision, updateVision, isVisible } from './vision.js';
import { LEVELS, ENEMY_SEATS, loadProgress, saveProgress, isUnlocked } from './levels.js';
import { createTutorial } from './tutorial.js';
import { unlockAudio, playEvent, setMuted, isMuted, clickSound } from './audio.js';

const $ = id => document.getElementById(id);
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
const ui = { aimSkill: null, aim: null, usedSkill: false, cast: null, selected: new Set(), toast: null, box: null, arrow: null, pings: [], camMoved: false, usedRun: false, time: 0, groups: [[], [], []], fx, vision, project: (i, j) => toScreen(cam, i, j) };

// Çizim boyutu, tuvalin gerçek (CSS) boyutundan alınır; böylece iPhone Safari'de adres çubuğu açılıp kapanınca
// çizim ile dokunma koordinatları kaymaz. Yakınlaştırma yeniden boyutlandırmada sıfırlanmaz.
function fit() {
  const dpr = window.devicePixelRatio || 1;
  cam.w = canvas.clientWidth || window.innerWidth; cam.h = canvas.clientHeight || window.innerHeight;
  canvas.width = Math.round(cam.w * dpr); canvas.height = Math.round(cam.h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
const defaultZoom = () => { cam.zoom = cam.w < 700 ? 0.7 : 1; };
function focusBase() {
  const b = game.points.find(p => p.base && p.team === 0), w = toWorld(b.x, b.y);
  cam.x = w.x; cam.y = w.y; clampCam(cam);
}
fit(); defaultZoom(); focusBase();
window.addEventListener('resize', fit);
if (window.visualViewport) window.visualViewport.addEventListener('resize', fit);
if (window.ResizeObserver) new ResizeObserver(fit).observe(canvas);
bindInput(canvas, cam, () => game, ui);
canvas.addEventListener('pointerdown', unlockAudio);
try { setMuted(localStorage.getItem('sw-mute') === '1'); } catch { /* kayıt yoksa ses açık */ }
const setSound = on => { setMuted(!on); try { localStorage.setItem('sw-mute', on ? '0' : '1'); } catch { /* sessiz */ } $('p-sound').textContent = on ? '🔊 Ses: Açık' : '🔇 Ses: Kapalı'; };
// Duraklatma menüsü (☰): oyun açıkken simülasyon durur
let paused = false;
const pauseEl = document.getElementById('pause');
const setPause = on => { if (on && (!started || ended)) return; paused = on; pauseEl.hidden = !on; if (on) { ui.aimSkill = null; ui.aim = null; } };
document.getElementById('menubtn').onclick = () => { unlockAudio(); setPause(!paused); clickSound(); };
$('p-resume').onclick = () => { setPause(false); clickSound(); };
$('p-sound').onclick = () => { unlockAudio(); setSound(isMuted()); clickSound(); };
$('p-restart').onclick = () => { setPause(false); startGame(current); };
setSound(!isMuted());
$('p-menu').onclick = () => { setPause(false); started = false; msg.hidden = true; buildLevels(); menu.hidden = false; };
document.addEventListener('visibilitychange', () => { if (document.hidden) setPause(true); }); // başka uygulamaya geçince otomatik duraklat

// Özel yetenekler: düğmeye dokun -> hedefleme (alanı göster, bırakınca kullan). Soğuma süresi düğme üstünde görünür.
ui.cast = (id, x, y) => { const ok = castSkill(game, 0, id, x, y); if (ok) { clickSound(); ui.lastCast = { id, x, y }; } return ok; };
const skillBtns = [...document.querySelectorAll('[data-skill]')];
const toast = text => { ui.toast = { text, t: performance.now() }; };
// İki kullanım: (1) dokun, sonra haritada basılı tutup ayarla, bırak; (2) düğmeyi basılı tutup doğrudan haritaya sürükle ve bırak
// (düğmenin yakınında bırakırsan iptal olur)
skillBtns.forEach(b => {
  const id = b.dataset.skill; let drag = null, lastDrag = 0;
  b.addEventListener('pointerdown', e => {
    if (game.teams[0].skills[id] > 0) return; // hazır değilse sürükleme yok (tıklama kalan süreyi gösterir)
    drag = { x: e.clientX, y: e.clientY, active: false };
    try { b.setPointerCapture(e.pointerId); } catch { /* yakalama yoksa tıklama yolu çalışır */ }
  });
  b.addEventListener('pointermove', e => {
    if (!drag) return;
    if (!drag.active && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 14) { drag.active = true; ui.aimSkill = id; unlockAudio(); }
    if (drag.active) ui.aim = ui.aimFromEvent(e);
  });
  const end = e => {
    if (!drag) return;
    const d = drag; drag = null;
    if (!d.active) return; // basit dokunma: onclick halleder
    lastDrag = performance.now();
    const r = b.getBoundingClientRect();
    const cancel = e.type === 'pointercancel' || Math.hypot(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2)) < 50;
    if (cancel) toast('Yetenek iptal edildi'); else if (ui.aim && ui.cast(id, ui.aim.x, ui.aim.y)) ui.usedSkill = true;
    ui.aimSkill = null; ui.aim = null;
  };
  b.addEventListener('pointerup', end); b.addEventListener('pointercancel', end);
  b.onclick = () => {
    if (performance.now() - lastDrag < 500) return; // sürükleyip bırakmanın ardından gelen tıklamayı yok say
    const left = game.teams[0].skills[id];
    if (left > 0) { toast(`${CFG.skills[id].ad}: ${Math.ceil(left)} sn sonra hazır`); return; }
    ui.aimSkill = ui.aimSkill === id ? null : id; ui.aim = null;
    if (ui.aimSkill) toast(`${CFG.skills[id].ad}: alana parmağını bas, ayarla, bırak`);
    clickSound();
  };
});
const showSkills = () => skillBtns.forEach(b => {
  const id = b.dataset.skill, S = CFG.skills[id], left = Math.max(0, game.teams[0].skills[id]);
  b.style.setProperty('--cd', (left / S.cd).toFixed(3));
  b.classList.toggle('cool', left > 0); b.classList.toggle('aim', ui.aimSkill === id);
  b.querySelector('small').textContent = left > 0 ? Math.ceil(left) : S.kisa;
});

// Seçim varken beliren küçük çubuk: ✋ Dur ve ✕ (seçimi bırak)
const selBar = document.getElementById('sel'), selClear = document.getElementById('selclear');
document.getElementById('stop').onclick = () => { commandStop(game, [...ui.selected]); clickSound(); };
selClear.onclick = () => { ui.selected.clear(); clickSound(); };
$('retreat').onclick = () => { if (ui.doRetreat()) clickSound(); };

// Masaüstü kısayolları (isteğe bağlı): 1-3 grup seç, Ctrl+1-3 kaydet, S dur, Esc seçimi bırak
const alive = id => game.units.some(u => u.id === id);
const saveGroup = n => { ui.groups[n] = [...ui.selected].filter(alive); };
const recallGroup = n => { ui.groups[n] = ui.groups[n].filter(alive); ui.selected.clear(); ui.groups[n].forEach(id => ui.selected.add(id)); };
window.addEventListener('keydown', e => {
  if (e.key >= '1' && e.key <= '3') { const n = +e.key - 1; if (e.ctrlKey || e.metaKey) { e.preventDefault(); saveGroup(n); } else recallGroup(n); }
  else if (e.key === 's' || e.key === 'S') commandStop(game, [...ui.selected]);
  else if (e.key === 'Escape') { if (ui.selected.size || ui.aimSkill) { ui.selected.clear(); ui.aimSkill = null; ui.aim = null; } else setPause(!paused); }
  else if ('qwe'.includes(e.key.toLowerCase()) && e.key.length === 1) skillBtns['qwe'.indexOf(e.key.toLowerCase())].click();
});
const prodBtns = [...document.querySelectorAll('[data-prod]')];
// Seçili üretim kartında sıradaki birime kalan süre dolan bir çember olarak ve saniyeyle görünür (kapasite dolunca "Dolu")
const showProd = () => {
  const pr = spawnProgress(game, 0);
  prodBtns.forEach(b => {
    const on = game.teams[0].prod === b.dataset.prod;
    b.classList.toggle('on', on); b.classList.toggle('full', on && pr.full);
    b.style.setProperty('--pg', on && !pr.full ? (1 - pr.left / pr.total).toFixed(3) : '0');
    b.querySelector('small').textContent = !on ? CFG.types[b.dataset.prod].label : pr.full ? 'Dolu' : `${Math.ceil(pr.left)} sn`;
  });
};
prodBtns.forEach(b => b.onclick = () => { game.teams[0].prod = b.dataset.prod; showProd(); clickSound(); });


// ---- Menü, bölümler, hızlı oyun ----
const menu = $('menu'), levelsEl = $('levels'), tutEl = $('tut');
const tabs = { camp: $('tab-camp'), quick: $('tab-quick') };
const showTab = t => { Object.entries(tabs).forEach(([k, el]) => { el.hidden = k !== t; }); document.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('on', b.dataset.tab === t)); };
document.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => showTab(b.dataset.tab));

function buildLevels() {
  levelsEl.textContent = '';
  LEVELS.forEach((lv, i) => {
    const open = isUnlocked(progress, i), done = progress.done.includes(lv.id);
    const b = document.createElement('button');
    b.className = 'level' + (done ? ' done' : ''); b.disabled = !open; b.style.setProperty('--i', i);
    const rakip = lv.enemies.length, d = DIFFICULTY[lv.diff];
    b.innerHTML = `<span class="num">${done ? '✓' : open ? (i === 0 ? '★' : i) : '🔒'}</span>
      <span class="txt"><b>${lv.ad}</b><small>${lv.ipucu}</small></span>
      <span class="meta"><em class="pill d-${lv.diff}">${d.label}</em><em class="pill">${rakip} rakip</em></span>`;
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
  ui.vision = createVision(); ui.selected.clear(); ui.groups = [[], [], []]; ui.camMoved = false; ui.usedRun = false; ui.usedSkill = false; ui.usedRetreat = false; ui.aimSkill = null; ui.aim = null; ui.pings.length = 0;
  ais = cfg.enemies.map(t => createAI(t, cfg.diff, cfg.aiDelay || 0));
  fit(); defaultZoom(); focusBase();
  tut = cfg.tutorial ? createTutorial(game, cam, ui) : null;
  started = true; ended = false; paused = false; pauseEl.hidden = true; menu.hidden = true; msg.hidden = true;
}
function showEnd(won) {
  msg.hidden = false; ended = true;
  msg.firstChild.textContent = won ? 'Kazandın!' : 'Kaybettin';
  msg.classList.toggle('win', won); msg.classList.toggle('lose', !won);
  $('retry').classList.toggle('primary', !won);
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
  acc = started && !paused ? acc + Math.min(0.25, (now - last) / 1000) : 0; last = now;
  while (started && !paused && acc >= DT) { ais.forEach(a => stepAI(game, a, DT)); step(game, DT); fx.update(DT); ui.time += DT; acc -= DT; }
  updateVision(ui.vision, game, 0);
  // sis altındaki olayların efekti ve sesi oyuncuya sızmaz
  for (const e of game.events) if (e.team === 0 || isVisible(ui.vision, e.x, e.y)) { fx.add(e); playEvent(e, 0); }
  game.events.length = 0;
  for (const id of [...ui.selected]) if (!game.units.some(u => u.id === id)) ui.selected.delete(id);
  render(ctx, cam, game, ui);
  const t = 0; showProd(); showSkills();
  const tt = document.getElementById('toast'); tt.hidden = !(ui.toast && performance.now() - ui.toast.t < 1400); if (!tt.hidden) tt.textContent = ui.toast.text;
  selBar.hidden = ui.selected.size === 0; selClear.textContent = `✕ ${ui.selected.size}`;
  for (const pg of ui.pings.splice(0)) fx.add({ type: 'ping', ...pg });
  hud.textContent = `Nokta ${ownedCount(game, t)} · Birim ${unitCount(game, t)}/${capacity(game, t)} · Üretim ${(spawnInterval(game, t) * CFG.types[game.teams[0].prod].cost).toFixed(1)}sn · Güç x${buff(game, t).toFixed(2)}`;
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
