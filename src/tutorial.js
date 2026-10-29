import { ownedCount } from './sim.js';

// Rehberli öğretici: her adım bir koşul tamamlanınca ilerler. Metinler kısa tutulur (mobil ekran).
export function createTutorial(game, cam, ui) {
  const steps = [
    { text: 'Bir birime dokun: seçilir. Art arda dokunarak ekleyebilir, ya da boş yerde parmağını sürükleyip çerçeveyle birçoğunu seçebilirsin. Üssüne dokunursan hepsi seçilir.', done: () => ui.selected.size > 0 },
    { text: 'Seçiliyken haritaya dokun: birimler oraya gider ve seçim kendiliğinden bırakılır. Hızlısı: bir birime dokunup parmağını sürükle ve bırak. Yanlış birimi seçtiysen iki parmakla tek sefer dokun: seçim bırakılır, gönderdiysen emir geri alınır.', done: () => game.units.some(u => u.team === 0 && u.tx !== null) },
    { text: 'Birimler bir noktada beklerse orayı ele geçirir. Daha çok nokta = daha hızlı üretim, daha çok kapasite, daha güçlü birim. Bir nokta ele geçir.', done: () => ownedCount(game, 0) >= 2 },
    { text: 'Üretilecek türü sol alttaki kartlardan seç: ⚔️ 🏹 🛡️. Piyon okçuyu, okçu zırhlıyı, zırhlı piyonu yener. Birini değiştir.', done: () => game.teams[0].prod !== 'piyon' },
    { text: 'Haritayı iki parmakla kaydır ve yakınlaştır. Köşedeki mini haritaya dokunarak da gidebilirsin.', done: () => ui.camMoved },
    { text: 'Seçiliyken boş bir yere basılı tut: birimler savaşmadan koşar (geri çekilme). ✋ Dur yerinde tutar, ✕ seçimi bırakır. Basılı tutmayı dene.', done: () => ui.usedRun },
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
