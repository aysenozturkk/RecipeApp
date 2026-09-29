# RecipeAgent — ücretsiz kullanım odaklı geliştirme planı

Güncelleme: 28 Eylül 2026. Tarif defterinin ilk yerel uygulaması geliştiriliyor; canlı yayın henüz yok.

## 28 Eylül kapsam güncellemesi

Referans, kullanıcının doğruladığı **recipyai.app / Recipe Box – Recipy**. Özellik envanteri, kaynaklar ve yeni kabul ölçütleri [RECIPY-INCELEME.md](RECIPY-INCELEME.md) dosyasında. Bu bölüm önceki aşama sırasının yerini alır; ücretsiz kullanım, Windows/iPhone ve dolap asistanı hedefleri korunur.

İlk öncelik kişisel tarif arşivi: kaynak bağlantısı, metin/ekran görüntüsü içe aktarma, düzenleme, tarihli notlar, çoklu görsel, koleksiyon, favori, arama, değişiklik geçmişi ve tam yedek. Ardından otomatik URL çözümleme ve dolap entegrasyonu gelir.

Yazılı tarif ekran görüntüsünü OCR ile okumak, yazısız yemek veya dolap fotoğrafını tanımaktan ayrıdır. OCR ücretsiz olarak tarayıcıda yapılacak; görsel model beklenmeyecek. PWA'nın başka sitelerin içeriğini doğrudan okuyamaması nedeniyle URL ayrıştırması için ayrıca ücretsiz, kotalı ve güvenli bir Worker planlandı. Bu servis kurulana kadar bağlantı yalnızca kaynak olarak saklanır.

Medya ilk yerel prototipte boyutu küçültülmüş JPEG data URL olarak IndexedDB'de tutuluyor; tam JSON yedeğe dahil. Büyük arşiv/eşitleme aşamasında Blob ve ayrı medya kayıtlarına taşınacak. Bu uygulama kararı aşağıdaki uzun vadeli veri modelini geçersiz kılmaz.

## 1. Amaç ve değişmez koşullar

Windows bilgisayarda geliştirilen, iPhone'da günlük kullanılan, evdeki malzemelerden kolay yemek öneren bir PWA. Önce tek kişi kullanacak; veri modeli daha sonra üyeliğe ve ortak ev kullanımına açılabilecek.

- Zorunlu abonelik, ücretli API, ücretli geliştirici üyeliği ve özel alan adı satın alımı yok.
- Süreli deneme kredisi kalıcı ücretsiz altyapı sayılmaz.
- Yalnızca ücretsiz hizmet planları kullanılacak; ücretli plana otomatik geçiş yapılandırılmayacak.
- Ücretsiz sınırlar dolduğunda işlem durur veya özellik kısıtlanır. Ücretli servise otomatik geçiş yapılmaz.
- Elektrik, mevcut internet ve cihaz giderleri bu sıfır servis ücreti hedefinden ayrıdır.
- Sınırsız üyeye ve sonsuz ücretsiz bulut kapasitesine dair garanti verilmez. Ücretsiz koşullar değişirse dışa aktarma ve taşıma yolu bulunur.
- Temel yemek önerisi, malzeme girişi ve alışveriş listesi bilgisayarın açık olmasına veya yapay zekâ servisine bağlı olmaz.

## 2. Mimari kararlar

| Alan | Karar | Gerekçe / sınır |
|---|---|---|
| Arayüz | React + TypeScript, Next.js statik dışa aktarma | Önceki teknoloji seçimi korunur; ilk sürümde Next.js sunucu işlemleri kullanılmaz. |
| Mobil kullanım | PWA, iPhone ana ekranına ekleme | App Store ve Apple geliştirici aboneliği gerekmez. |
| Barındırma | Cloudflare Workers Static Assets ücretsiz planı | Statik arayüz; varsayılan ücretsiz servis adresi. Dinamik Worker ilk sürümün zorunlu bağımlılığı değil. |
| Yerel veri | IndexedDB, sürümlü veri biçimi | Dolap, tarif geçmişi ve alışveriş listesi çevrimdışı erişilebilir. Tarayıcı verisi silinebileceği için dışa aktarma gerekir. |
| Hesap ve eşitleme | Supabase Free, ayrı veri erişim katmanı | PostgreSQL + Auth + RLS. Ücretsiz kota ve duraklatma sınırlamaları var. |
| Tarif motoru | Yerel, kurallı eşleştirme | Ücretli üretken yapay zekâ ve internet gerekmez. |
| Dikte | iPhone klavye diktesi → metin alanı | Uygulamaya ses API'si maliyeti eklemez. Dil/cihaz davranışı gerçek telefonda doğrulanır. |
| Fotoğraf analizi | Ayrı deneysel yerel model modülü | Çekirdek uygulamayı engellemez; donanım ve doğruluk testi yapılmadan hazır kabul edilmez. |
| Hatırlatma | İlk etapta uygulama içi günlük öneri; ücretsiz takvim dosyası dışa aktarma | Zamanında arka plan çalışmasına bağımlılık azaltılır. Web push ayrı aşamadır. |

