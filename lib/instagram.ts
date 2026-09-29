import { load } from 'cheerio';
import { normalize, parseText, type RecipeFields } from './recipes.ts';

const HOSTS = new Set(['instagram.com', 'www.instagram.com', 'm.instagram.com']);
export function parseInstagramCaption(caption: string): RecipeFields {
  const draft = parseText(caption);
  if (draft.ingredients && draft.instructions) return draft;
  const ingredients: string[] = [], steps: string[] = [];
  for (const line of caption.split(/\r?\n/).slice(1).map(s => s.trim()).filter(Boolean)) {
    const cleaned = line.replace(/^[\p{Extended_Pictographic}\uFE0F\s•→➜-]+/u, '').trim();
    const n = normalize(cleaned);
    if (/^(?:\d+(?:[.,/]\d+)?|yarim|ceyrek|bir|iki|uc)\s+(?:adet\s+)?(?:yumurta|su\s+bardagi|cay\s+bardagi|yemek\s+kasigi|tatli\s+kasigi|cay\s+kasigi|paket|gram|gr\b|kg\b|ml\b|litre|bardak|kasik|cup|tbsp|tsp|domates|kabak|patates|sogan|dis|tutam)/.test(n)) ingredients.push(cleaned);
    else if (/\bicin\s*:$/.test(n)) ingredients.push(cleaned);
    else if (/^[→➜]/.test(line) || /\b(?:cirp|ufala|yagla|dok|serpistir|ekle|pisir|karistir|dogra|kavur|hasla|yogur|beklet|yerlestir|servis et)\b/.test(n)) steps.push(cleaned);
  }
  if (!draft.ingredients) draft.ingredients = ingredients.join('\n');
  if (!draft.instructions) draft.instructions = steps.join('\n');
  return draft;
}
export function isInstagram(value: string): boolean {
  try { return HOSTS.has(new URL(value).hostname.toLowerCase()); } catch { return false; }
}
export function instagramUrl(value: string): string {
  const u = new URL(value);
  const match = /^\/(p|reel|reels|tv)\/([\w-]+)\/?$/.exec(u.pathname);
  if (!HOSTS.has(u.hostname) || !match || u.username || u.password || u.port || !['http:', 'https:'].includes(u.protocol))
    throw new Error('Instagram gönderisinin veya Reels videosunun bağlantısını ekle. Profil, hikâye ve paylaşım kısayolu yerine gönderinin kendi bağlantısını kullan.');
  return `https://www.instagram.com/${match[1] === 'reels' ? 'reel' : match[1]}/${match[2]}/`;
}

export function extractInstagram(html: string, source: string): { recipes: RecipeFields[]; warning: string } {
  const canonical = instagramUrl(source);
  const shortcode = new URL(canonical).pathname.split('/')[2];
  const $ = load(html);
  let caption = '';
  // Read only a media object whose shortcode matches the requested post.
  // Never harvest recommended posts, comments or execute embedded scripts.
  let visited = 0;
  function visit(value: unknown, depth = 0) {
    if (++visited > 15000 || depth > 35 || caption) return;
    if (Array.isArray(value)) { for (const item of value) visit(item, depth + 1); return; }
    if (!value || typeof value !== 'object') return;
    const v = value as Record<string, unknown>;
    if (v.shortcode === shortcode || v.code === shortcode) {
      const edges = v.edge_media_to_caption as { edges?: { node?: { text?: unknown } }[] } | undefined;
      const candidate = edges?.edges?.[0]?.node?.text ?? (v.caption as { text?: unknown } | null)?.text;
      if (typeof candidate === 'string' && candidate.trim()) caption = candidate.trim();
    }
    for (const child of Object.values(v)) if (child && typeof child === 'object') visit(child, depth + 1);
  }
  $('script[type="application/json"]').each((_, el) => { try { visit(JSON.parse($(el).text())); } catch { /* Not a data payload. */ } });
  let metadata = false;
  if (!caption) {
    const description = $('meta[property="og:description"]').attr('content') || $('meta[name="description"]').attr('content') || '';
    const quoted = /(?:on Instagram|Instagram'da|Instagram’da)[\s\S]*?:\s*["“]([\s\S]*)["”]\.?\s*$/.exec(description);
    const socialPrefix = /^[\s\S]*?(?:likes|beğeni)[\s\S]*? - [\s\S]*?:\s*["“]([\s\S]*)["”]\.?\s*$/.exec(description);
    caption = (quoted?.[1] || socialPrefix?.[1] || description).trim(); metadata = true;
  }
  const n = normalize(caption);
  if (!caption || /^(?:instagram|login|log in|sign up|giris yap)$/.test(n) || /(?:create an account|log in to see|sign up to see|see instagram photos|instagram photos and videos|hesap olustur|giris yaparak)/.test(n))
    throw new Error('Instagram açıklaması erişilebilir değil. Gönderi giriş gerektiriyor veya Instagram okumayı sınırlıyor olabilir. Açıklamayı Kaynak metin alanına yapıştırabilir ya da ekran görüntüsünü okutabilirsin.');
  // Generic social metadata must not be presented as a recipe.
  if (!/(?:malzeme|yapilis|hazirlanis|tarif|ingredients|directions|recipe|\d+\s*(?:adet|gram|gr\b|bardak|kasik|cup|tbsp|tsp))/.test(n))
    throw new Error('Paylaşımda okunabilir yazılı tarif bulunamadı. Tarif yalnızca videoda anlatılıyorsa bu sürüm sesi çözümlemez; açıklama veya ekran görüntüsü ekle.');
  if (caption.length > 100000) throw new Error('Instagram açıklaması desteklenen boyutu aşıyor.');
  const draft = parseInstagramCaption(caption);
  if (!draft.title) draft.title = 'Instagram tarif taslağı';
  draft.sourceUrl = canonical;
  const warnings = ['Instagram açıklamasından taslak oluşturuldu. Ölçüleri ve adımları kaydetmeden kontrol et; video/ses okunmadı.'];
  if (metadata || /(?:…|\.\.\.)\s*$/.test(caption)) warnings.push('Sayfa önizlemesi açıklamayı kesmiş olabilir; kaynakla karşılaştır.');
  if (!draft.ingredients || !draft.instructions) warnings.push('Malzeme veya adımlar ayrılamadı. Tam okunan metin kaynak alanında korunuyor; eksik alanları kendin düzenle.');
  return { recipes: [draft], warning: warnings.join(' ') };
}
