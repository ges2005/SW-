// PWA ve düzen testi: kurulabilirlik, hizmet çalışanı, internetsiz açılış, dikey/yatay yerleşim.
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
const inter = (a, b) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

(async () => {
  await new Promise(r => server.listen(0, r));
  const url = `http://localhost:${server.address().port}/`;
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 780 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));

  // manifest
  await p.goto(url); await p.waitForTimeout(500);
  const man = await p.evaluate(async () => (await fetch(document.querySelector('link[rel=manifest]').href)).json());
  ok(man.name && man.short_name && man.start_url && ['standalone', 'fullscreen'].includes(man.display), 'manifest temel alanları var');
  for (const sz of ['192x192', '512x512']) ok(man.icons.some(i => i.sizes === sz && i.type === 'image/png'), `manifest ${sz} PNG ikon içeriyor`);
  ok(man.icons.some(i => i.purpose === 'maskable'), 'maskable ikon var');
  for (const i of man.icons) ok(fs.existsSync(path.join(root, i.src)), `ikon dosyası var: ${i.src}`);

  // hizmet çalışanı + kurulabilirlik
  await p.waitForFunction(() => navigator.serviceWorker.getRegistration().then(r => r && r.active), null, { timeout: 8000 });
  await p.reload(); await p.waitForTimeout(500);
  ok(await p.evaluate(() => !!navigator.serviceWorker.controller), 'hizmet çalışanı sayfayı denetliyor');
  const cdp = await ctx.newCDPSession(p);
  const inst = await cdp.send('Page.getInstallabilityErrors');
  ok(inst.installabilityErrors.length === 0, 'Chromium kurulabilirlik hatası yok' + (inst.installabilityErrors.length ? ': ' + JSON.stringify(inst.installabilityErrors) : ''));

  // internetsiz açılış
  await ctx.setOffline(true);
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(500);
  ok(await p.isVisible('#menu') && (await p.locator('.level').count()) === 6, 'internet yokken menü açılıyor');
  await p.tap('.level:nth-child(1)'); await p.waitForTimeout(1500);
  ok((await p.evaluate(() => window.__game().game.t)) > 0.5, 'internet yokken oyun çalışıyor');
  await ctx.setOffline(false);

  // yerleşim: dikey ve yatay, hiçbir kontrol çakışmasın ve ekran dışına taşmasın
  for (const [w, h, name] of [[390, 780, 'dikey'], [780, 390, 'yatay'], [360, 640, 'küçük dikey'], [844, 390, 'geniş yatay']]) {
    await p.setViewportSize({ width: w, height: h }); await p.waitForTimeout(400);
    await p.evaluate(() => document.getElementById('restart').click());
    await p.tap('.level:nth-child(1)'); await p.waitForTimeout(300);
    await p.evaluate(() => { const { game, ui } = window.__game(); game.units.filter(u => u.team === 0).forEach(u => ui.selected.add(u.id)); }); await p.waitForTimeout(200);
    const boxes = await p.evaluate(() => {
      const r = id => { const el = document.getElementById(id); if (!el || el.hidden) return null; const b = el.getBoundingClientRect(); return { x: b.x, y: b.y, width: b.width, height: b.height }; };
      const { cam } = window.__game(); const mw = Math.min(190, cam.w * 0.32);
      return { hud: r('hud'), menubtn: r('menubtn'), tut: r('tut'), sel: r('sel'), prod: r('prod'), skills: r('skills'), seed: r('seed'), mini: { x: cam.w - mw - 10, y: cam.h - mw / 2 - 10, width: mw, height: mw / 2 }, w: cam.w, h: cam.h };
    });
    const list = Object.entries(boxes).filter(([k, v]) => v && typeof v === 'object');
    for (const [k, v] of list) ok(v.x >= -1 && v.y >= -1 && v.x + v.width <= boxes.w + 1 && v.y + v.height <= boxes.h + 1, `${name} ${w}x${h}: ${k} ekran içinde`);
    const names = list.map(([k]) => k);
    for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) {
      if (names[i] === 'tut' && names[j] === 'menubtn' || names[i] === 'menubtn' && names[j] === 'tut') continue; // bant mute'un solunda biter
      ok(!inter(boxes[names[i]], boxes[names[j]]), `${name}: ${names[i]} ile ${names[j]} çakışmıyor`);
    }
  }
  ok(errs.length === 0, 'konsol hatası yok' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await browser.close(); server.close();
  console.log('pwa testi tamam');
})().catch(e => { console.error(e.message); process.exit(1); });
