# Proje Planı — TONTON GAMES (izometrik strateji, tarayıcı, mobil öncelikli)

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
  - Nokta türleri: ekonomi (köy), demirci (buff için 2 nokta sayılır), kule (yakın düşmana ateş eder). Amblemler işlevine göre: köy 🏠, örs, nişangâh, ana üs için kale.
  - Yapay zeka, en kalabalık düşman türünü yenen türü üretir.
  - Test: türlerin 1'e 1 düello sonuçları ve kule hasarı `npm test` içinde.

- **Aşama 2b — Sis ve görüş (`src/vision.js`):** her birimin görüş menzili türe bağlı (okçu 6, piyon 5, zırhlı 4), sahip olunan noktalar 5, ana nokta 7 kare görüyor. Üç durum: keşfedilmemiş (koyu), görülmüş ama şu an görünmeyen (yarı soluk, noktalar son bilinen sahibiyle çizilir), görünen. Sisteki düşman birimleri, vuruş efektleri ve sesleri oyuncuya sızmaz. Mini harita da aynı sisi uygular. `CFG.fog.enabled` ile kapatılabilir.
  - Bilinen sınır: yapay zeka takımları sisten etkilenmiyor (tüm haritayı görüyor). Zorluk seviyeleri aşamasında kendi görüşleriyle sınırlanacak.

- **Aşama 3 — Komutlar (düğmeleri sonradan harekete çevrildi, aşağıdaki "Dokunmatik-öncelikli kontrol" maddesine bak):**
  - Kipler (önceden sağdaki buton, şimdi dokun=saldır / basılı tut=koş): **⚔️ Saldır** (varsayılan; yolda gördüğü düşmanı kovalar, sonra yoluna devam eder) ve **🏃 Yürü** (düşmanı yok sayıp koşar, geri çekilme için).
  - **✋ Dur:** hedefi iptal eder, mevzi tutar (yalnızca menzildeki düşmana vurur, kovalamaz).
  - **Gruplar 1-3:** yalnızca klavye kısayoluyla (Ctrl+1-3 kaydet, 1-3 seç); düğmeler kaldırıldı.
  - **Çift dokunma:** bir birime iki kez dokununca ekrandaki aynı türden tüm birimler seçilir.
  - Masaüstü bonusu (isteğe bağlı): 1-3 seç, Ctrl+1-3 kaydet, S dur, Esc seçimi bırak, ok tuşları kaydır, sağ tuşla sürükle kaydır.

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

- **Dokunmatik-öncelikli kontrol (kullanıcı geri bildirimi: "çok tuş, modern değil"):** sürekli görünen düğme sayısı 12'den 4'e indi (3 üretim kartı + ses); ✋ Dur ve ✕ yalnızca seçim varken beliriyor. Hareketler (`src/input.js`):
  - birime dokun = seçime ekle/çıkar; çift dokun = ekrandaki aynı tür; üsse dokun (seçim yokken) = hepsi
  - boş yerde sürükle = çerçeveyle seç; **iki parmak** = kaydır + yakınlaştır (tek parmakla kaydırma bilerek kaldırıldı)
  - birimden sürükle ve bırak = ok çizer gibi gönder (seç + gönder tek hareket)
  - seçiliyken boşa dokun = saldır; boşa **basılı tut** = savaşmadan koş (geri çekilme)
  - görsel geri bildirim: hedef halkası, kesik çizgi yol, ok; saldır sarı, koş mavi
  - kaldırılanlar: Hepsi, İptal/Bırak, Üs, Kutu, Saldır/Yürü kipi, grup düğmeleri (klavye kısayolları 1-3, S, Esc duruyor)
  - Bilinen bedel: tek parmakla kaydırma yok. Harita küçük olduğu için sorun olmaması bekleniyor, cihazda doğrulanmadı.

- **Seçim ve nokta görünümü (kullanıcı isteği):**
  - Nokta üstündeki ele geçirme barı kaldırıldı. Tarafsız nokta **silik gri**, ele geçirilince **takımın rengi** (beyaz sembol); ele geçirme sürerken karo rengi gri→takım rengi yavaşça geçiş yapar. Piksel ölçümüyle test edildi.
  - **Emirden sonra seçim kendiliğinden bırakılır** (saldır, ok ile gönder, basılı tutup koş). Başka birine dokununca önceki emir bozulmaz. Tüm kendi birimlerinin yolu (kesik çizgi + hedef) seçili olmasa da görünür.
  - **İki parmakla tek sefer dokunma = iptal** (zamanlama gerektirmez): seçim varsa bırakır, yoksa son emri (5 sn içinde) geri alır. Kayma/yakınlaşma olmayan, 350 ms'den kısa iki parmak dokunuşu sayılır; kaydırma/yakınlaştırma ile karışmaz.
  - **Boşa çift dokunma (tek parmak, art arda iki kez) = emri geri al + seçimi bırak** (yanlış seçildiyse). İlk dokunuş emri verir ve önceki durumu saklar, ikincisi (600 ms, 90 px içinde) eski durumu geri yükler ve "Emir geri alındı" mesajı gösterir. (İlk sürümde pencere 320 ms idi; gerçek iPhone denemesinde çift dokunma çoğu zaman daha yavaş çıktığı için genişletildi.)
  - ✋ Dur artık seçimle çalıştığı için, durdurmak istenen birimler önce seçilir (üsse dokun = hepsi).

