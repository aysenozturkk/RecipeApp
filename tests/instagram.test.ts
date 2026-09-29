import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isInstagram, instagramUrl, extractInstagram, parseInstagramCaption } from '../lib/instagram.ts';
const url = 'https://www.instagram.com/p/Example123/';
const caption = 'Domates çorbası\nMalzemeler:\n4 domates\n1/2 bardak süt\nYapılışı:\nDomatesleri pişir.';
test('Instagram URL temizlenir; profil, kimlik bilgisi ve sahte alan adı reddedilir', () => {
  assert.equal(instagramUrl(url + '?igsh=secret#test'), url);
  assert.equal(isInstagram('https://instagram.com.evil.test/p/Example123/'), false);
  assert.throws(() => instagramUrl('https://www.instagram.com/someone/'));
  assert.throws(() => instagramUrl('https://user:pass@instagram.com/p/Example123/'));
});
test('yalnızca istenen gönderinin açıklaması seçilir, yorumlar kullanılmaz', () => {
  const payload = { items: [{ shortcode: 'Other', caption: { text: 'Yanlış tarif' } }, { shortcode: 'Example123', edge_media_to_caption: { edges: [{ node: { text: caption } }] }, comments: [{ text: 'Yanlış malzemeler' }] }] };
  const r = extractInstagram(`<script type="application/json">${JSON.stringify(payload)}</script>`, url);
  assert.equal(r.recipes[0].title, 'Domates çorbası'); assert.equal(r.recipes[0].ingredients, '4 domates\n1/2 bardak süt');
  assert.equal(r.recipes[0].sourceText, caption); assert.match(r.warning, /video\/ses okunmadı/);
});
test('önizleme açıklaması ve HTML karakterleri çözülür; kesilme uyarısı verilir', () => {
  const html = '<meta property="og:description" content="240 likes, 3 comments - chef on Instagram: &quot;Çorba tarifi&#10;Malzemeler:&#10;4 domates…&quot;">';
  const r = extractInstagram(html, url);
  assert.equal(r.recipes[0].title, 'Çorba tarifi'); assert.match(r.warning, /kesmiş olabilir/);
  assert.equal(r.recipes[0].instructions, '');
});
test('giriş ekranı veya genel profil metni tarif gibi sunulmaz', () => {
  assert.throws(() => extractInstagram('<meta name="description" content="Log in to see photos on Instagram">', url));
  assert.throws(() => extractInstagram('<title>Instagram</title>', url));
  assert.throws(() => extractInstagram('<meta property="og:description" content="See Instagram photos and videos from chef">', url));
});
test('yazılı tarif bulunmayan video için adımlar uydurulmaz', () => {
  assert.throws(() => extractInstagram('<meta property="og:description" content="Harika bir gün!">', url));
  const r = extractInstagram('<meta property="og:description" content="Tarif videoda, afiyet olsun!">', url);
  assert.equal(r.recipes[0].ingredients, ''); assert.equal(r.recipes[0].instructions, ''); assert.match(r.warning, /ayrılamadı/);
});
test('başlıksız, malzeme ve adımları karışık açıklama miktarları koruyarak ayrılır', () => {
  const text = 'Deneme keki\n3 yumurta\n→ İyice çırp\n2,5 su bardağı un\nÜstü için:\n2 yemek kaşığı şeker\n→ Elinle ufala\nKalıbı yağla, harcı dök.\n🔥 180° fırında 45 dk pişir.\nFavorim!\n#tarif';
  const r = parseInstagramCaption(text);
  assert.equal(r.ingredients, '3 yumurta\n2,5 su bardağı un\nÜstü için:\n2 yemek kaşığı şeker');
  assert.equal(r.instructions, 'İyice çırp\nElinle ufala\nKalıbı yağla, harcı dök.\n180° fırında 45 dk pişir.');
  assert.equal(r.sourceText, text); assert.equal(r.minutes, '');
});
