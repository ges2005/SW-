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
24x24 izometrik harita, 4 takım (köşelerde), 21 nokta (simetrik dizilim, 4 tür), noktada bekleyerek ele geçirme, nokta sayısına bağlı üretim hızı / kapasite / güç buff'ı, otomatik savaş, 3 yapay zeka takımı, mini harita, mobil girdi.
`npm start` ile http://localhost:8080 adresinde açılır. `npm test` mantık testini koşar.

**Geçici kararlar (değiştirilebilir):** ana noktası düşen takım elenir, kalan tek takım kazanır; buff her ek nokta için +%5 hp/hasar; üretim 6sn'den noktayla azalır (en az 1.5sn); kapasite 6 + 3/nokta.

## Tamamlanan aşamalar
- **Aşama 1 — Hissiyat:** yürüme sekmesi, vuruş atılması, kıvılcım, ölüm efekti, ele geçirme dalgası, üretim halkası, WebAudio sesleri (mobilde ilk dokunuşta açılır, ses düğmesi var). Efektler `src/fx.js`, sesler `src/audio.js`; mantık yalnızca olay (`events`) üretir.
- **Aşama 2 (kısmen) — Derinlik:**
  - Birim türleri: Piyon > Okçu > Zırhlı > Piyon (üstünlük x1.5, dezavantaj x0.75). Okçu menzilli (3.2), zırhlı yavaş ve dayanıklı, her tür farklı üretim maliyetinde. Üretilecek tür sol alttaki ⚔️ 🏹 🛡️ butonlarıyla seçilir.
  - Nokta türleri: ♥/♠ ekonomi, ♦ demirci (buff için 2 nokta sayılır), ♣ kule (yakın düşmana ateş eder).
  - Yapay zeka, en kalabalık düşman türünü yenen türü üretir.
  - Test: türlerin 1'e 1 düello sonuçları ve kule hasarı `npm test` içinde.

- **Aşama 2b — Sis ve görüş (`src/vision.js`):** her birimin görüş menzili türe bağlı (okçu 6, piyon 5, zırhlı 4), sahip olunan noktalar 5, ana nokta 7 kare görüyor. Üç durum: keşfedilmemiş (koyu), görülmüş ama şu an görünmeyen (yarı soluk, noktalar son bilinen sahibiyle çizilir), görünen. Sisteki düşman birimleri, vuruş efektleri ve sesleri oyuncuya sızmaz. Mini harita da aynı sisi uygular. `CFG.fog.enabled` ile kapatılabilir.
  - Bilinen sınır: yapay zeka takımları sisten etkilenmiyor (tüm haritayı görüyor). Zorluk seviyeleri aşamasında kendi görüşleriyle sınırlanacak.

- **Aşama 3 — Komutlar:**
  - Kipler (sağdaki buton): **⚔️ Saldır** (varsayılan; yolda gördüğü düşmanı kovalar, sonra yoluna devam eder) ve **🏃 Yürü** (düşmanı yok sayıp koşar, geri çekilme için).
  - **✋ Dur:** hedefi iptal eder, mevzi tutar (yalnızca menzildeki düşmana vurur, kovalamaz).
  - **Gruplar 1-3:** boş gruba dokun = seçimi kaydet, dolu gruba dokun = seç, basılı tut = üzerine yaz. Düğmede grup boyutu görünür.
  - **Çift dokunma:** bir birime iki kez dokununca ekrandaki aynı türden tüm birimler seçilir.
  - Masaüstü bonusu (isteğe bağlı): 1-3 seç, Ctrl+1-3 kaydet, S dur, A kip değiştir. Oyun yalnızca sol tıkla da tam oynanır.

## Sıradaki aşamalar
4. **Yapay zeka:** zorluk seviyeleri, savunma, geri çekilme, birimleri toplama.
5. **İçerik:** rastgele harita, bölümler/modlar, öğretici.
6. **Paketleme:** PWA, sonra Capacitor ile mobil uygulama.
7. **Dengeleme:** kartopu etkisini sınırlayan geri dönüş mekanikleri; tür ve nokta değerlerinin oyun testiyle ayarı.
