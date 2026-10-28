import { ownedCount } from './sim.js';

// Rehberli öğretici: her adım bir koşul tamamlanınca ilerler. Metinler kısa tutulur (mobil ekran).
export function createTutorial(game, cam, ui) {
  const start = { x: cam.x, y: cam.y, zoom: cam.zoom };
  const steps = [
    { text: 'Bir birime dokun ya da "Hepsi" düğmesine bas. Seçili birimlerin altında beyaz halka görünür.', done: () => ui.selected.size > 0 },
    { text: 'Şimdi haritada bir ♥ ya da ♠ noktasına dokun. Seçili birimler oraya yürür.', done: () => game.units.some(u => u.team === 0 && u.tx !== null) },
    { text: 'Birimler bir noktada beklerse orayı ele geçirir. Daha çok nokta = daha hızlı üretim, daha çok kapasite, daha güçlü birim. Bir nokta ele geçir.', done: () => ownedCount(game, 0) >= 2 },
    { text: 'Üretilecek türü soldaki ⚔️ 🏹 🛡️ düğmeleriyle seç. Piyon okçuyu, okçu zırhlıyı, zırhlı piyonu yener. Birini değiştir.', done: () => game.teams[0].prod !== 'piyon' },
    { text: 'Haritayı parmakla sürükleyerek kaydır, iki parmakla yakınlaştır. Köşedeki mini haritaya dokunarak da gidebilirsin.', done: () => Math.hypot(cam.x - start.x, cam.y - start.y) > 120 || Math.abs(cam.zoom - start.zoom) > 0.15 },
    { text: 'Birimleri seç, sağdaki "1" düğmesine dokun: seçim gruba kaydolur. Sonra tek dokunuşla geri çağırırsın. ✋ Dur mevzi tutturur; ⚔️/🏃 kipi koşarken savaşıp savaşmayacaklarını belirler.', done: () => ui.groups.some(g => g.length > 0) },
    { text: 'Koyu alan keşfedilmemiş, soluk alan şu an görünmüyor; düşmanı ancak gördüğünde bilirsin. Rakibin ana noktasını (köşedeki büyük kare) ele geçirirsen kazanırsın. Başarılar!', done: null },
  ];
  let i = 0, doneAt = 0;
  return {
    get index() { return i; },
    get total() { return steps.length; },
    get step() { return steps[i]; },
    finished() { return i >= steps.length; },
    skip() { i = steps.length; },
    next() { i++; doneAt = 0; },
    update(now) {
      const s = steps[i]; if (!s || !s.done) return;
      if (s.done()) { if (!doneAt) doneAt = now; else if (now - doneAt > 900) this.next(); } else doneAt = 0;
    },
  };
}
