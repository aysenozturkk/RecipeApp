# RecipeAgent · Tarif Defterim

Ücretsiz kişisel tarif defteri ve ileride dolap asistanı. Windows'ta geliştirilen, iPhone ekranına uygun Next.js / TypeScript PWA.

## Durum — 29 Eylül 2026

İlk yerel uygulama yazıldı ve üretim derlemesi alındı. Canlı yayın, hesap/eşitleme ve dolap entegrasyonu henüz yok. Referans uygulama kullanıcının doğruladığı [Recipe Box – Recipy](https://recipyai.app/).

- [RECIPY-INCELEME.md](RECIPY-INCELEME.md): resmî kaynaklara dayalı özellik envanteri, ürün ayrımları, ücretsiz uygulanabilirlik ve kabul ölçütleri.
- [PLAN.md](PLAN.md): mimari, ücretsiz kotalar, Windows/iPhone ve dolap asistanı yol haritası.

## Bu sürümde

- Tarif oluşturma/düzenleme/silme; kaynak bağlantısı, malzemeler, adımlar, süre ve kişi sayısı.
- Metni başlıklara göre düzenlenebilir taslağa ayırma; eksik adım üretmez.
- Ekran görüntüsünden Türkçe/İngilizce OCR. İlk çalıştırmada ücretsiz motor/dil dosyaları indirilir; fotoğraf tarayıcıda işlenir. Okunan metin kayıttan önce kullanıcı tarafından doğrulanır.
- Tarihli kişisel notlar; koleksiyonlar, favoriler ve başlık/malzeme/not araması.
- Tarif başına sekiz görsel; boyut küçültme, kapak seçimi, görsel kaldırma. JPEG/PNG/WebP; HEIC için dönüştürülmüş dosya gerekir.
- Son 20 metin sürümünü saklama ve geri yükleme; mevcut not ve görseller korunur.
- IndexedDB kalıcılığı; not ve görseller dahil JSON yedek indirme/yükleme. Yedek yüklemede aynı kimlikli kayıtlar değiştirilmez. Tek yükleme sınırı 50 MB; büyük arşivlerde parçalı yedek henüz yok.
- Yerel önizleme sunucusunda açık HTTPS sitelerinden Recipe JSON-LD içe aktarma; sayfadaki birden fazla tarif için seçim. Görseller otomatik indirilmez.
- Instagram gönderi/Reels bağlantılarındaki erişilebilir açıklamalar yerel sunucuda okunur. Malzemeler ve adımlar taslağa ayrılır; ham açıklama korunur. İzleme parametreleri temizlenir. Giriş gerektiren veya engellenen içerik için metin/ekran görüntüsü gerekir; video transkripsiyonu, oturum çerezi kullanımı ve ücretli API yok.
- Kullanıcının `https://www.instagram.com/p/DUNbd2RDP2P/` bağlantısı üzerinde Orman Meyveli Crumble Kek açıklaması doğrulandı: 10 miktarlı malzeme, bir alt başlık ve 8 hazırlama adımı. Açıklamada miktarı yazılmayan orman meyveleri için miktar uydurulmaz; kaynak metin kontrol edilmelidir.
- Statik çıktıda çevrimdışı arayüz için service worker üretilir. OCR'nin ilk indirmesi internet gerektirir. Çevrimdışı gerçek cihaz doğrulaması henüz tamamlanmadı.

## Çalıştırma

Node.js 24 ve pnpm 11 kullanıldı. `pnpm-lock.yaml` bağımlılıkları sabitler. İlk kurulum ve OCR motorunun ilk yüklemesi internet ister; abonelik/API anahtarı gerekmez.

```powershell
pnpm install
pnpm test
pnpm build
pnpm preview
```

Ardından http://127.0.0.1:3000 adresini açın. `preview`, hem statik uygulamayı hem yerel URL içe aktarma adaptörünü çalıştırır; yalnızca bu bilgisayarın loopback adresinde dinler.

Arayüz geliştirme için `pnpm dev` kullanılabilir. Bu komut yerel URL içe aktarma adaptörünü başlatmaz; bu özelliği test etmek için `build` + `preview` kullanın. İki sunucuyu aynı anda aynı portta çalıştırmayın.

Bu oturumda kullanılan pnpm yolu:

```powershell
& 'C:/Users/ALIENWARE/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/fallback/pnpm.cmd' build
& 'C:/Users/ALIENWARE/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/fallback/pnpm.cmd' preview
```

`tesseract.js` bağış mesajı postinstall betiği bilinçli olarak kapalıdır; OCR çalışma kodu etkilenmez.

## Yayın sınırı

`out/` statik dağıtım çıktısıdır. Ücretsiz HTTPS barındırmasına yüklenebilir; bu oturumda yüklenmedi. iPhone'daki `127.0.0.1`, Windows bilgisayar anlamına gelmez. Telefon kullanımı için HTTPS yayın adresi gerekir.

Yerel `/api/import` sunucusu Node.js içindir; statik yayınla birlikte çalışmaz. Canlı URL çözümleme için ücretsiz Worker adaptörü ve kimlik doğrulama/kota kurulumu hâlâ gerekiyor. Bağlantı servisi bulunmadığında uygulama bunu açıklar; elle metin/görsel girişi çalışır.

Kayıtlar şimdilik tarayıcıya özeldir; Windows/iPhone arasında otomatik eşitleme yoktur. Tarayıcı verileri silinirse yedeksiz kayıtlar kaybolabilir. Fotoğraf depolaması sınırsız değildir. iOS Paylaş menüsünden doğrudan PWA'ya alma ve App Store dağıtımı bu sürümde yoktur.

## Doğrulama

- TypeScript kontrolü ve Next.js statik üretim derlemesi başarılı.
- 17 çekirdek test geçti: mevcut tarif/yedek/ağ testleri ve Instagram URL doğrulama, gönderi eşleştirme, açıklama ayırma, giriş ekranı reddi, kesilmiş önizleme uyarısı ve karışık malzeme/adım düzeni testleri.
- Nefis Yemek Tarifleri'nin Fırında Közlenmiş Domates Çorbası bağlantısındaki HTML microdata biçimi destekleniyor; 15 malzeme ve 14 adım çıkarıldığı doğrulandı. Yorum/yazar verilerinin tarife karışmaması için regresyon testi eklendi.
- Uygulama tarayıcısında metinden tarif kaydetme, not ekleme, yenileme sonrası kayıt/not kalıcılığı doğrulandı.
- Oluşturulmuş bir tarif ekran görüntüsü gerçek OCR motoruyla okundu; `1/2` dahil metin alanlara ayrılıp kaydedildi.
- 390 px genişlikte detay ekranı görsel olarak kontrol edildi; yatay taşma yok.
- Yerel içe aktarma API'sinin loopback hedefini reddettiği doğrulandı. Yemek.com'un kabak graten sayfası sandbox dışında okunabildi; başlık ve sekiz adım çıkarıldı. Sayfanın iç içe malzeme dizisi desteği bu kontrol sonrası eklendi ve regresyon testiyle doğrulandı. Tüm tarif siteleri için uyumluluk garantisi yok.
- Sandbox içindeki sunucuda dış DNS erişimi zaman aşımına uğradı; önizleme ağ erişimiyle yeniden başlatıldı. Sonraki kullanımlarda normal Windows terminalinden `pnpm preview` çalıştırılabilir.
- Gerçek iPhone, fotoğraf/yedek dosyası yükleme turu, çevrimdışı kurulum, her sosyal platform ve hesaplar arası izolasyon henüz doğrulanmadı.

Tarayıcıda bırakılan “Deneme” ve “OCR denemesi” kayıtları yalnızca işlev testi içindir; gözden geçirilmiş yemek tarifi değildir.

## Sıradaki işler

1. iPhone ve tam görsel/yedek/çevrimdışı testleri; medya depolamasını büyük arşivlere hazırlama.
2. Ücretsiz HTTPS yayın ve kotalı Worker URL servisi.
3. Dolap/alışveriş eşleştirmesi, porsiyon ölçekleme, pişirme modu ve haftalık plan.
4. Supabase Free hesap/eşitleme, paylaşım köprüsü ve yerel görsel model denemesi.

## Arayüz iyileştirmeleri (29 Eylül 2026)
- Bağlantı, metin, ekran görüntüsü ve elle düzenleme için ayrı giriş yolları.
- İçe aktarma sonuçlarında malzeme/adım sayısı ve taslak önizlemesi.
- Mobil tam ekran düzenleyici, sabit başlık/kaydet alanı ve büyük dokunma hedefleri.
- Güncelleme tarihi veya Türkçe tarif adına göre sıralama; arama için temizlenebilir filtreler.
- Boş favoriler ve sonuçsuz arama için ayrı yönlendirmeler.
- Değiştirilmemiş düzenleyici kapanırken gereksiz uyarı kaldırıldı; kaydedilmemiş notla gezinme korunur.
- Mevcut tarifler, notlar ve yedek biçimi korunur; yeni ücretli bağımlılık yok.
