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

- **Aşama 4 — Yapay zeka (`src/ai.js`):**
  - Açılışta zorluk menüsü (Kolay / Normal / Zor, seçim hatırlanır).
  - Yapay zeka **sisle sınırlı**: nokta konumlarını bilir ama sahibini ancak gördüğünde öğrenir, düşmanı yalnızca kendi görüşündeki kadar bilir.
  - Davranışlar: görülen düşmana karşı tür seçimi, savunma (yeterince güçlüyse tehdit eden düşmana gider), yakın tarafsız noktalara küçük ekiplerle genişleme, görülmemiş noktaya keşif birimi, birim toplanınca saldırı dalgası, ele geçirme sürerken birimleri başka işe çekmeme.
  - Zorluklar: Kolay yavaş düşünür, bazen hiçbir şey yapmaz (`lazy`), hedefi sık sık rastgele seçer (`sloppy`), savunma/keşif/karşı tür yok. Normal tam davranış seti. Zor daha sık düşünür (1 sn) ve daha küçük dalgalarla (4) erken baskı yapar. Hile (gizli bonus) yok.
  - **Ölçüm** (`node test/ai-balance.js zor,normal,zor,normal 8 600`, köşegen ikili düzen, 64 oyun): ortalama nokta zor 6.3 / normal 2.9; normal 6.0 / kolay 3.2; zor 5.5 / kolay 3.5. Sıralama zor > normal > kolay.
  - **Öğrenilenler:** (1) Zırhsız "geri çekilme" (Yürü kipiyle kaçış) birimleri arkadan öldürttüğü için yapay zekayı zayıflattı, kaldırıldı. (2) Ele geçirme 2.5 sn sürdüğü için birimleri hemen başka işe çekmek ağır bedel; (3) denge ölçümünde zorlukları köşegen ikili düzenle karşılaştırmak şart, yoksa zayıf komşusu olan taraf yanlış yüksek görünür.

- **Aşama 5 — İçerik:**
  - **Harita üretimi (`src/mapgen.js`):** seed'li rastgele harita. Bir sektör üretilip 4 köşeye 90° döndürüldüğü için her takım için birebir adil; her sektörde en az 1 demirci, 1 kule ve 2 ekonomi noktası, noktalar arası en az 2.8 kare. Seed 0 = klasik sabit harita. Aynı seed her zaman aynı haritayı verir ("Harita #123" etiketi). Testler: tekrarlanabilirlik, 4 köşenin eşitliği, sınırlar, türler.
  - **Takım sayısı:** 1, 2 veya 3 rakip; kullanılmayan köşe tarafsız noktaya dönüşür.
  - **Bölümler (`src/levels.js`):** Öğretici + 5 bölüm (rakip sayısı, zorluk ve harita artarak), kilit açma, ilerleme `localStorage`'da; bitişte "Sonraki bölüm".
  - **Hızlı oyun:** zorluk, rakip sayısı (1-3), rastgele/klasik harita seçimi.
  - **Öğretici (`src/tutorial.js`):** 7 adımlık rehber; her adım yapılınca otomatik ilerler (seçme, gönderme, ele geçirme, üretim türü, kamera, grup, sis ve amaç). "Atla" düğmesi var; öğretici bölümünde rakip ilk 150 saniye hareketsiz.
  - Bilinmeyen: rastgele haritalarda yapay zekanın dengesi ayrıca ölçülmedi (yalnızca çalıştığı test edildi).

- **Dengeleme ve geri dönüş (goal 2. madde):**
  - Zorluk sıralaması rastgele haritalarda da korunuyor (`RAND=1 node test/ai-balance.js ...`). 96 oyunluk örnekte zor normale göre +%42 (klasik) / +%49 (rastgele) nokta. Normal kolaya göre ise yalnızca 32 oyunluk örnekte ölçüldü (klasik 5.7 / 3.7, rastgele 8.0 / 2.0); bu daha gürültülü.
  - Kartopu ölçümü (`node test/snowball.js 100`): taban çizgide 120. saniyedeki lider sonda %91 önde, ortalama oyun 139 sn, oyunların yarısı 120 sn'ye varmadan bitiyor.
  - **Denenen 1:** üretim süresi lastik bandı (liderin %50 altındaki takım hızlanır): sonuç değişmedi (%94).
  - **Denenen 2:** güçlü lastik bant (%70 / x0.4): lider-kalma %55'e düştü ama zorluk sıralaması bozuldu (kolay, normali geçti) → **kaldırıldı**. Beceri farkı ile kartopu aynı şey; ikisini birden korumak için zayıf mekanik gerekir.
  - **Seçilen:** ana noktalar kule gibi ateş eder (`CFG.baseTower`). Erken elenmeyi zorlaştırıyor: 120 sn'ye ulaşan oyun 53'ten 72'ye, ortalama süre 139'dan 161 sn'ye çıktı. Lider-kalma oranı (%92) pek değişmedi; yani kartopu tamamen çözülmedi, yalnızca geri dönüş penceresi uzadı. Kalan iş: daha ince bir mekanik (örn. kuşatma bonusu, nokta kaybında kademeli kayıp).