Next.js statik çıktı içine API anahtarı veya sunucu sırrı konulmaz. Tarayıcıda sadece Supabase'in herkese açık istemci anahtarı kullanılabilir; erişim RLS ile denetlenir. Service-role anahtarı istemciye hiçbir zaman verilmez.

Vercel Hobby temel yayın seçimi olmaktan çıkarıldı: kişisel ve ticari olmayan kullanımla sınırlı olması ileride ürünleşmeye uygun bir varsayım değil. Cloudflare'ın güncel plan koşulları canlı kurulum sırasında yeniden kontrol edilecek.

## 3. Malzeme girişi ve stok doğruluğu

Metin ve dikte aynı akıştan geçer:

1. Kullanıcı “3 kabak, yarım paket peynir var; süt bitti” yazar veya klavyeden dikte eder.
2. Türkçe malzeme sözlüğü ve miktar kuralları taslak kayıt çıkarır.
3. Tanınmayan ifade sessizce atılmaz; düzeltme için gösterilir.
4. Kullanıcı yeni ekleme, mevcut miktarı değiştirme ve bitenleri onaylar.
5. Tek işlem kimliğiyle kaydedilir; tekrar gönderim iki kez stok artırmaz.

Durumlar: var, az kaldı, bitti, bilinmiyor. “Listede yok” otomatik olarak “evde yok” anlamına gelmez. Miktar isteğe bağlıdır; adet, gram, ml ve paket gibi birimler birbirine rastgele çevrilmez. “Yarım paket” için paket ağırlığı bilinmeden gram üretilmez.

İlk sürümde esnek Türkçe ifadelerin tümünün anlaşılacağı iddia edilmez. Yapılandırılmış manuel giriş her zaman kullanılabilir.

## 4. Tarif önerileri

- Küçük, uygulama için yazılmış ve gözden geçirilmiş tarif havuzu; izinsiz tarif sitesi kopyalama yok.
- Tariflerde kişi sayısı, süre, ekipman, malzeme miktarları ve adımlar bulunur.
- Önce beslenme kısıtları ve ekipman uygunluğu; sonra eldeki malzemeler, eksik sayısı, süre ve yakın zamanda pişirme geçmişi değerlendirilir.
- Sonuçlar: eldeki bilgilerle yapılabilir / miktarı veya varlığı doğrulanmalı / alışveriş gerekiyor.
- Tuz, yağ ve baharatlar kendiliğinden var sayılmaz; kullanıcı temel malzemelerini bir kez doğrulayabilir.
- Miktar bilinmiyorsa “kesin yeterli” sonucu gösterilmez.
- Eksikler kullanıcı onayıyla alışveriş listesine eklenir; aynı malzeme gereksiz yere yinelenmez.
- “Pişirdim” stok düşüm önerisi oluşturur; belirsiz miktarlar onaylanmadan otomatik tüketilmez.
- Son tüketim ve saklama bilgisi kullanıcının kaydıdır; görselden gıda güvenliği kararı verilmez.

## 5. Fotoğraf için ücretsiz yol

Fotoğraf gereksinimi korunuyor; ilk çekirdek sürümden sonra teknik deneme olarak ele alınacak.

1. Windows bilgisayarın RAM/GPU bilgisi ve uygun modelin lisansı incelenir; yeni donanım alımı varsayılmaz.
2. Yerelde çalışan bir görsel model küçük bir örnek fotoğraf kümesiyle denenir. Model indirmeden önce boyutu ve disk ihtiyacı açıklanır.
3. Başarı ölçütleri: görünür ürünleri makul şekilde tanıma, belirsizliği işaretleme, kabul edilebilir gecikme ve Türkçe onay listesi üretme.
4. Fotoğraf stok üzerinde doğrudan işlem yapmaz; kullanıcı taslağı onaylar. Görünmeyen malzemeler silinmez.
5. iPhone'dan yerel modele erişim için doğrulanmış HTTPS ve kimlik doğrulama gerekir. Modelin yerel portu internete açık bırakılmaz.
6. Bu kullanımda bilgisayarın açık ve erişilebilir olması gerekir. Bilgisayar kapalıyken metin/dikte ve tarif motoru çalışmaya devam eder.
7. Yerel model yetersizse özellik deneysel kalır; ücretli API ile sessizce değiştirilmez. Tarayıcı içi model ancak cihazda doğrulanırsa alternatif sayılır.