## Gelecek gereksinim: 4 kişilik çevrimiçi oyun (şimdilik yapılmıyor, taslak aşama)
Kullanıcı isteği: 3 arkadaşla (toplam 4 kişi), **farklı ağlardan**, linkle bağlanıp oynayabilmek. Oyun henüz taslak olduğu için şimdi yapılmıyor; ileride sorun yaşamamak için kararlar ve kod kuralları burada.

**Seçilen yaklaşım (henüz kodlanmadı):**
- **Kurucu otoriter (host-authoritative):** oyun bir oyuncunun cihazında çalışır, diğerleri yalnızca komut gönderir ve durum görüntüsü (snapshot, ~8-10 Hz) alır. Cihazlar arası aynı sonucu üretme (deterministik) garantisi aranmaz; JS motorları arasında `Math.cos/hypot` sonuçları birebir aynı olmayabilir (iPhone WebKit ↔ Android/PC V8), bu yüzden "herkes kendi simülasyonunu çalıştırsın" yaklaşımı **seçilmedi**.
- **Bağlantı:** WebRTC (PeerJS bulut sinyali + herkese açık STUN), oda kodu/link ile katılım. Ücretsiz, hesap gerektirmez. Boş köşelere yapay zeka oturur. Mod: herkes herkese karşı (ittifak yok).
- **Sis sunucu tarafında uygulanır:** her misafire yalnızca kendi görüşündeki düşman birimler gönderilir (hem bant genişliğini azaltır hem harita hilesini önler).
- İstemci, iki snapshot arasını yumuşatarak (interpolasyon) çizer. Misafirin komutları (`move`, `stop`, `prod`, geri alma) kurucuda **sahiplik doğrulamasıyla** uygulanır.

**Bilinen riskler:** (1) Farklı ağlarda doğrudan bağlantı (NAT) bazı mobil operatörlerde kurulamayabilir; garanti için TURN/aktarma sunucusu gerekir (ücretli ya da ayrı hesap). (2) Kurucu çıkar ya da iPhone'da uygulama arka plana atılırsa oyun herkes için durur. (3) Bu geliştirme ortamında `0.peerjs.com` ve STUN sunucularına erişim yok; sinyal/bağlantı burada test edilemez, yerel sinyal sunucusu ve cihazlarda deneme gerekir.

**Şimdiden uyulacak kod kuralları (ileride iş azalsın):**
- Mantık (`sim.js`) saf kalsın; çizim ve girdiden bağımsız. Yeni oyun kuralları yalnızca `sim.js`'e.
- **Yeni kodda "oyuncu = 0 numaralı takım" varsayımı kullanma**; `myTeam` gibi bir değişken geçir. Şu an bu varsayım şu dosyalarda sabit ve çok oyunculu için `myTeam`e çevrilecek: `src/main.js` (HUD, görüş, bitiş), `src/input.js` (dokunma hedefi, üs seçimi), `src/iso.js` (yol çizgileri, mini harita rengi), `src/tutorial.js`, `src/sim.js` (`eliminate` içindeki "0 elenince kayıp" kuralı; çok oyunculuda kazanan takım numarası döndürülmeli, kayıp/kazanç arayüzde `myTeam`e göre belirlenmeli) ve e2e testleri.
- Komutlar tek bir yerden geçsin (şu an `commandMove`/`commandStop` doğrudan çağrılıyor); ileride ağ üzerinden gönderilecek bir "komut" arayüzüne çevrilecek.
- Simülasyon dışında rastgelelik (`Math.random`) yalnızca yapay zekada kalsın (yalnızca kurucu çalıştırır).

