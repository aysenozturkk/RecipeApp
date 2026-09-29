import { openDB } from 'idb';
import { type Recipe, validateLibrary } from './recipes';
const db = () => openDB('recipe-agent', 1, { upgrade(database) { database.createObjectStore('library'); } });
export async function readRecipes(): Promise<Recipe[]> {
  const database = await db();
  const data = await database.get('library', 'recipes');
  return data ? validateLibrary({ version: 1, recipes: data }) : [];
}
export async function saveRecipes(recipes: Recipe[], previous: Recipe[]) {
  const database = await db();
  const tx = database.transaction('library', 'readwrite');
  const actual = (await tx.store.get('recipes')) || [];
  if (JSON.stringify(actual) !== JSON.stringify(previous)) {
    tx.abort();
    await tx.done.catch(() => {});
    throw new Error('Kayıtlar başka bir sekmede değişti. Girdiğin metni kopyalayıp sayfayı yenile; önceki kayıtlar korunuyor.');
  }
  await tx.store.put(recipes, 'recipes'); await tx.done;
}

export async function imageData(file: File): Promise<string> {
  if (file.size > 15 * 1024 * 1024) throw new Error('Görsel başına en fazla 15 MB yükleyebilirsin.');
  const url = URL.createObjectURL(file);
  try {
    const image = new Image(); image.src = url;
    try { await image.decode(); } catch { throw new Error('Görsel okunamadı. JPEG, PNG veya WebP olarak tekrar seç.'); }
    const scale = Math.min(1, 1400 / Math.max(image.width, image.height));
    const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(image.width * scale)); canvas.height = Math.max(1, Math.round(image.height * scale));
    const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('Görsel işlenemedi.');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const data = canvas.toDataURL('image/jpeg', .8);
    if (data.length > 2000000) throw new Error('Görsel çok büyük. Daha küçük bir görsel seç.');
    return data;
  } finally { URL.revokeObjectURL(url); }
}
