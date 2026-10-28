# Yayın ve mobil uygulama rehberi

Bu dosya, oyunu yayınlamak ve telefonda denemek için **senin yapman gereken adımları** anlatır. Hazırlık tamam; derleme ve yayın GitHub'da (Actions) çalışır.

## Durum özeti
| Parça | Durum |
|---|---|
| Web oyunu (tarayıcı) | Hazır. `npm start` → http://localhost:8080. Testler: `npm test`, `npm run e2e`, `npm run pwa` |
| PWA (ana ekrana ekle, internetsiz) | Hazır ve yerelde doğrulandı (Chromium kurulabilirlik denetimi, çevrimdışı açılış, alt yolda çalışma) |
| GitHub Pages yayını | İş akışı yazıldı (`.github/workflows/pages.yml`); **henüz çalıştırılmadı**, aşağıdaki adımlar gerekli |
| Android APK | Capacitor projesi ve iş akışı yazıldı (`.github/workflows/android.yml`); **derleme burada doğrulanamadı** (aşağıya bak) |
| iOS | Yapılmadı (Mac + Apple geliştirici hesabı gerekir) |

## 1) Web oyununu yayınlamak (GitHub Pages)
1. Çalışmayı `main` dalına al. İş akışı yalnızca `main`'e birleştirince tetiklenir. (Dal: `claude/hopeful-turing-tennx7`. Pull request'i sen aç ya da bana "PR aç" de.)
2. Repo > **Settings > Pages > Build and deployment > Source: "GitHub Actions"** seç.
3. `main`'e birleşince **Actions > "Web oyununu yayınla"** çalışır: önce testler (birim + tarayıcı), geçerse yayınlar. Adres: `https://<kullanıcı>.github.io/SW-/`
4. Telefonda aç: Android Chrome > menü > "Ana ekrana ekle / Uygulamayı yükle"; iPhone Safari > Paylaş > "Ana Ekrana Ekle". İlk açılıştan sonra internetsiz de çalışır.

Not: yayınlanan her sürümde hizmet çalışanı sürümü commit kimliğiyle damgalanır; oyun güncellenince oyuncu bir sonraki açılışta yeni sürümü alır.

## 2) Android APK
**Önemli:** Bu geliştirme ortamında Android SDK ve Google Maven'e erişim engelli (`dl.google.com` → 403), bu yüzden APK **burada derlenemedi ve doğrulanmadı**. Capacitor projesi (`android/`) üretildi, simgeler ve açılış ekranı değiştirildi, ama derlemenin başarılı olduğunu ancak GitHub'daki ilk çalıştırma gösterecek.

Adımlar:
1. Repo > **Actions > "Android APK derle" > Run workflow** (ya da `main`'e birleştirince kendiliğinden çalışır).
2. Bitince çalıştırma sayfasının altındaki **Artifacts > `strateji-debug-apk`** dosyasını indir (zip içinde `app-debug.apk`).
3. Telefonda: APK'yı aktar, aç, "bilinmeyen kaynaklardan yükleme" iznini ver, kur.
4. Derleme hata verirse hata günlüğünü bana yapıştır; ben düzeltirim.

Yerelde derlemek istersen (Android Studio kuruluyken):
```bash
npm ci
npm run android:sync
cd android && ./gradlew assembleDebug
```
APK: `android/app/build/outputs/apk/debug/app-debug.apk`

Mağazaya (Google Play) çıkmak için ayrıca bir **imza anahtarı** (keystore), Play Console hesabı ve release imzalı bir `bundleRelease` gerekir; bu hedefin dışında bırakıldı.

## 3) iOS
Yapılmadı. Gerekenler:
- Bir Mac ve Xcode.
- Ücretli Apple Developer hesabı (TestFlight veya cihaza kurmak için).
- `npx cap add ios` ile iOS projesi üretilip Xcode'da imzalanmalı.
Bunların hiçbiri bu ortamdan yapılamaz. Bu arada iPhone'da en kolay yol, yukarıdaki PWA'yı Safari'den "Ana Ekrana Ekle" ile kurmak.

## Sorun giderme
- **Pages iş akışı "environment protection" hatası verirse:** Settings > Environments > github-pages altında dal kuralının `main`'e izin verdiğini kontrol et.
- **Test işi tarayıcı kurulumunda takılırsa:** `npx playwright install --with-deps chromium` adımını yeniden çalıştır.
- **Eski sürüm görünüyorsa:** PWA önbelleği; sayfayı bir kez kapatıp aç (yeni hizmet çalışanı devreye girer).
