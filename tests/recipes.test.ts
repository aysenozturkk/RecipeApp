import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseText, emptyFields, safeUrl, updateRecipe, restoreRecipe, validateLibrary, matchesRecipe, type Recipe } from '../lib/recipes.ts';
const sample = (): Recipe => ({ ...emptyFields(), id: '1', title: 'Kabak graten', createdAt: '2026-09-28T10:00:00Z', updatedAt: '2026-09-28T10:00:00Z', favorite: false, images: [], notes: [{ id: 'n1', text: 'Tuzu azalt', date: '2026-09-28T11:00:00Z' }], revisions: [] });
test('OCR taslağı miktarı korur, eksik adım üretmez', () => {
  const r = parseText('Kabak graten\nMalzemeler:\n1/2 su bardağı süt\n3 kabak\nYapılışı:\nFırına koy.');
  assert.equal(r.ingredients, '1/2 su bardağı süt\n3 kabak'); assert.equal(r.instructions, 'Fırına koy.');
  assert.equal(parseText('Kabak\n3 kabak').instructions, '');
});
test('aktif ve kimlik bilgisi içeren URL reddedilir', () => {
  assert.throws(() => safeUrl('javascript:alert(1)')); assert.throws(() => safeUrl('https://user:pass@example.com'));
  assert.equal(safeUrl('https://example.com/tarif'), 'https://example.com/tarif');
});
test('geri yükleme sonradan eklenen notları ve görselleri korur', () => {
  const original = sample();
  const changed = updateRecipe(original, { ...emptyFields(), title: 'Yeni tarif' }, []);
  changed.notes.push({ id: 'n2', text: 'Yeni not', date: changed.updatedAt });
  const restored = restoreRecipe(changed, 0);
  assert.equal(restored.title, original.title); assert.equal(restored.notes.length, 2); assert.equal(restored.revisions.length, 2);
});
test('yedek geçerli kayıtları okur; tekrar id, SVG ve bozuk kayıtları reddeder', () => {
  const r = sample(); assert.equal(validateLibrary({ version: 1, recipes: [r] }).length, 1);
  assert.throws(() => validateLibrary({ version: 1, recipes: [r, r] }));
  assert.throws(() => validateLibrary({ version: 1, recipes: [{ ...r, images: [{ id: 'a', name: 'a', data: 'data:image/svg+xml;base64,abc' }] }] }));
  assert.throws(() => validateLibrary({ version: 1, recipes: [{ ...r, notes: null }] }));
});
test('Türkçe arama notları ve koleksiyonu kapsar', () => {
  assert.ok(matchesRecipe(sample(), 'TUZU', '')); assert.ok(!matchesRecipe(sample(), '', 'Tatlılar'));
});
