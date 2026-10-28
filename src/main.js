import { CFG } from './config.js';
import { createGame, step, ownedCount, unitCount, capacity, spawnInterval, buff } from './sim.js';
import { createAI, stepAI } from './ai.js';
import { render, toScreen, toWorld, clampCam } from './iso.js';
import { bindInput } from './input.js';
import { createFx } from './fx.js';
import { createVision, updateVision, isVisible } from './vision.js';
import { unlockAudio, playEvent, setMuted, isMuted, clickSound } from './audio.js';

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const hud = document.getElementById('hud');
const msg = document.getElementById('msg');
let game = createGame();
let ais = [1, 2, 3].map(createAI);
const cam = { x: 0, y: 0, zoom: 1, w: 0, h: 0 };
const fx = createFx();
const vision = createVision();
const ui = { selected: new Set(), box: null, time: 0, fx, vision, project: (i, j) => toScreen(cam, i, j) };

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
const prodBtns = [...document.querySelectorAll('[data-prod]')];
const showProd = () => prodBtns.forEach(b => b.classList.toggle('on', game.teams[0].prod === b.dataset.prod));
prodBtns.forEach(b => b.onclick = () => { game.teams[0].prod = b.dataset.prod; showProd(); clickSound(); });
document.getElementById('restart').onclick = () => { game = createGame(); ui.vision = createVision(); ais = [1, 2, 3].map(createAI); ui.selected.clear(); msg.hidden = true; focusBase(); };

let last = performance.now(), acc = 0;
const DT = 1 / 20;
function frame(now) {
  acc += Math.min(0.25, (now - last) / 1000); last = now;
  while (acc >= DT) { ais.forEach(a => stepAI(game, a, DT)); step(game, DT); fx.update(DT); ui.time += DT; acc -= DT; }
  updateVision(ui.vision, game, 0);
  // sis altındaki olayların efekti ve sesi oyuncuya sızmaz
  for (const e of game.events) if (e.team === 0 || isVisible(ui.vision, e.x, e.y)) { fx.add(e); playEvent(e, 0); }
  game.events.length = 0;
  for (const id of [...ui.selected]) if (!game.units.some(u => u.id === id)) ui.selected.delete(id);
  render(ctx, cam, game, ui);
  const t = 0; showProd();
  hud.textContent = `Nokta ${ownedCount(game, t)} · Birim ${unitCount(game, t)}/${capacity(game, t)} · Üretim ${(spawnInterval(game, t) * CFG.types[game.teams[0].prod].cost).toFixed(1)}sn · Güç x${buff(game, t).toFixed(2)}`;
  if (game.winner !== -1) { msg.hidden = false; msg.firstChild.textContent = game.winner === 0 ? 'Kazandın!' : 'Kaybettin'; }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
window.__game = () => ({ game, cam, ui }); // test/hata ayıklama için
