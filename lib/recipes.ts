export type RecipeFields = {
  title: string; sourceUrl: string; sourceText: string; ingredients: string;
  instructions: string; servings: string; minutes: string; collection: string;
};
export type RecipeImage = { id: string; name: string; data: string };
export type Recipe = RecipeFields & {
  id: string; createdAt: string; updatedAt: string; favorite: boolean;
  images: RecipeImage[]; notes: { id: string; text: string; date: string }[];
  revisions: { date: string; fields: RecipeFields }[];
};
export const emptyFields = (): RecipeFields => ({ title: '', sourceUrl: '', sourceText: '', ingredients: '', instructions: '', servings: '', minutes: '', collection: '' });
export function fieldsOf(recipe: RecipeFields): RecipeFields {
  return Object.fromEntries(Object.keys(emptyFields()).map(k => [k, recipe[k as keyof RecipeFields]])) as RecipeFields;
}
export function safeUrl(value: string): string {
  if (!value.trim()) return '';
  try { const u = new URL(value.trim()); if (!['https:', 'http:'].includes(u.protocol) || u.username || u.password) throw new Error(); return u.href; }
  catch { throw new Error('Geçerli bir http veya https bağlantısı gir.'); }
}
export function normalize(value: string) { return value.toLocaleLowerCase('tr-TR').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ı/g, 'i'); }
// Conservatively split written sections. Missing steps are never generated.
export function parseText(text: string): RecipeFields {
  const result = emptyFields(); result.sourceText = text;
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  let section: 'ingredients' | 'instructions' | null = null;
  const ingredients: string[] = [], steps: string[] = [], remaining: string[] = [];
  for (const line of lines) {
    const n = normalize(line).replace(/[:：]$/, '').trim();
    if (/^(malzemeler|malzeme listesi|ingredients)$/.test(n)) { section = 'ingredients'; continue; }
    if (/^(yapilisi|hazirlanisi|hazirlanis|yapilis|tarif|instructions|directions|method)$/.test(n)) { section = 'instructions'; continue; }
    if (section === 'ingredients') ingredients.push(line);
    else if (section === 'instructions') steps.push(line);
    else remaining.push(line);
  }
  result.title = remaining[0]?.slice(0, 160) || '';
  result.ingredients = ingredients.join('\n'); result.instructions = steps.join('\n');
  return result;
}
export function updateRecipe(current: Recipe, fields: RecipeFields, images: RecipeImage[], now = new Date().toISOString()): Recipe {
  return { ...current, ...fields, sourceUrl: safeUrl(fields.sourceUrl), images, updatedAt: now,
    revisions: [{ date: current.updatedAt, fields: fieldsOf(current) }, ...current.revisions].slice(0, 20) };
}
export function restoreRecipe(current: Recipe, index: number): Recipe {
  if (!current.revisions[index]) throw new Error('Bu sürüm bulunamadı.');
  return updateRecipe(current, current.revisions[index].fields, current.images);
}
export function matchesRecipe(recipe: Recipe, query: string, collection: string): boolean {
  return (!collection || recipe.collection === collection) && normalize([recipe.title, recipe.ingredients, recipe.collection, ...recipe.notes.map(n => n.text)].join(' ')).includes(normalize(query));
}
export const IMAGE_LIMIT = 8;
export function validateLibrary(value: unknown): Recipe[] {
  if (!value || typeof value !== 'object' || !('version' in value) || value.version !== 1 || !('recipes' in value) || !Array.isArray(value.recipes)) throw new Error('Bu dosya RecipeAgent v1 yedeği değil.');
  if (value.recipes.length > 2000) throw new Error('Bir yedekte en fazla 2000 tarif destekleniyor.');
  const ids = new Set<string>();
  const string = (s: unknown, max = 100000): s is string => typeof s === 'string' && s.length <= max;
  const date = (s: unknown) => string(s, 100) && Number.isFinite(Date.parse(s));
  const validFields = (r: Record<string, unknown>) => Object.keys(emptyFields()).every(k => string(r[k])) && string(r.title, 160) && r.title.trim().length > 0 && safeUrl(r.sourceUrl as string) === r.sourceUrl;
  for (const r of value.recipes) {
    if (!r || typeof r !== 'object' || !string(r.id, 100) || !r.id || ids.has(r.id) || !validFields(r) || !date(r.createdAt) || !date(r.updatedAt) || typeof r.favorite !== 'boolean') throw new Error('Yedekte geçersiz veya yinelenen tarif var.');
    if (!Array.isArray(r.images) || r.images.length > IMAGE_LIMIT || !r.images.every((i: RecipeImage) => i && string(i.id, 100) && string(i.name, 500) && string(i.data, 2000000) && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(i.data))) throw new Error('Yedekte geçersiz görsel var.');
    if (!Array.isArray(r.notes) || r.notes.length > 1000 || !r.notes.every((n: Recipe['notes'][number]) => n && string(n.id, 100) && string(n.text) && date(n.date))) throw new Error('Yedekte geçersiz not var.');
    if (!Array.isArray(r.revisions) || r.revisions.length > 20 || !r.revisions.every((v: Recipe['revisions'][number]) => v && date(v.date) && v.fields && validFields(v.fields))) throw new Error('Yedekte geçersiz sürüm var.');
    ids.add(r.id);
  }
  return value.recipes as Recipe[];
}
