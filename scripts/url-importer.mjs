// Loopback development adapter. A deployed static site needs a separately secured importer.
import https from 'node:https';
import { Resolver } from 'node:dns/promises';
import { isIP } from 'node:net';
import { extractRecipes } from '../lib/import-recipe.ts';
import { isInstagram, instagramUrl, extractInstagram } from '../lib/instagram.ts';

export function publicV4(address) {
  if (isIP(address) !== 4) return false;
  const [a, b, c] = address.split('.').map(Number);
  return !(a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 168 || b === 0 || (b === 88 && c === 99))) || (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) || (a === 203 && b === 0 && c === 113));
}
export async function requestPage(url, redirects = 0) {
  const u = new URL(url);
  if (u.protocol !== 'https:' || u.username || u.password || (u.port && u.port !== '443') || isIP(u.hostname) || u.hostname.endsWith('.local') || u.hostname === 'localhost') throw new Error('Yalnızca herkese açık HTTPS tarif bağlantıları desteklenir.');
  const resolver = new Resolver({ timeout: 5000, tries: 1 });
  const addresses = await resolver.resolve4(u.hostname);
  if (!addresses.length || !addresses.every(publicV4)) throw new Error('Bu adres içe aktarmaya uygun değil.');
  // Pin the checked address to avoid DNS rebinding between validation and connection.
  const response = await new Promise((resolve, reject) => {
    const req = https.get(u, { family: 4, autoSelectFamily: false, lookup: (_host, _options, callback) => callback(null, addresses[0], 4), headers: { 'User-Agent': 'RecipeAgent/0.1 (personal recipe import)', Accept: 'text/html', 'Accept-Encoding': 'identity' } }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) { res.resume(); resolve({ redirect: res.headers.location }); return; }
      if (res.statusCode !== 200) { res.resume(); reject(new Error('Site bu içeriği okuyabilmemize izin vermedi. Metin veya ekran görüntüsü ekleyebilirsin.')); return; }
      if (!String(res.headers['content-type']).includes('text/html')) { res.resume(); reject(new Error('Bağlantı bir HTML tarif sayfası değil.')); return; }
      let size = 0; const chunks = [];
      res.on('data', chunk => { size += chunk.length; if (size > 2 * 1024 * 1024) req.destroy(new Error('Sayfa 2 MB sınırını aşıyor.')); else chunks.push(chunk); });
      res.on('end', () => resolve({ html: Buffer.concat(chunks).toString('utf8'), url: u.href }));
      res.on('error', reject);
    });
    const deadline = setTimeout(() => req.destroy(new Error('Site yanıtı zaman aşımına uğradı.')), 12000);
    req.on('close', () => clearTimeout(deadline)); req.on('error', reject);
  });
  if (response.redirect) {
    if (redirects >= 3) throw new Error('Bağlantı çok fazla yönlendirme yapıyor.');
    return requestPage(new URL(response.redirect, u).href, redirects + 1);
  }
  return response;
}
let pending = false;
let lastRequest = 0;
export async function handleImport(req, res) {
  const respond = (status, body) => res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }).end(JSON.stringify(body));
  if (req.method !== 'POST' || req.headers.origin !== 'http://127.0.0.1:3000' || req.headers.host !== '127.0.0.1:3000' || req.headers['content-type'] !== 'application/json') { respond(403, { error: 'Bu işlem yalnızca yerel uygulamadan kullanılabilir.' }); return; }
  if (pending || Date.now() - lastRequest < 3000) { respond(429, { error: 'Lütfen birkaç saniye sonra tekrar dene.' }); return; }
  pending = true; lastRequest = Date.now();
  try {
    let data = '';
    for await (const chunk of req) { data += chunk; if (data.length > 4096) throw new Error('Bağlantı çok uzun.'); }
    const input = JSON.parse(data);
    if (typeof input.url !== 'string') throw new Error('Bağlantı gerekli.');
    if (isInstagram(input.url)) {
      const url = instagramUrl(input.url);
      let result;
      try { result = await requestPage(url); }
      catch { throw new Error('Instagram paylaşımına şu anda erişilemiyor. Açıklamayı yapıştırabilir veya ekran görüntüsünü okutabilirsin.'); }
      if (!isInstagram(result.url) || !/^\/(p|reel|reels|tv)\/[\w-]+\/?$/.test(new URL(result.url).pathname)) throw new Error('Instagram giriş sayfasına yönlendirdi. Açıklamayı veya ekran görüntüsünü ekle.');
      respond(200, extractInstagram(result.html, url)); return;
    }
    const result = await requestPage(input.url);
    const recipes = extractRecipes(result.html, result.url);
    if (!recipes.length) throw new Error('Bu sayfada okunabilir tarif verisi bulunamadı. Kaynak bağlantısını saklayıp metin veya ekran görüntüsü ekleyebilirsin.');
    respond(200, { recipes });
  } catch (e) { respond(422, { error: e instanceof Error ? e.message : 'Tarif alınamadı.' }); }
  finally { pending = false; }
}
