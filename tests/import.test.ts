import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractRecipes } from '../lib/import-recipe.ts';
test('Recipe JSON-LD graph ve bölümlü adımlar okunur', () => {
  const html = `<script type="application/ld+json">${JSON.stringify({ '@graph': [{ '@type': ['Recipe'], name: 'Kabak &amp; peynir', recipeYield: '2 kişilik', totalTime: 'PT1H15M', recipeIngredient: ['1/2 bardak süt'], recipeInstructions: [{ '@type': 'HowToSection', name: 'Sos', itemListElement: [{ text: 'Karıştır.' }] }] }] })}</script>`;
  const [r] = extractRecipes(html, 'https://example.com/');
  assert.equal(r.title, 'Kabak & peynir'); assert.equal(r.minutes, '75'); assert.equal(r.servings, '2'); assert.equal(r.instructions, 'Sos\nKarıştır.');
});
test('bir sayfadaki farklı tarifler ayrılır, bozuk script atlanır', () => {
  const html = `<script type='application/ld+json'>invalid</script><script type='application/ld+json'>[{"@type":"Recipe","name":"A"},{"@type":"Recipe","name":"B"}]</script>`;
  assert.equal(extractRecipes(html, 'https://example.com/').length, 2);
  assert.equal(extractRecipes('<p>Sosyal medya girişi gerekli</p>', 'https://example.com/').length, 0);
});
test('adet cinsinden ürün çıktısı kişi sayısına çevrilmez', () => {
  const [r] = extractRecipes('<script type="application/ld+json">{"@type":"Recipe","name":"Kurabiye","recipeYield":"24 cookies"}</script>', 'https://example.com/');
  assert.equal(r.servings, ''); assert.match(r.sourceText, /24 cookies/);
});
test('sitelerin iç içe malzeme grupları kayıpsız düzleştirilir', () => {
  const [r] = extractRecipes('<script type="application/ld+json">{"@type":"Recipe","name":"Deneme","recipeIngredient":[["3 kabak"],["1/2 bardak süt","1 kaşık un"]]}</script>', 'https://example.com/');
  assert.equal(r.ingredients, '3 kabak\n1/2 bardak süt\n1 kaşık un');
});
test('HTML microdata tarifi, yorum/yazar ve komşu tariflerden ayrılır', () => {
  const html = `<div itemscope itemtype="http://schema.org/Recipe">
    <div itemscope itemtype="https://schema.org/Comment"><meta itemprop="name" content="Yanlış başlık"><span itemprop="recipeIngredient">Yorum malzemesi</span></div>
    <meta itemprop="name" content="Deneme &amp; çorba">
    <meta itemprop="recipeYield" content="5"><span itemprop="prepTime" content="PT15M">15dk</span><meta itemprop="totalTime" content="PT45M">
    <ul><li itemprop="recipeIngredient" itemprop="recipeIngredient">2 domates</li><li itemprop="recipeIngredient">Yarım bardak süt</li></ul>
    <ol itemprop="recipeInstructions"><li>Doğra.</li><li><b>Pişir.</b></li></ol></div>
    <div><span itemprop="name">Başka tarif</span><span itemprop="totalTime" content="PT90M"></span></div>`;
  const [r] = extractRecipes(html, 'https://example.com/');
  assert.equal(r.title, 'Deneme & çorba'); assert.equal(r.ingredients, '2 domates\nYarım bardak süt');
  assert.equal(r.instructions, 'Doğra.\nPişir.'); assert.equal(r.minutes, '45'); assert.equal(r.servings, '5');
});
