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
  const cdp = await ctx.newCDPSession(p);
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
  const wait = ms => p.waitForTimeout(ms);
  const st = () => p.evaluate(() => { const { ui, game } = window.__game(); return { sel: ui.selected.size, selBar: !document.getElementById('sel').hidden, run: ui.usedRun, units: game.units.filter(u => u.team === 0).length }; });
  // ekran (CSS) koordinatları: birim gövdesi, nokta
  const unitXY = i => p.evaluate(i => { const { game, ui, cam } = window.__game(); const u = game.units.filter(x => x.team === 0)[i]; const s = ui.project(u.x, u.y); const r = document.getElementById('c').getBoundingClientRect(); return { x: s.x * r.width / cam.w, y: (s.y - 18 * cam.zoom) * r.height / cam.h }; }, i);
  const tileXY = (i, j) => p.evaluate(([i, j]) => { const { ui, cam } = window.__game(); const s = ui.project(i, j); const r = document.getElementById('c').getBoundingClientRect(); return { x: s.x * r.width / cam.w, y: s.y * r.height / cam.h }; }, [i, j]);
  const swipe = async (from, to, steps = 6) => { await touch('touchStart', [from]); for (let k = 1; k <= steps; k++) await touch('touchMove', [{ x: from.x + (to.x - from.x) * k / steps, y: from.y + (to.y - from.y) * k / steps }]); await touch('touchEnd', []); await wait(600); };
  // birimleri sabitle ve üssün önüne diz (testler hareketten etkilenmesin)
  const freeze = () => p.evaluate(() => { const { game, cam, ui } = window.__game(); cam.zoom = 0.7; ui.selected.clear(); game.units.forEach(u => { u.tx = u.ty = null; u.hold = true; u.mode = 'attack'; }); const b = game.points.find(x => x.base && x.team === 0); game.units.filter(u => u.team === 0).forEach((u, k) => { u.x = b.x + (k - 1) * 1.6; u.y = b.y + 1.5; }); });

  await p.goto(url); await wait(400);
  ok(await p.isVisible('#menu'), 'menü açılışta görünüyor');
  ok(await p.locator('.level').count() === 6, '6 bölüm listeleniyor');
  ok(await p.locator('.level:disabled').count() === 5, 'yalnızca öğretici açık, diğerleri kilitli');

  // Öğretici: birime dokun -> adım ilerler
  await p.tap('.level:nth-child(1)'); await wait(300);
  ok(!(await p.isVisible('#menu')) && await p.isVisible('#tut'), 'bölüm başladı, öğretici bandı görünüyor');
  const u0 = await unitXY(0);
  await p.touchscreen.tap(u0.x, u0.y); await wait(1500);
  ok((await p.textContent('#tut-n')) === '2/8', 'öğretici birime dokununca 2. adıma geçti');

  // Kazanma / kaybetme akışı
  await p.evaluate(() => { const { game } = window.__game(); game.teams.forEach(t => { if (t.id !== 0) t.alive = false; }); game.winner = 0; });
  await wait(400);
  ok((await p.textContent('#msg > span')) === 'Kazandın!', 'kazanma ekranı');
  ok(await p.isVisible('#next'), '"Sonraki bölüm" görünüyor');
  ok((await p.evaluate(() => JSON.parse(localStorage.getItem('sw-progress')).done.join())) === 'ogretici', 'ilerleme kaydedildi');
  await p.tap('#next'); await wait(400);
  ok((await p.evaluate(() => window.__game().game.seed)) === 11, 'bölüm 1 rastgele harita seed 11 ile başladı');
  await p.evaluate(() => { window.__game().game.winner = -2; }); await wait(400);
  ok((await p.textContent('#msg > span')) === 'Kaybettin', 'kaybetme ekranı');
  ok(!(await p.isVisible('#next')), 'kayıpta "Sonraki bölüm" yok');
  await p.tap('#restart'); await wait(200);
  ok(await p.isVisible('#menu') && (await p.locator('.level:disabled').count()) === 4, 'menüye dönüldü, bölüm 1 açıldı');

  // Hızlı oyun
  await p.tap('[data-tab="quick"]'); await p.tap('[data-diff="zor"]'); await p.tap('[data-en="2"]'); await p.tap('#play'); await wait(2500);
  const q = await p.evaluate(() => { const { game } = window.__game(); return { seats: game.seats.join(), t: game.t }; });
  ok(q.seats === '0,1,3' && q.t > 1, 'hızlı oyun 2 rakiple çalışıyor ve zaman ilerliyor');
  ok((await p.locator('button:visible').count()) <= 8, 'oyun ekranında en fazla 8 düğme görünüyor (seçim yokken 5)');

  // --- Dokunmatik hareketler ---
  await freeze(); await wait(100);
  ok(!(await st()).selBar, 'seçim yokken ✋/✕ çubuğu gizli');

  // seçime ekle / çıkar
  const a = await unitXY(0), b = await unitXY(1), c = await unitXY(2);
  await p.touchscreen.tap(a.x, a.y); await wait(450); await p.touchscreen.tap(b.x, b.y); await wait(450);
  ok((await st()).sel === 2 && (await st()).selBar, 'art arda dokunmak seçime ekliyor, çubuk görünüyor');
  await p.touchscreen.tap(a.x, a.y); await wait(450);
  ok((await st()).sel === 1, 'seçili birime tekrar dokunmak seçimden çıkarıyor');
  await p.tap('#selclear'); await wait(150);
  ok((await st()).sel === 0 && !(await st()).selBar, '✕ düğmesi seçimi bırakıyor ve çubuk kayboluyor');

  // üsse dokun = hepsi
  const base = await p.evaluate(() => { const { game } = window.__game(); const b2 = game.points.find(x => x.base && x.team === 0); return { i: b2.x, j: b2.y }; });
  const bxy = await tileXY(base.i + 0.4, base.j - 0.9);
  await p.touchscreen.tap(bxy.x, bxy.y); await wait(450);
  ok((await st()).sel === (await st()).units, 'üsse dokununca hepsi seçiliyor');
  await p.tap('#selclear'); await wait(150);

  // boş yerde sürükle = çerçeveyle seç (tek parmak, düğmeye gerek yok)
  const cam0 = await p.evaluate(() => { const { cam } = window.__game(); return { x: cam.x, y: cam.y }; });
  const xs = [a, b, c].map(q => q.x), ys = [a, b, c].map(q => q.y);
  await swipe({ x: Math.min(...xs) - 55, y: Math.min(...ys) - 55 }, { x: Math.max(...xs) + 55, y: Math.max(...ys) + 55 });
  ok((await st()).sel === 3, 'boş yerde tek parmakla sürükleyince çerçevedekiler seçiliyor');
  ok(await p.evaluate(c0 => { const { cam } = window.__game(); return cam.x === c0.x && cam.y === c0.y; }, cam0), 'tek parmak sürükleme haritayı kaydırmıyor');

  // seçiliyken dokun = saldır, doğru kareye (tuval ölçüsü kaysa bile)
  await p.evaluate(() => { document.getElementById('c').style.height = 'calc(100vh * 1.12)'; }); await wait(300);
  const goal = { i: base.i - 3, j: base.j + 2 };
  const gxy = await tileXY(goal.i, goal.j);
  await p.touchscreen.tap(gxy.x, gxy.y); await wait(200);
  const got = await p.evaluate(() => { const u = window.__game().game.units.find(x => x.team === 0 && x.tx !== null); return u && { tx: u.tx, ty: u.ty, mode: u.mode }; });
  ok(got && Math.hypot(got.tx - goal.i, got.ty - goal.j) < 0.7 && got.mode === 'attack', 'seçiliyken dokunulan yere saldır-hareketiyle gidiyor (tuval ölçüsü kaysa bile)');
  ok((await st()).sel === 0, 'emir verilince seçim kendiliğinden bırakılıyor');
  await p.evaluate(() => { document.getElementById('c').style.height = ''; }); await wait(300);
  await p.evaluate(() => { const { cam } = window.__game(); cam.zoom = 1.3; window.dispatchEvent(new Event('resize')); }); await wait(150);
  ok((await p.evaluate(() => window.__game().cam.zoom)) === 1.3, 'yeniden boyutlandırma yakınlaştırmayı sıfırlamıyor');

  // ✋ Dur (önce üsse dokunup hepsini seç)
  await p.evaluate(() => { window.__game().cam.zoom = 0.7; }); await wait(100);
  const bxy2 = await tileXY(base.i + 0.4, base.j - 0.9);
  await p.touchscreen.tap(bxy2.x, bxy2.y); await wait(450);
  await p.tap('#stop'); await wait(150);
  ok(await p.evaluate(() => (() => { const { game, ui } = window.__game(); const sel = game.units.filter(u => ui.selected.has(u.id)); return sel.length > 0 && sel.every(u => u.tx === null && u.hold); })()), '✋ Dur hedefi iptal edip mevzi tutturuyor');

  // birimden sürükle = ok çizip gönder (tek hareketle seç + gönder)
  await freeze(); await wait(100);
  const a2 = await unitXY(0);
  const gx = await tileXY(base.i - 4, base.j + 3);
  await swipe(a2, gx);
  const arr = await p.evaluate(() => { const { game, ui } = window.__game(); const us = game.units.filter(u => u.team === 0); return { moving: us.filter(u => u.tx !== null).length, sel: ui.selected.size, t: us[0].tx }; });
  ok(arr.moving === 1 && arr.sel === 0 && arr.t !== null, 'birimden sürükleyip bırakmak yalnızca o birimi gönderiyor ve seçimi bırakıyor');

  // boşta basılı tut = koş (savaşmaz)
  await freeze(); await wait(100);
  await p.touchscreen.tap(a2.x, a2.y); await wait(450);
  const far = await tileXY(base.i - 4, base.j + 3);
  await touch('touchStart', [far]); await wait(600); await touch('touchEnd', []); await wait(600);
  const run = await p.evaluate(() => { const { game, ui } = window.__game(); const u = game.units.filter(x => x.team === 0).find(x => x.tx !== null); return { mode: u && u.mode, used: ui.usedRun }; });
  ok(run.mode === 'move' && run.used && (await st()).sel === 0, 'boşta basılı tutmak birimleri koşturuyor (savaşmaz kipi) ve seçimi bırakıyor');

  const empty = await tileXY(base.i - 4, base.j + 3);
  // iki parmakla tek sefer dokunma = iptal (seçim bırakılır; seçim yoksa son emir geri alınır)
  await freeze(); await wait(100);
  const t1 = await unitXY(0);
  await p.touchscreen.tap(t1.x, t1.y); await wait(450);
  ok((await st()).sel === 1, 'birim seçildi (iki parmak iptali senaryosu)');
  const camT = await p.evaluate(() => { const { cam } = window.__game(); return { x: cam.x, y: cam.y, z: cam.zoom }; });
  await touch('touchStart', [{ x: 150, y: 300 }, { x: 230, y: 300 }]); await wait(80); await touch('touchEnd', []); await wait(600);
  const afterTT = await p.evaluate(() => { const { cam, ui } = window.__game(); return { x: cam.x, y: cam.y, z: cam.zoom, sel: ui.selected.size, toast: ui.toast && ui.toast.text }; });
  ok(afterTT.sel === 0 && afterTT.x === camT.x && afterTT.y === camT.y && afterTT.z === camT.z, 'iki parmakla tek dokunuş seçimi bırakıyor, haritayı kaydırmıyor/yakınlaştırmıyor');
  // seçim yokken: son emri geri al
  await p.touchscreen.tap(t1.x, t1.y); await wait(450);
  await p.touchscreen.tap(empty.x, empty.y); await wait(500);
  ok(await p.evaluate(() => window.__game().game.units.some(u => u.team === 0 && u.tx !== null)), 'emir verildi (geri alma senaryosu)');
  await touch('touchStart', [{ x: 150, y: 300 }, { x: 230, y: 300 }]); await wait(80); await touch('touchEnd', []); await wait(600);
  ok(await p.evaluate(() => !window.__game().game.units.some(u => u.team === 0 && u.tx !== null)), 'seçim yokken iki parmakla dokunuş son emri geri alıyor');

  // --- Özel yetenekler ---
  await freeze(); await wait(100);
  ok((await p.locator('#skills button:visible').count()) === 3, '3 yetenek düğmesi görünüyor');
  const tgt = await tileXY(base.i, base.j + 1.5);
  // soğumadayken dokunmak hedeflemeyi başlatmaz
  await p.evaluate(() => { const { game } = window.__game(); game.teams[0].skills.sifa = 20; });
  await p.tap('[data-skill="sifa"]'); await wait(120);
  ok(await p.evaluate(() => window.__game().ui.aimSkill === null), 'soğumadaki yetenek hedeflemeyi başlatmıyor');
  // Şifa: hazırken dokun, parmağı bas-sürükle-bırak
  await p.evaluate(() => { const { game } = window.__game(); game.teams[0].skills.sifa = 0; game.units.filter(u => u.team === 0).forEach(u => { u.hp = u.maxHp * 0.4; }); });
  await p.tap('[data-skill="sifa"]'); await wait(120);
  ok(await p.evaluate(() => window.__game().ui.aimSkill === 'sifa'), 'hazır yeteneğe dokununca hedefleme başladı');
  await touch('touchStart', [{ x: tgt.x + 30, y: tgt.y + 44 }]);
  for (let k = 1; k <= 4; k++) await touch('touchMove', [{ x: tgt.x + 30 - k * 7.5, y: tgt.y + 44 }]);
  const aimNow = await p.evaluate(() => { const { ui } = window.__game(); return ui.aim && { x: ui.aim.x, y: ui.aim.y }; });
  ok(aimNow !== null, 'hedeflerken alan önizlemesi var');
  await touch('touchEnd', []); await wait(600);
  const healed = await p.evaluate(() => { const { game, ui } = window.__game(); const us = game.units.filter(u => u.team === 0 && Math.hypot(u.x - ui.lastCast.x, u.y - ui.lastCast.y) <= 3.2); return { n: us.length, min: Math.min(...us.map(u => u.hp / u.maxHp)), cd: game.teams[0].skills.sifa, aim: ui.aimSkill, used: ui.usedSkill }; });
  ok(healed.n >= 3 && healed.min > 0.65 && healed.cd > 40 && healed.aim === null && healed.used, `Şifa %30 can bastı (en düşük ${(healed.min * 100).toFixed(0)}%), bekleme başladı, hedefleme kapandı`);
  ok(await p.evaluate(() => document.querySelector('[data-skill="sifa"]').classList.contains('cool')), 'kullanılan yetenek düğmesinde soğuma göstergesi var');
  // Ok Yağmuru: yalnızca düşmana hasar
  await p.evaluate(() => { const { game } = window.__game(); game.teams[0].skills.yagmur = 0; const b3 = game.points.find(x => x.base && x.team === 0); const e0 = game.units.find(u => u.team !== 0); e0.x = b3.x; e0.y = b3.y + 1.5; e0.hp = e0.maxHp; window.__foe = e0.id; });
  await p.tap('[data-skill="yagmur"]'); await wait(120);
  await touch('touchStart', [{ x: tgt.x, y: tgt.y + 44 }]); await touch('touchMove', [{ x: tgt.x, y: tgt.y + 44 }]); await touch('touchEnd', []); await wait(600);
  ok(await p.evaluate(() => { const { game } = window.__game(); const e0 = game.units.find(u => u.id === window.__foe); return !e0 || e0.hp <= e0.maxHp - 40; }), 'Ok Yağmuru alandaki düşmana hasar verdi');
  // iki parmakla dokunma hedeflemeyi iptal eder
  await p.evaluate(() => { const { game } = window.__game(); game.teams[0].skills.hiz = 0; });
  await p.tap('[data-skill="hiz"]'); await wait(120);
  await touch('touchStart', [{ x: 150, y: 300 }, { x: 230, y: 300 }]); await wait(80); await touch('touchEnd', []); await wait(600);
  ok(await p.evaluate(() => window.__game().ui.aimSkill === null), 'iki parmakla dokunma yetenek hedeflemeyi iptal ediyor');

  // yanlış seçilen birim: boşa çift dokun -> emir geri alınır, seçim bırakılır
  await freeze(); await wait(100);
  const w = await unitXY(0);
  await p.touchscreen.tap(w.x, w.y); await wait(450);
  ok((await st()).sel === 1, 'birim seçildi (yanlış seçim senaryosu)');
  await p.touchscreen.tap(empty.x, empty.y); await wait(90); await p.touchscreen.tap(empty.x, empty.y); await wait(500);
  const dbl = await p.evaluate(() => { const { game, ui } = window.__game(); return { sel: ui.selected.size, moving: game.units.filter(u => u.team === 0 && u.tx !== null).length }; });
  ok(dbl.sel === 0 && dbl.moving === 0, 'boşa çift dokunmak seçimi bırakıyor ve birimi hiçbir yere göndermiyor');
  // gerçek insan ritmi: iki dokunuş arası 250-500 ms, ikinci dokunuş birkaç piksel kayık
  for (const gap of [250, 400, 500]) {
    await freeze(); await wait(100);
    const w2 = await unitXY(0);
    await p.touchscreen.tap(w2.x, w2.y); await wait(450);
    await p.touchscreen.tap(empty.x, empty.y); await wait(gap); await p.touchscreen.tap(empty.x + 14, empty.y + 9); await wait(300);
    const r2 = await p.evaluate(() => { const { game, ui } = window.__game(); return { sel: ui.selected.size, moving: game.units.filter(u => u.team === 0 && u.tx !== null).length, toast: !document.getElementById('toast').hidden }; });
    ok(r2.sel === 0 && r2.moving === 0 && r2.toast, `çift dokunma ${gap} ms aralıkla da emri geri alıyor ve "geri alındı" mesajı çıkıyor`);
  }
  // bilinçli iki ayrı emir (aralarında yeniden seçim var) geri alınmamalı
  await freeze(); await wait(100);
  const w3 = await unitXY(0);
  await p.touchscreen.tap(w3.x, w3.y); await wait(450); await p.touchscreen.tap(empty.x, empty.y); await wait(900);
  ok(await p.evaluate(() => window.__game().game.units.some(u => u.team === 0 && u.tx !== null)), 'yavaş ikinci dokunuş (900 ms) emri geri almıyor');

  // nokta renkleri: tarafsız silik gri, ele geçirilince takımın rengi (çizilen piksellerden ölçülür)
  await freeze(); await wait(100);
  const px = () => p.evaluate(() => { const { game, ui, cam } = window.__game(); const dpr = window.devicePixelRatio || 1; const pt = game.points.find(q => !q.base && q.kind === 'eko' && Math.hypot(q.x - game.points.find(b => b.base && b.team === 0).x, q.y - game.points.find(b => b.base && b.team === 0).y) < 6); const s = ui.project(pt.x, pt.y); const d = document.getElementById('c').getContext('2d').getImageData(Math.round((s.x + 16) * dpr), Math.round(s.y * dpr), 1, 1).data; return { id: pt.id, rgb: [d[0], d[1], d[2]], owner: pt.owner }; });
  const neutral = await px();
  await p.evaluate(id => { window.__game().game.points[id].owner = 0; }, neutral.id); await wait(300);
  const owned = await px();
  const spread = c => Math.max(...c) - Math.min(...c);
  ok(neutral.owner === -1 && spread(neutral.rgb) < 15 && neutral.rgb[0] > 150, `tarafsız nokta silik gri çiziliyor (rgb ${neutral.rgb})`);
  ok(owned.owner === 0 && owned.rgb[0] > 130 && owned.rgb[1] < 60 && owned.rgb[2] > 130, `ele geçirilen nokta takımın (mor) rengini alıyor (rgb ${owned.rgb})`);

  // iki parmak: kaydır + yakınlaştır
  const before = await p.evaluate(() => { const { cam } = window.__game(); return { x: cam.x, y: cam.y, z: cam.zoom }; });
  await touch('touchStart', [{ x: 150, y: 400 }, { x: 250, y: 400 }]);
  for (let k = 1; k <= 6; k++) await touch('touchMove', [{ x: 150 + k * 8, y: 400 + k * 6 }, { x: 250 + k * 12, y: 400 + k * 6 }]);
  await touch('touchEnd', []); await wait(600);
  const after = await p.evaluate(() => { const { cam, ui } = window.__game(); return { x: cam.x, y: cam.y, z: cam.zoom, moved: ui.camMoved }; });
  ok(after.moved && (Math.hypot(after.x - before.x, after.y - before.y) > 20) && after.z > before.z, 'iki parmak haritayı kaydırıyor ve yakınlaştırıyor');

  ok(errs.length === 0, 'konsol hatası yok' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await browser.close(); server.close();
  console.log('e2e tamam');
})().catch(e => { console.error(e.message); process.exit(1); });
