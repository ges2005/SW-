// Kampanya bölümleri ve hızlı oyun ayarları. Oyuncu her zaman 0 numaralı köşededir.
export const LEVELS = [
  { id: 'ogretici', ad: 'Öğretici', ipucu: 'Temelleri öğren', seed: 0, enemies: [2], diff: 'kolay', aiDelay: 150, tutorial: true },
  { id: 'b1', ad: 'İlk Çarpışma', ipucu: 'Tek rakip, yeni harita', seed: 11, enemies: [2], diff: 'kolay' },
  { id: 'b2', ad: 'İki Cephe', ipucu: 'İki yandan baskı', seed: 23, enemies: [1, 3], diff: 'kolay' },
  { id: 'b3', ad: 'Kale Avı', ipucu: 'Üç rakip', seed: 37, enemies: [1, 2, 3], diff: 'normal' },
  { id: 'b4', ad: 'Sisli Vadi', ipucu: 'Zor yapay zeka, iki rakip', seed: 42, enemies: [1, 3], diff: 'zor' },
  { id: 'b5', ad: 'Dört Köşe', ipucu: 'Son sınav', seed: 77, enemies: [1, 2, 3], diff: 'zor' },
];

// Hızlı oyun: rakip sayısına göre köşe yerleşimi (1 rakip karşı köşede, 2 rakip iki yanda)
export const ENEMY_SEATS = { 1: [2], 2: [1, 3], 3: [1, 2, 3] };

export function loadProgress() {
  try { return JSON.parse(localStorage.getItem('sw-progress')) || { done: [] }; } catch { return { done: [] }; }
}
export function saveProgress(p) {
  try { localStorage.setItem('sw-progress', JSON.stringify(p)); } catch { /* kayıt yoksa sessiz */ }
}
export function isUnlocked(progress, idx) { return idx === 0 || progress.done.includes(LEVELS[idx - 1].id); }
