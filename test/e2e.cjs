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
  ok(errs.length === 0, 'konsol hatası yok' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await browser.close(); server.close();
  console.log('e2e tamam');
})().catch(e => { console.error(e.message); process.exit(1); });