Fotoğraf ve ses dosyaları varsayılan olarak kalıcı bulut arşivine alınmaz. Fotoğraf analizi bulunmayan bir ekran, analiz yapıyormuş gibi sonuç üretmez.

## 6. Veri modeli ve üyeliğe hazırlık

Temel varlıklar: profiles, households, household_members, ingredients, pantry_items, stock_events, recipes, recipe_ingredients, shopping_items, cooking_history, preferences.

- Ev bazında veri sahipliği ilk günden bulunur; yerel kullanımda da aynı model kullanılır.
- Miktar ve birim nullable olabilir; bilinmeyen değerler sıfıra çevrilmez.
- Stok olayları geri almayı ve tekrar işlem kontrolünü destekler.
- Yerel kullanım ile bulut eşitleme ayrı repository adaptörleri üzerinden çalışır.
- İlk hesap oluşturulurken yerel veriler açık bir aktarım adımıyla yüklenir; tekrar aktarım yinelenmez.
- Sunucu RLS politikaları üye olunan ev dışındaki veriye erişimi engeller; iki ayrı test hesabıyla doğrulanır.
- Eşitleme aşamasında cihaz kimliği, işlem kimliği ve kayıt sürümü kullanılır. Çelişen miktar değişiklikleri sessizce ezilmez.
- Hesap kapatma/çıkış sırasında cihaz önbelleği temizlenir; sonraki kullanıcı önceki kullanıcının dolabını göremez.
- Üyelik açılışında ücretsiz OAuth sağlayıcısı değerlendirilir; üretim kullanımı Supabase'in sınırlı varsayılan e-posta gönderimine bağımlı kurulmaz.

## 7. Çevrimdışı çalışma ve veri koruma

- PWA arayüzü ve tarif havuzu önbelleklenir.
- İlk sürümde tek cihazda yerel ekleme/düzenleme ve alışveriş işaretleme çalışır.
- Bulut eşitleme gelene kadar Windows ile iPhone verilerinin otomatik ortak olmadığı açıkça gösterilir.
- JSON dışa/içe aktarma ve veri biçimi doğrulaması ilk sürüme dahildir.
- Tarayıcı depolaması tek yedek sayılmaz. Düzenli dışa aktarma hatırlatılır; ücretsiz sunucuda otomatik yedek garantisi varsayılmaz.
- Ağ hatasında veri silinmez; bulut bağlantı durumu anlaşılır şekilde gösterilir.
- Yeni PWA sürümü bekleyen kaydı kaybettirmeden yüklenir; önbellek sürümleri kontrollü temizlenir.

## 8. Geliştirme ve canlı kullanım

- Yerel geliştirme: Windows, Node.js, kilit dosyalı paket yönetimi, örnek veriler.
- Deneme: ücretsiz HTTPS adresi; iPhone'da kamera seçimi, dikte, ana ekrana kurulum, çevrimdışı kullanım ve güncelleme doğrulaması.
- Canlı: farklı yayın adresi ve gerçek veriler. Yerel düzenleme canlıya otomatik gönderilmez.
- Ücretsiz proje kotası nedeniyle her ortam için sınırsız Supabase projesi varsayılmaz. Yerel test adaptörü kullanılır; mevcut proje kotası kontrol edilerek deneme/canlı ayrılır.
- Veritabanı değişiklikleri SQL migration olarak tutulur; yıkıcı değişiklikten önce dışa aktarma ve geri yükleme kontrol edilir.
- Kod deposuna sırlar girmez. Ücretli izleme servisi zorunlu olmaz; hata kayıtları malzeme fotoğrafı, token veya kişisel veri içermez.
- Üyelik ve bulut hizmeti açılmadan önce gerçek cihaz ve erişim testleri geçmelidir.

## 9. Uygulama sırası ve tamamlanma ölçütleri

### A — Çalışan ücretsiz çekirdek

PWA temeli; Dolabım, Bugün Ne Pişirsem, Tarif, Alışveriş ekranları; yerel veri; metin/dikte taslağı; tarif eşleştirme; stok onayı; dışa/içe aktarma.