- **Aşama 6 — Paketleme (goal 3-6. maddeler):**
  - **PWA:** manifest, 192/512/maskable ikonlar, çevrimdışı hizmet çalışanı, dikey ve yatay düzen. `npm run pwa`: Chromium kurulabilirlik denetimi hatasız, çevrimdışı açılış çalışıyor, 4 ekran boyutunda (390x780, 780x390, 360x640, 844x390) kontroller çakışmıyor ve ekran dışına taşmıyor. `/SW-/` alt yolunda (GitHub Pages) çevrimdışı çalıştığı ayrıca doğrulandı.
  - **Yayın:** `.github/workflows/pages.yml` (testler geçerse Pages'e yayın). Çalıştırılmadı; etkinleştirme adımları `docs/YAYIN-VE-MOBIL.md`.
  - **Android:** Capacitor 8 projesi (`android/`), özel simge ve açılış ekranı, tam ekran tema, `.github/workflows/android.yml` (debug APK). **Derleme doğrulanamadı:** bu ortamda Google Maven/SDK erişimi yok (`./gradlew tasks` → 403). İlk gerçek doğrulama GitHub Actions çalıştırmasıdır.
  - **iOS:** yapılmadı, gereksinimler `docs/YAYIN-VE-MOBIL.md` içinde.

- **iPhone geri bildirimi (ilk gerçek cihaz testi):**
  1. *Dokunulan yere gitmiyordu:* iki neden. (a) Tuval CSS'te `100vh`, çizim alanı `innerHeight` idi; iPhone Safari'de adres çubuğu açıkken ikisi farklı olduğu için tuval dikeyde esniyor, hedef ~3 kare kayıyordu (simülasyonla yeniden üretildi: hata 2.9 kare → 0). Çizim boyutu artık tuvalin gerçek boyutundan alınıyor, dokunma koordinatı ölçekle düzeltiliyor, yeniden boyutlanınca yakınlaştırma sıfırlanmıyor. (b) Birime dokunma testi gövdenin 18 px **altını** ölçüyordu (işaret hatası); gövdeye dokununca tanımıyordu. Düzeltildi, dokunma alanı da büyütüldü.
  2. *Seçimi bırakamıyordu:* "İptal" düğmesi "✕ Bırak" oldu ve seçim varken sarıya dönüyor; seçili birime tekrar dokunmak da seçimi kaldırıyor.
  3. *Çoklu seçim zordu:* yeni **▭ Kutu** kipi: açıkken tek parmakla sürükleyip çerçeve çizilir, birime dokunmak seçime ekler/çıkarır. İki parmakla hem yakınlaştırma hem kaydırma. Basılı tutma süresi 350→300 ms. Öğretici metni güncellendi.
  Testler: `test/e2e.cjs` bu üç senaryoyu (ölçü kayması, bırakma, kutu/ekleme) gerçek dokunma olaylarıyla sınıyor.

## Doğrulanmadı / açık işler
- Gerçek telefonda dokunma hissi, performans (çok birimli savaşlar), ses.
- Android APK derlemesi ve cihaza kurulumu; Pages yayını.
- Kartopu etkisi tam çözülmedi (lider-kalma ~%92); daha ince bir geri dönüş mekaniği gerekebilir.
- Rastgele haritalarda tür/nokta değerlerinin ayrıca dengelenmesi.

## Öneriler (hedef dışı)
- Yeni birim türleri, daha çok nokta türü, çok oyunculu mod, ses/müzik içeriği, kampanya hikayesi, başarımlar.

## Sıradaki aşamalar (eski liste)

6. **Paketleme:** PWA, sonra Capacitor ile mobil uygulama.
7. **Dengeleme:** kartopu etkisini sınırlayan geri dönüş mekanikleri; tür ve nokta değerlerinin oyun testiyle ayarı.
