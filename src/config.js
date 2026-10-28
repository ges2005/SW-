// Tüm denge değerleri tek yerde; oyun hissi buradan ayarlanır.
export const CFG = {
  mapSize: 24,
  teams: [
    { name: 'Mor', color: '#b400b4' },
    { name: 'Gri', color: '#555b61' },
    { name: 'Sarı', color: '#d9a400' },
    { name: 'Yeşil', color: '#2a9d3a' },
  ],
  unit: { hp: 100, dmg: 10, cooldown: 0.8, range: 1.1, speed: 2.2, sight: 4 },
  capture: { radius: 0.9, seconds: 2.5 },
  economy: {
    spawnBase: 6, spawnPerPoint: 0.6, spawnMin: 1.5, // saniye
    capBase: 6, capPerPoint: 3,
    buffPerPoint: 0.05, // sahip olunan her ek nokta için hp/hasar çarpanı
  },
};
