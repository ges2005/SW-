// Uçtan uca test: telefon boyutunda headless Chromium. Kullanım: node test/e2e.cjs
// Kendi statik sunucusunu açar; konsol hatası olursa başarısız olur.
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const root = path.join(__dirname, '..');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const server = http.createServer((req, res) => {
  const f = path.join(root, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html'));
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
});
const ok = (c, m) => { if (!c) throw new Error('BAŞARISIZ: ' + m); console.log('  ✓', m); };

(async () => {
  await new Promise(r => server.listen(0, r));
  const url = `http://localhost:${server.address().port}/`;
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 780 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  await p.goto(url); await p.waitForTimeout(400);
  ok(await p.isVisible('#menu'), 'menü açılışta görünüyor');
  ok(await p.locator('.level').count() === 6, '6 bölüm listeleniyor');
  ok(await p.locator('.level:disabled').count() === 5, 'yalnızca öğretici açık, diğerleri kilitli');

  // Öğretici bölümü: seç -> gönder -> adım ilerler
  await p.tap('.level:nth-child(1)'); await p.waitForTimeout(300);
  ok(!(await p.isVisible('#menu')) && await p.isVisible('#tut'), 'bölüm başladı, öğretici bandı görünüyor');
  await p.tap('#all'); await p.waitForTimeout(1500);
  ok((await p.textContent('#tut-n')) === '2/7', 'öğretici seçimden sonra 2. adıma geçti');

  // Kazanma akışı
  await p.evaluate(() => { const { game } = window.__game(); game.teams.forEach(t => { if (t.id !== 0) t.alive = false; }); game.winner = 0; });
  await p.waitForTimeout(400);
  ok((await p.textContent('#msg > span')) === 'Kazandın!', 'kazanma ekranı');
  ok(await p.isVisible('#next'), '"Sonraki bölüm" görünüyor');
  ok((await p.evaluate(() => JSON.parse(localStorage.getItem('sw-progress')).done.join())) === 'ogretici', 'ilerleme kaydedildi');
  await p.tap('#next'); await p.waitForTimeout(400);
  ok((await p.evaluate(() => window.__game().game.seed)) === 11, 'bölüm 1 rastgele harita seed 11 ile başladı');

  // Kaybetme akışı + menüye dönüş
  await p.evaluate(() => { window.__game().game.winner = -2; });
  await p.waitForTimeout(400);
  ok((await p.textContent('#msg > span')) === 'Kaybettin', 'kaybetme ekranı');
  ok(!(await p.isVisible('#next')), 'kayıpta "Sonraki bölüm" yok');
  await p.tap('#restart'); await p.waitForTimeout(200);
  ok(await p.isVisible('#menu') && (await p.locator('.level:disabled').count()) === 4, 'menüye dönüldü, bölüm 1 açıldı');

  // Hızlı oyun
  await p.tap('[data-tab="quick"]'); await p.tap('[data-diff="zor"]'); await p.tap('[data-en="2"]'); await p.tap('#play'); await p.waitForTimeout(2500);
  const q = await p.evaluate(() => { const { game } = window.__game(); return { seats: game.seats.join(), t: game.t }; });
  ok(q.seats === '0,1,3' && q.t > 1, 'hızlı oyun 2 rakiple çalışıyor ve zaman ilerliyor');
  // --- Dokunma düzeltmeleri (iPhone geri bildirimi) ---
  const cdp = await ctx.newCDPSession(p);
  const touch = async (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
  const state = () => p.evaluate(() => { const { ui } = window.__game(); return { sel: ui.selected.size, box: ui.boxMode }; });
  const unitXY = i => p.evaluate(i => { const { game, ui, cam } = window.__game(); const us = game.units.filter(u => u.team === 0); const u = us[i]; const s = ui.project(u.x, u.y); const r = document.getElementById('c').getBoundingClientRect(); return { x: s.x * r.width / cam.w, y: (s.y - 18 * cam.zoom) * r.height / cam.h }; }, i);

  // 1) adres çubuğu simülasyonu: tuval CSS boyutu çizim boyutundan büyük olsa da hedef doğru kareye gider
  await p.evaluate(() => { document.getElementById('c').style.height = 'calc(100vh * 1.12)'; });
  await p.waitForTimeout(300);
  await p.tap('#all');
  const goal = await p.evaluate(() => { const { game, ui, cam } = window.__game(); const b = game.points.find(x => x.base && x.team === 0); const g = { i: b.x - 3, j: b.y + 2 }; const s = ui.project(g.i, g.j); const r = document.getElementById('c').getBoundingClientRect(); return { ...g, x: s.x * r.width / cam.w, y: s.y * r.height / cam.h }; });
  await p.touchscreen.tap(goal.x, goal.y); await p.waitForTimeout(150);
  const got = await p.evaluate(() => { const u = window.__game().game.units.find(x => x.team === 0 && x.tx !== null); return u && { tx: u.tx, ty: u.ty }; });
  ok(got && Math.hypot(got.tx - goal.i, got.ty - goal.j) < 0.6, 'dokunulan yere gidiyor (tuval ölçüsü kaysa bile, hata < 0.6 kare)');
  await p.evaluate(() => { document.getElementById('c').style.height = ''; }); await p.waitForTimeout(300);
  await p.evaluate(() => { const { cam } = window.__game(); cam.zoom = 1.3; window.dispatchEvent(new Event('resize')); });
  await p.waitForTimeout(150);
  ok((await p.evaluate(() => window.__game().cam.zoom)) === 1.3, 'yeniden boyutlandırma yakınlaştırmayı sıfırlamıyor');
  await p.evaluate(() => { const { game, cam, ui } = window.__game(); cam.zoom = 0.7; ui.selected.clear(); game.units.forEach(u => { u.tx = u.ty = null; u.hold = true; }); const b = game.points.find(x => x.base && x.team === 0); game.units.filter(u => u.team === 0).forEach((u, k) => { u.x = b.x + (k - 1) * 1.6; u.y = b.y + 1.5; }); });

  // 2) bırakma: seçiliye tekrar dokun ya da ✕ Bırak
  const u0 = await unitXY(0);
  await p.touchscreen.tap(u0.x, u0.y); await p.waitForTimeout(450);
  ok((await state()).sel === 1, 'birime dokununca seçiliyor');
  await p.touchscreen.tap(u0.x, u0.y); await p.waitForTimeout(450);
  ok((await state()).sel === 0, 'seçiliye tekrar dokununca seçim bırakılıyor');
  await p.tap('#all'); await p.tap('#none');
  ok((await state()).sel === 0, '✕ Bırak düğmesi seçimi kaldırıyor');

  // 3) çoklu seçim: ▭ Kutu kipi ile sürükleyerek
  await p.tap('#boxmode'); ok((await state()).box === true, '▭ Kutu kipi açıldı');
  const pts = await p.evaluate(() => { const { game, ui, cam } = window.__game(); const r = document.getElementById('c').getBoundingClientRect(); const xy = game.units.filter(u => u.team === 0).map(u => { const s = ui.project(u.x, u.y); return { x: s.x * r.width / cam.w, y: (s.y - 18 * cam.zoom) * r.height / cam.h }; }); return xy; });
  const x0 = Math.min(...pts.map(q => q.x)) - 30, y0 = Math.min(...pts.map(q => q.y)) - 30, x1 = Math.max(...pts.map(q => q.x)) + 30, y1 = Math.max(...pts.map(q => q.y)) + 30;
  await touch('touchStart', [{ x: x0, y: y0 }]);
  for (let k = 1; k <= 6; k++) await touch('touchMove', [{ x: x0 + (x1 - x0) * k / 6, y: y0 + (y1 - y0) * k / 6 }]);
  await touch('touchEnd', []); await p.waitForTimeout(600);
  const nUnits = pts.length;
  ok((await state()).sel === nUnits && nUnits >= 3, `kutu çizince hepsi seçildi (${nUnits} birim)`);
  await p.tap('#none');
  const a = await unitXY(0), b2 = await unitXY(1);
  await p.touchscreen.tap(a.x, a.y); await p.waitForTimeout(100); await p.touchscreen.tap(b2.x, b2.y); await p.waitForTimeout(100);
  ok((await state()).sel === 2, 'kutu kipinde dokunmak seçime ekliyor');
  await p.touchscreen.tap(a.x, a.y); await p.waitForTimeout(100);
  ok((await state()).sel === 1, 'kutu kipinde seçili birime tekrar dokunmak seçimden çıkarıyor');
  await p.tap('#boxmode');

  ok(errs.length === 0, 'konsol hatası yok' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await browser.close(); server.close();
  console.log('e2e tamam');
})().catch(e => { console.error(e.message); process.exit(1); });