Kabul: “kabak var, süt bitti” girdisi doğrulanıp kaydedilir; uygun tarif bulunur; eksik alışverişe eklenir; sayfa yenilenince kayıtlar korunur; internet kesildiğinde önceden yüklenen tarif ve liste kullanılabilir.

### B — iPhone ve ücretsiz yayın

Ücretsiz barındırma hesabı ve koşulları doğrulanır; statik çıktı yayınlanır; ana ekrana ekleme ve güncelleme denenir. Kamera/galeri seçimi hazırlanır, henüz analiz yoksa bu açıkça belirtilir.

Kabul: Windows kapalıyken iPhone'da çekirdek uygulama çalışır; özel alan adı veya ücretli hesap gerekmez. Kamera, dikte ve depolama davranışı gerçek cihazda kontrol edilir.

### C — Hesap ve cihazlar arası eşitleme

Supabase Free bağlantısı, ev üyeliği, RLS, kimlik doğrulama, aktarım ve eşitleme. Önce kişisel hesap; ardından davetli kullanıcılar.

Kabul: iki kullanıcının verileri birbirinden yalıtılır; aynı hesabın iki cihazı eşitlenir; ağ kesintisi ve çakışma kayıp yaratmadan ele alınır; duraklayan hizmet kullanıcıya açıklanır.

### D — Ücretsiz fotoğraf analizi denemesi

Yerel model ve güvenli iPhone erişimi; düzeltilebilir malzeme taslağı.

Kabul: temsili gerçek dolap fotoğraflarıyla doğruluk/gecikme raporu, belirsizlik gösterimi, bilgisayar kapalı durumunda anlaşılır hata. Geçmeden özellik tamamlandı sayılmaz.

### E — Günlük hatırlatma ve üyelik hazırlığı

İsteğe bağlı takvim dışa aktarma; ücretsiz kota içinde sunucu zamanlayıcısı ve web push değerlendirmesi; kişi başına işlem sınırları, veri silme ve dışa aktarma.

Kabul: izin reddi ve teslim edilmeyen bildirim temel uygulamayı bozmaz; ücretli plana ihtiyaç varsa o özellik devreye alınmaz. Konumdan eve dönüş algılama bu sürüm kapsamında değildir.

## 10. Doğrulanmış ücretsiz plan sınırları

22 Eylül 2026'da resmi kaynaklardan kontrol edildi; kurulum gününde yeniden doğrulanacak.

- Cloudflare statik asset istekleri ücretsiz ve sınırsız olarak belgeleniyor. Dinamik Workers Free için günlük 100.000 istek sınırı var; statik sunum ve dinamik işlem kotaları birbirine karıştırılmamalı.
- Supabase Free veritabanı sınırı proje başına 500 MB. Düşük etkinlik gösteren ücretsiz projeler 7 günlük dönem sonunda duraklatılabilir. Bu nedenle kesintisiz bulut hizmeti garantisi yok; yerel kullanım ve dışa aktarma gerekir.
- Supabase depolama, trafik, kimlik doğrulama ve proje sayısı gibi diğer kotalar kurulum öncesi güncel fiyatlandırma sayfasından kontrol edilir; yalnızca veritabanı boyutuna göre karar verilmez.
- Vercel Hobby kişisel/ticari olmayan kullanımla sınırlı; ileride ürünleşmenin varsayılan altyapısı olarak seçilmedi.

Kaynaklar:

- https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/
- https://developers.cloudflare.com/workers/platform/limits/
- https://supabase.com/pricing
- https://supabase.com/docs/guides/platform/billing-on-supabase
- https://supabase.com/docs/guides/platform/free-project-pausing
- https://vercel.com/docs/plans/hobby

## 11. Şu anki durum

- [x] Kullanım senaryosu ve ücretsiz mimari planı yazıldı.
- [x] Yayın ve veritabanı ücretsiz sınırları kontrol edildi.
- [x] Tarif defteri uygulama kodu, bağımlılıklar ve çekirdek testler oluşturuldu; doğrulama durumu README'de.
- [ ] iPhone'da gerçek cihaz testi yapıldı.
- [ ] Ücretsiz hesaplar bağlandı ve canlı yayın yapıldı.
- [ ] Fotoğraf modeli seçildi ve doğrulandı.

Güncel sıra ve uygulanmış özelliklerin sınırları için README ve RECIPY-INCELEME dosyalarını esas alın. Dolap/alışveriş aşaması tarif arşivinden sonra tamamlanacak.
