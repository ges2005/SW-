# Proje Planı — İzometrik Strateji (tarayıcı, mobil öncelikli)

Karar: izometrik görünüm, tarayıcıda çalışan web oyunu, her aşamada telefon düşünülür.
Bu oyun School Wars'ın kopyası değil; çekirdek mantığı (nokta ele geçirme → üretim/kapasite/buff → savaş) alıp çok daha gelişmiş bir oyuna dönüştürmek için bir temel.

## Mimari (katmanlar ayrı)
| Katman | Dosya | Görev |
|---|---|---|
| Denge değerleri | `src/config.js` | Tüm sayılar tek yerde |
| Oyun mantığı | `src/sim.js` | Saf mantık; çizim ve girdiden bağımsız, Node'da test edilir |
| Yapay zeka | `src/ai.js` | Takım karar verme |
| Çizim + izometrik dönüşüm | `src/iso.js` | Canvas; tıklama ve çizim aynı dönüşümü kullanır |
| Girdi | `src/input.js` | Pointer Events: dokunma ve fare aynı kod |
| Birleştirme | `src/main.js`, `index.html` | Döngü, HUD, butonlar |

Mantık ayrı olduğu için çizim/girdi değişse (başka kamera, yeni ekran) mantık bozulmaz. Uygulamaya çevirirken (Capacitor / Electron) aynı kod paketlenir.

## Mobil kuralları
- Tek parmak = tek sol tık: dokun→seç/gönder, sürükle→kaydır, basılı tut+sürükle→kutu seçimi, iki parmak→yakınlaştır.
- Dokunma hedefleri en az 48px; "Hepsi / İptal / Üs" butonları baş parmak bölgesinde (sol alt), mini harita sağ altta.
- `touch-action:none`, güvenli alan (çentik) boşlukları, `devicePixelRatio` desteği.
- Küçük ekranda başlangıç yakınlaştırması düşük; HUD tek satır.
- Her yeni özellik için kural: "parmakla nasıl yapılır?" sorusu cevaplanmadan eklenmez.

## Şu an çalışan (Aşama 1 prototip)
24x24 izometrik harita, 4 takım (köşelerde), 21 nokta (simetrik dizilim), noktada bekleyerek ele geçirme, nokta sayısına bağlı üretim hızı / kapasite / güç buff'ı, otomatik savaş, 3 yapay zeka takımı, mini harita, mobil girdi.
`npm start` ile http://localhost:8080 adresinde açılır. `npm test` mantık testini koşar.

**Geçici kararlar (değiştirilebilir):** ana noktası düşen takım elenir, kalan tek takım kazanır; buff her ek nokta için +%5 hp/hasar; üretim 6sn'den noktayla azalır (en az 1.5sn); kapasite 6 + 3/nokta.

## Sıradaki aşamalar
1. **Hissiyat:** saldırı/ölüm animasyonu, ses, ele geçirme efekti, yürüme animasyonu.
2. **Derinlik:** birim türleri ve karşıtlık, nokta türleri (üretim/savunma/kaynak), sis ve görüş.
3. **Komutlar:** birim grupları, saldırı-hareket ayrımı, durma komutu (mobilde buton, masaüstünde de sol tık).
4. **Yapay zeka:** zorluk seviyeleri, savunma, geri çekilme, birimleri toplama.
5. **İçerik:** rastgele harita, bölümler/modlar, öğretici.
6. **Paketleme:** PWA, sonra Capacitor ile mobil uygulama.
7. **Dengeleme:** kartopu etkisini sınırlayan geri dönüş mekanikleri.
