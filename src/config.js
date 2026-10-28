// Tüm denge değerleri tek yerde; oyun hissi buradan ayarlanır.
export const CFG = {
  mapSize: 24,
  teams: [
    { name: 'Mor', color: '#b400b4' },
    { name: 'Gri', color: '#555b61' },
    { name: 'Sarı', color: '#d9a400' },
    { name: 'Yeşil', color: '#2a9d3a' },
  ],
  // Birim türleri: piyon > okçu > zırhlı > piyon (taş-kağıt-makas)
  types: {
    piyon: { label: 'Piyon', hp: 100, dmg: 10, cooldown: 0.8, range: 1.1, speed: 2.2, cost: 1, beats: 'okcu' },
    okcu:  { label: 'Okçu',  hp: 60,  dmg: 9,  cooldown: 1.0, range: 3.2, speed: 2.0, cost: 1.2, beats: 'zirh' },
    zirh:  { label: 'Zırhlı', hp: 140, dmg: 7,  cooldown: 0.9, range: 1.1, speed: 1.6, cost: 1.5, beats: 'piyon' },
  },
  counter: { advantage: 1.5, disadvantage: 0.75 },
  sight: 4,
  capture: { radius: 0.9, seconds: 2.5 },
  // Nokta türleri
  //  ekonomi: üretim hızı/kapasite/güç buff'ı (hepsi bunu sağlar)
  //  demirci: ek buff sağlar (2 nokta gibi sayılır)
  //  kule: yakındaki düşmana ateş eder
  tower: { range: 4.5, dmg: 8, cooldown: 1.2 },
  economy: {
    spawnBase: 6, spawnPerPoint: 0.6, spawnMin: 1.5, // saniye
    capBase: 6, capPerPoint: 3,
    buffPerPoint: 0.05, // sahip olunan her ek nokta için hp/hasar çarpanı
  },
};
