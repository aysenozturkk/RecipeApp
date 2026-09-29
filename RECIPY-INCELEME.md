# Recipy incelemesi ve RecipeAgent kapsamı

28 Eylül 2026. Referans, kullanıcının doğruladığı **https://recipyai.app/** / **Recipe Box – Recipy** uygulamasıdır. recipyapp.com ve ReciMe farklı ürünlerdir.

## İncelemenin sınırı

Resmî web sitesi, App Store açıklaması ve sürüm geçmişi, Google Play açıklaması incelendi. Aşağıdakiler yayıncının kamuya açık beyanlarıdır; uygulama kurulup ücretli ekranlar veya her içe aktarma yolu uçtan uca denenmedi. “Tüm özellikler”, erişilebilir belgelerdeki envanteri ifade eder. Reklamdaki “her siteden” iddiası teknik garanti olarak alınmaz.

## Belgelenen özellik envanteri

| Recipy özelliği | Kanıt | RecipeAgent kararı |
|---|---|---|
| Instagram, TikTok, YouTube içe aktarma | [Google Play](https://play.google.com/store/apps/details?id=app.recipyai.app) | Bağlantı + içerik taslağı; erişilemeyen içerikte metin/ekran görüntüsü yolu |
| Web sitelerinden kayıt, uygulama içi tarayıcı | [Google Play](https://play.google.com/store/apps/details?id=app.recipyai.app) | URL içe aktarma; PWA içinde başka siteleri iframe'e zorlamama |
| Metin/malzeme listesinden tarif | [Google Play](https://play.google.com/store/apps/details?id=app.recipyai.app) | Mevcut metni ayrıştırma; eksik adımları uydurmama |
| Yemek fotoğrafından AI tarif üretme | [Google Play](https://play.google.com/store/apps/details?id=app.recipyai.app) | Deneysel; tarif ekran görüntüsü OCR'sinden ayrı |
| Porsiyon ölçekleme, bulut eşitleme | [Google Play](https://play.google.com/store/apps/details?id=app.recipyai.app) | Yol haritasına dahil |
| Adımlı pişirme, ekranı açık tutma; besin değerleri (Pro) | [Google Play](https://play.google.com/store/apps/details?id=app.recipyai.app) | Pişirme modu ücretsiz yapılabilir; doğrulanmamış besin değeri üretmeyiz |
| Kişisel notlar, çeviri, filtreler, koleksiyonlar | [App Store](https://apps.apple.com/tr/app/recipe-box-recipy/id6754534120) | Not, filtre, koleksiyon öncelikli; çeviri sonraki aşama |
| Haftalık plan, alışveriş listesi, tarif düzenleme | [App Store](https://apps.apple.com/tr/app/recipe-box-recipy/id6754534120) | Dolap asistanıyla bütünleştirilecek |
| Tarif/koleksiyon paylaşma, Facebook içe aktarma | [App Store sürüm geçmişi](https://apps.apple.com/tr/app/recipe-box-recipy/id6754534120) | Önce kaynak/metin paylaşma; ortak koleksiyon sonra |
| İsimden tarif ve AI görsel üretme, gruplu malzemeler | [App Store sürüm geçmişi](https://apps.apple.com/tr/app/recipe-box-recipy/id6754534120) | Malzeme grupları planlı; üretken AI zorunlu değil |
| iOS paylaşım uzantısı, Türkçe/İngilizce | [App Store](https://apps.apple.com/tr/app/recipe-box-recipy/id6754534120) | Türkçe öncelikli; PWA'ya yerel uzantı eşdeğerliği vaat edilmez |
| Pinterest ve film rulosundan içe aktarma beyanı | [Resmî site](https://recipyai.app/) | Dosya seçimi; platform bazında içe aktarma doğrulaması |

Recipy ücretsiz indirilse de Pro özellikleri ve içe aktarma sınırı var; mağaza açıklaması haftalık beş ücretsiz aktarım belirtiyor. Kendi uygulamamızın ücretsiz mimarisi bunlara bağımlı olmayacak. Ekran görüntüsünden OCR'nin ayrıntıları, çoklu kişisel fotoğraf yönetimi ve sürüm geri yükleme kamuya açık belgelerle tam doğrulanmadı; bunlar kullanıcının ihtiyacı olarak ayrıca tasarlanıyor.

## Kullanıcının istediği tarif defteri

Ana akış: **Kaynak ekle → düzenlenebilir taslak → kontrol et → kaydet → kendi yorumunla geliştir → dolabınla karşılaştır.**

- Tarif oluştur, düzenle, kopyala, sil; başlık, kaynak, kişi sayısı, süre, malzemeler ve adımlar.
- Tarihli kişisel notlar: “Tuzu azalttım”, “180 derecede daha iyi oldu”. Notlar tariften ayrı tutulur.
- Kapak ve birden çok görsel; ekle, kaldır, kapak seç. Kendi pişirdiğin yemeğin fotoğrafı ile kaynak ekran görüntüsü ayırt edilir.
- Düzenleme geçmişi: önceki tarif sürümünü geri yükle; yeniden içe aktarma kişisel notları ve düzenlemeleri silmesin.
- Koleksiyon, favoriler, başlık/malzeme/not araması.
- Bağlantısı kapanan tarifin onaylanmış yerel içeriği kaybolmaz.
- Özel arşiv varsayılanı. Dışarı paylaşırken özel notlar ve kişisel fotoğraflar ayrıca seçilmedikçe gönderilmez.
- JSON metin yedeği yanında görselleri de kapsayan taşınabilir yedek; büyük arşivde bellek/depolama sınırları kontrol edilir.

## Kaynak türleri ve ücretsiz teknik yol

### 1. Yazılı ekran görüntüsü / kitap fotoğrafı

Tarayıcıda Tesseract.js ile OCR; Türkçe/İngilizce dil verileri ilk kullanımda indirilir. Görsel cihazda işlenir; işlem süresi ve iPhone bellek sınırları gerçek cihazda ölçülür. Birden fazla görsel sırayla okunur; ham metin kullanıcıya gösterilir, miktarlar onaylanır. OCR, metin okur; tarifin doğru veya eksiksiz olduğuna karar vermez. [Tesseract.js](https://github.com/naptha/tesseract.js)

### 2. Tarif web sitesi

Önce Schema.org Recipe/JSON-LD alanları: başlık, malzemeler, adımlar, süre, porsiyon, görsel ve kaynak. Bir sayfada birden fazla tarif bulunursa seçim gösterilir. Yapısal veri yoksa temiz metin taslağı veya manuel yapıştırma kullanılır. [Recipe şeması](https://schema.org/Recipe)

Statik PWA tarayıcıdan her alan adını okuyamaz. Bu yüzden otomatik URL çözümleme için ücretsiz kota içinde ayrı bir Worker gerekir. Yerel kütüphane bu servise bağımlı olmaz. Worker kurulmadan URL kaydı yalnızca kaynak kaydı olarak açıkça gösterilir.

URL servisi açık proxy olmayacak: kimlik doğrulama, kişi başı kota, HTTPS, özel/yerel IP engeli, yönlendirme başına doğrulama, süre/boyut sınırı, kabul edilen içerik türleri, HTML temizleme. Sayfa JavaScript'i çalıştırılmaz. Oturum gerektiren veya erişimi engelleyen sayfalarda engel aşmaya çalışılmaz; kullanıcı metin/görsel ekler.

İlk uygulamada bu akış için yalnızca loopback üzerinde çalışan bir Node önizleme adaptörü eklendi: origin/host kontrolü, istek aralığı sınırı, DNS kontrolü ve doğrulanan IP'ye bağlantı, yönlendirme kontrolü, 2 MB boyut sınırı. Bulut Worker ve üyelik doğrulaması henüz yok; yerel adaptörün mevcut olması statik canlı yayında URL içe aktarmanın hazır olduğu anlamına gelmez.

### 3. Sosyal medya

Linki kaydetmek, açıklamasını okumak ve videodan tarif çıkarmak üç farklı yetenektir. Her platform için durum açıkça gösterilir. Açıklama/metin erişilebiliyorsa ayrıştırılır; değilse ekran görüntüsü/metin istenir. Yalnızca videoda söylenen tarif için ücretsiz, sürekli erişilebilir transkripsiyon altyapısı varsayılmaz. Bağlantının saklanması “tarif başarıyla çıkarıldı” olarak raporlanmaz.

### 4. iPhone paylaşım menüsü

PWA'dan dışarı paylaşma (Web Share) ile başka uygulamadan içerik alma (Web Share Target) farklı API'lerdir. iPhone'da doğrudan gelen paylaşımı temel varsayım yapmıyoruz. Zorunlu çalışan yol: bağlantıyı kopyala → uygulamaya yapıştır; ekran görüntüsünü Fotoğraflar'dan seç. Apple Kestirmeler ile paylaşım köprüsü ayrıca denenebilir; doğrulanmadan hazır sayılmaz. [MDN](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/How_to/Share_data_between_apps)

### 5. Yemek / dolap fotoğrafı

Yazı olmayan fotoğraf OCR ile malzemeye veya asıl tarife dönüşmez. Önceki yerel görsel model denemesi korunur; sonuç tahmindir, orijinal tarif değildir.

## Veri modeli ekleri

`recipe_sources` (URL, platform, içe aktarma tarihi ve yöntemi), `recipe_notes`, `recipe_media` (Blob/storage anahtarı, tür, açıklama, sıra), `recipe_revisions`, `collections`, `collection_recipes`, `import_jobs`.

Kaynak metin ile kullanıcının son düzenlemesi ayrı tutulur. Medya IndexedDB Blob olarak saklanır; bulut eşitlemede özel Storage alanı ve ayrı kota kontrolü kullanılır. Başarısız dosya kaydı metnin de kaybolmasına neden olmaz; kısmi başarı açıkça gösterilir. Silme ve yedekten yükleme medya referanslarıyla birlikte tutarlı yapılır.

## Yeni geliştirme sırası

1. Tarif defteri: düzenleme, kaynak URL, notlar, görseller, koleksiyonlar, arama, yedek ve sürüm geri alma.
2. Metin + ekran görüntüsü OCR: onaylı içe aktarma, tekrar kayıt kontrolü.
3. Web URL çözümleyici: ücretsiz Worker ve gerçek örnek sitelerle doğrulama; sosyal kaynaklarda şeffaf geri dönüşler.
4. Dolap karşılaştırması + alışveriş + porsiyon + pişirme modu.
5. Ücretsiz yayın, hesap/eşitleme, planlama ve hatırlatma.
6. Yerel görsel/video modeli ve paylaşım köprüsü deneyleri.

## Kabul örnekleri

- İki ekran görüntüsü sırayla okunur; “1/2” yanlış okunduysa kayıt öncesi düzeltilebilir.
- Instagram URL'si çözülmese de kaynak ve kullanıcı açıklaması kaydedilir; başarılı otomatik aktarım iddiası gösterilmez.
- Tarif değiştirilir, tarihli not ve iki görsel eklenir; sayfa yenilenince tümü korunur.
- Önceki tarif sürümü geri alınır; sonradan yazılan kişisel notlar kaybolmaz.
- Tam yedek yeni tarayıcıya yüklenir; görseller ve kaynaklar eksiksiz kalır.
- Kaydedilmiş kabak tarifi dolapla karşılaştırılır; süt bilinmiyorsa “eksik” diye kesinleştirilmez.

Bu belge ürün kapsamı ve araştırmadır; uygulanmış özelliklerin durumu README'de ayrıca belirtilir.
