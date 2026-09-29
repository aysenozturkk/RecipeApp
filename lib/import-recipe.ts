import { emptyFields, type RecipeFields } from './recipes.ts';
import { load } from 'cheerio';

function plain(value: unknown): string {
  if (typeof value !== 'string' && typeof value !== 'number') return '';
  return String(value).replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
}
function instructions(value: unknown): string[] {
  if (typeof value === 'string') return [plain(value)];
  if (Array.isArray(value)) return value.flatMap(instructions);
  if (!value || typeof value !== 'object') return [];
  const v = value as Record<string, unknown>;
  if (v.itemListElement) return [plain(v.name), ...instructions(v.itemListElement)].filter(Boolean);
  return [plain(v.text || v.name)].filter(Boolean);
}
function duration(value: unknown): number {
  if (typeof value !== 'string') return 0;
  const match = /^P(?:(\d+)D)?T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(value);
  return match ? Number(match[1] || 0) * 1440 + Number(match[2] || 0) * 60 + Number(match[3] || 0) + Math.ceil(Number(match[4] || 0) / 60) : 0;
}
export function extractRecipes(html: string, url: string): RecipeFields[] {
  const candidates: Record<string, unknown>[] = [];
  function visit(v: unknown, depth = 0) {
    if (depth > 20 || candidates.length >= 20) return;
    if (Array.isArray(v)) { for (const x of v) visit(x, depth + 1); return; }
    if (!v || typeof v !== 'object') return;
    const obj = v as Record<string, unknown>;
    const types = Array.isArray(obj['@type']) ? obj['@type'] : [obj['@type']];
    if (types.some(t => t === 'Recipe' || t === 'https://schema.org/Recipe' || t === 'http://schema.org/Recipe')) candidates.push(obj);
    else for (const nested of Object.values(obj)) if (nested && typeof nested === 'object') visit(nested, depth + 1);
  }
  for (const script of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)) {
    if (!/\btype\s*=\s*["']application\/ld\+json["']/i.test(script[1])) continue;
    try { visit(JSON.parse(script[2])); } catch { /* Broken metadata is not a usable recipe. */ }
  }
  // Some publishers expose Recipe as HTML microdata rather than JSON-LD.
  // Only read properties owned by this scope, excluding authors/reviews/videos.
  const $ = load(html);
  $('[itemscope][itemtype]').filter((_, el) =>
    /(?:^|\s)https?:\/\/schema\.org\/Recipe(?:\s|$)/.test($(el).attr('itemtype') || '')
  ).slice(0, 20).each((_, root) => {
    const properties = (name: string) => $(root).find(`[itemprop~="${name}"]`).filter((_, el) => $(el).parents('[itemscope]').first().get(0) === root);
    const value = (name: string) => {
      const el = properties(name).first();
      return el.attr('content') ?? el.attr('datetime') ?? el.text().trim();
    };
    const steps: string[] = [];
    properties('recipeInstructions').each((_, el) => {
      const node = $(el);
      const items = node.find('li').filter((_, li) => !$(li).find('li').length);
      if (items.length) items.each((_, li) => { steps.push($(li).text().trim()); });
      else {
        const text = node.attr('content') ?? node.clone().find('br').replaceWith('\n').end().text();
        steps.push(...text.split(/\n+/).map(s => s.trim()).filter(Boolean));
      }
    });
    candidates.push({
      name: value('name'), recipeYield: value('recipeYield'),
      totalTime: value('totalTime'), prepTime: value('prepTime'), cookTime: value('cookTime'),
      recipeIngredient: properties('recipeIngredient').map((_, el) => $(el).attr('content') ?? $(el).text().trim()).get(),
      recipeInstructions: steps,
    });
  });
  const seen = new Set<string>();
  return candidates.filter(c => plain(c.name)).map(c => {
    const ingredients = Array.isArray(c.recipeIngredient) ? c.recipeIngredient.flat(10).map(plain).filter(Boolean).join('\n') : plain(c.recipeIngredient);
    const steps = instructions(c.recipeInstructions).join('\n');
    const minutes = duration(c.totalTime) || (duration(c.prepTime) + duration(c.cookTime));
    const yieldText = plain(Array.isArray(c.recipeYield) ? c.recipeYield[0] : c.recipeYield);
    // Only infer numeric servings when explicitly a plain number or person/serving count.
    const serving = /^(\d+)\s*(?:kişilik|kişi|servings?|people)?$/i.exec(yieldText);
    return { ...emptyFields(), title: plain(c.name).slice(0, 160), ingredients, instructions: steps,
      sourceUrl: url, minutes: minutes ? String(minutes) : '', servings: serving?.[1] || '',
      sourceText: [plain(c.name), `Porsiyon bilgisi: ${yieldText || 'belirtilmemiş'}`, 'Malzemeler', ingredients, 'Yapılışı', steps].join('\n') };
  }).filter(r => { const key = r.title + r.ingredients + r.instructions; if (seen.has(key)) return false; seen.add(key); return true; });
}