- **Özel yetenekler (kullanıcı isteği, 3 adet):** her takımın üçü de var, alan etkili, bekleme süreli (başlangıçta 15 sn beklenir). Değerler `CFG.skills`.
  - 💚 **Şifa:** alandaki dost birliklere en yüksek canlarının %30'unu basar (yarıçap 3,2; bekleme 45 sn).
  - ☄️ **Ok Yağmuru:** alandaki düşman birliklere 45 hasar (yarıçap 2,6; bekleme 35 sn).
  - ⚡ **Hız:** alandaki dostlar 6 sn %60 hızlı koşar ve %50 hızlı vurur (yarıçap 3,4; bekleme 40 sn).
  - Kullanım (`src/input.js`, `src/main.js`): sağdaki yuvarlak düğmeye dokun, haritada parmağı bas (alan parmağın 44 px üstünde görünür), sürükleyip ayarla, bırakınca kullan. İki parmakla dokunma hedeflemeyi iptal eder. Düğmede soğuma çemberi ve kalan saniye görünür. Masaüstü: Q/W/E.
  - Yapay zeka da kullanır: kolay hiç, normal Şifa + Ok Yağmuru, zor üçünü (eşikler `DIFFICULTY[..].skills`). Zorluk sıralaması yeteneklerle yeniden ölçüldü ve korundu (6 oyun/koltuk: zor 6,8 / normal 2,3 klasik; zor 6,7 / normal 3,4 rastgele; normal 6,5 / kolay 2,2 klasik).
  - Efektler (yayılan dolgulu elips, ✚ parçacıkları, düşen oklar, hız çizgileri) ve sesler eklendi. Sim olayı: `skill`.
- **Giriş ekranı yenilendi:** logo ve degrade başlık, hareketli izometrik desenli arka plan, cam efektli seviye kartları (numara/✓/🔒 rozeti, zorluk ve rakip sayısı etiketi), seçim çipleri (emojili), parlayan BAŞLA düğmesi, bitiş ekranında 🏆/💥. `prefers-reduced-motion` desteklenir.

- **Amblem okunurluğu ve anlamı (iPhone geri bildirimi):** noktalardaki ♥ ♠ ♦ ♣ iskambil karakterleri oyunla ilgisizdi ve (metin karakteri oldukları için) iPhone'da iPhone'da emoji gibi çizilip rengini kaybedebildiği için mor zeminde zor görünüyordu. Artık işlevine uygun vektör amblemler çiziliyor (`emblemPath`/`drawEmblem`, `src/iso.js`): **köy** (ekonomi), **örs** (demirci), **nişangâh** (kule), **kale** (ana üs): ele geçirilmiş noktada **beyaz + koyu ince kenarlık**, tarafsızda silik gri. Kule amblemi kule gövdesinin üstünde. Piksel ölçümüyle test edildi.

- **Üretim, menü ve geri çekilme (kullanıcı isteği):**
  - **Üretim kartı ilerlemesi:** seçili üretim kartında sıradaki birime kalan süre dolan yeşil çember ve "n sn" olarak görünür; kapasite dolunca "Dolu". Diğer kartlar adını gösterir. (`spawnProgress` in `sim.js`)
  - **Sağ üstte ☰ menü** (ses düğmesinin yerine): oyunu duraklatır; ▶ Devam, ses aç/kapat (tercih saklanır), 🔄 Yeniden başla, 🏠 Ana menü. Başka uygulamaya geçince otomatik duraklar (iPhone). Esc masaüstünde açar/kapatır.
  - **↩ Geri çekil** (`commandRetreat`): seçili birimler savaşı bırakıp en yakın **kendi** noktasına (yoksa üsse) savaşmadan koşar, varınca mevzi tutar (kovalamaz); yeni emir bekleme durumunu bozar. Seçim varken **üsse dokunmak** da aynı komut. Seçim bırakılır; iki parmak dokunuşu geri alabilir.
  - Tasarım kararı: normal dokunuş **saldır-hareket** olarak kaldı (savaştaki birim emri alsa da dövüşür, bilinçli). Savaştan kaçmak için ↩ Çekil / üsse dokunma / boşa basılı tutma kullanılır. Bu, kuralların öngörülebilir kalmasını sağlıyor.
  - Bilinen bedel: kaçan birim sırtından vurulabilir (rakip daha hızlı ya da okçuysa); eşit hızlı rakip yakalayamaz. Yapay zeka geri çekilmeyi kullanmıyor (önceki denemede yapay zekayı zayıflatmıştı).

- **Oyun adı: TONTON GAMES** (sayfa başlığı, giriş ekranı, PWA adı/kısa adı, iOS ana ekran etiketi, Android uygulama adı). İç kimlikler bilerek değişmedi (Android paket kimliği `io.github.ges2005.strateji`, önbellek öneki, APK artifact adı): değişirse kurulu uygulamalar güncelleme olarak tanınmaz. **Not:** iPhone ana ekran etiketi simge eklenirken okunur; eski simge eski adı gösterir, yeni ad için silip yeniden eklemek gerekir.

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
