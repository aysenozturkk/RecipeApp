'use client';

import { useEffect, useRef, useState } from 'react';
import { emptyFields, fieldsOf, IMAGE_LIMIT, matchesRecipe, parseText, restoreRecipe, safeUrl, updateRecipe, validateLibrary, type Recipe, type RecipeFields, type RecipeImage } from '../lib/recipes';
import { imageData, readRecipes, saveRecipes } from '../lib/storage';

const uid = () => crypto.randomUUID();
const date = (v: string) => new Date(v).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
async function withTimeout<T>(promise: Promise<T>, ms = 60000): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  try { return await Promise.race([promise, new Promise<T>((_, reject) => { timer = setTimeout(() => reject(new Error('İşlem zaman aşımına uğradı.')), ms); })]); }
  finally { clearTimeout(timer!); }
}
type Editor = { id?: string; fields: RecipeFields; images: RecipeImage[] };

export default function Home() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [ready, setReady] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [query, setQuery] = useState(''), [collection, setCollection] = useState(''), [favorites, setFavorites] = useState(false);
  const [selected, setSelected] = useState<string | null>(null), [editor, setEditor] = useState<Editor | null>(null);
  const [raw, setRaw] = useState(''), [note, setNote] = useState(''), [busy, setBusy] = useState(false), [ocrProgress, setOcrProgress] = useState('');
  const [mode, setMode] = useState<'link' | 'text' | 'image' | 'manual'>('link');
  const [discard, setDiscard] = useState(false);
  const [sort, setSort] = useState('recent');
  const initialEditor = useRef('');
  const dirty = !!editor && (JSON.stringify(editor) !== initialEditor.current || !!raw.trim());
  const [online, setOnline] = useState(true);
  const [urlCandidates, setUrlCandidates] = useState<RecipeFields[]>([]);
  const dialog = useRef<HTMLDialogElement>(null), noteInput = useRef<HTMLTextAreaElement>(null);
  const mutation = useRef(false), ocrWorker = useRef<import('tesseract.js').Worker | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const active = recipes.find(r => r.id === selected);

  useEffect(() => {
    readRecipes().then(r => { setRecipes(r); setReady(true); }).catch(() => setError('Cihazdaki kayıtlar okunamadı. Tarayıcı depolama iznini kontrol edip sayfayı yenile.'));
    setOnline(navigator.onLine);
    const status = () => setOnline(navigator.onLine);
    window.addEventListener('online', status); window.addEventListener('offline', status);
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') navigator.serviceWorker.register('/sw.js').catch(() => setNotice('Çevrimdışı hazırlık tamamlanamadı; uygulama çevrimiçi kullanılabilir.'));
    return () => { window.removeEventListener('online', status); window.removeEventListener('offline', status); void ocrWorker.current?.terminate(); };
  }, []);
  useEffect(() => { if (editor && dialog.current && !dialog.current.open) dialog.current.showModal(); }, [editor]);
  useEffect(() => { setNote(''); }, [selected]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (dirty || note.trim()) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, note]);

  async function commit(next: Recipe[]) {
    if (mutation.current) return false;
    mutation.current = true; setBusy(true); setError('');
    try { await saveRecipes(next, recipes); setRecipes(next); return true; }
    catch (e) { setError(e instanceof Error ? e.message : 'Kayıt yapılamadı. Depolama alanını kontrol et; girdiğin bilgiler ekranda duruyor.'); return false; }
    finally { mutation.current = false; setBusy(false); }
  }
  function navigate(id: string | null, favorite = favorites) {
    if (note.trim() && !window.confirm('Kaydedilmemiş notundan vazgeçilsin mi?')) return;
    setSelected(id); setFavorites(favorite);
  }
  function start(r?: Recipe) {
    setDiscard(false); setError(''); setNotice(''); setRaw(''); setUrlCandidates([]); setMode(r ? 'manual' : 'link');
    const next = { id: r?.id, fields: r ? fieldsOf(r) : emptyFields(), images: r ? [...r.images] : [] };
    initialEditor.current = JSON.stringify(next); setEditor(next);
  }
  function closeEditor() {
    if (busy || ocrProgress) return;
    if (dirty) { setDiscard(true); return; }
    discardEditor();
  }
  function discardEditor() {
    dialog.current?.close(); setEditor(null); setNotice(''); setError(''); setDiscard(false);
  }
  function field(key: keyof RecipeFields, value: string) { setEditor(e => e ? { ...e, fields: { ...e.fields, [key]: value } } : e); }
  async function saveEditor(e: React.FormEvent) {
    e.preventDefault(); if (!editor) return;
    try {
      const fields = { ...editor.fields, title: editor.fields.title.trim(), sourceUrl: safeUrl(editor.fields.sourceUrl) };
      if (!fields.title) throw new Error('Tarifine bir başlık ver.');
      const duplicate = recipes.find(r => r.id !== editor.id && fields.sourceUrl && r.sourceUrl === fields.sourceUrl);
      if (duplicate && !window.confirm(`Bu bağlantı “${duplicate.title}” tarifinde kayıtlı. Ayrı bir tarif olarak eklensin mi?`)) return;
      const now = new Date().toISOString();
      const current = recipes.find(r => r.id === editor.id);
      const recipe: Recipe = current ? updateRecipe(current, fields, editor.images) : { ...fields, id: uid(), createdAt: now, updatedAt: now, images: editor.images, notes: [], revisions: [], favorite: false };
      const next = current ? recipes.map(r => r.id === current.id ? recipe : r) : [recipe, ...recipes];
      if (await commit(next)) { setSelected(recipe.id); setEditor(null); dialog.current?.close(); setNotice('Tarif bu cihaza kaydedildi.'); }
    } catch (e) { setError((e as Error).message); }
  }
  function splitText() {
    if (!raw.trim()) return;
    if (editor && (editor.fields.title || editor.fields.ingredients || editor.fields.instructions) && !window.confirm('Başlık, malzeme ve adım alanları bu metinden yeniden oluşturulsun mu?')) return;
    const parsed = parseText(raw);
    setEditor(e => e ? { ...e, fields: { ...e.fields, title: parsed.title, ingredients: parsed.ingredients, instructions: parsed.instructions, sourceText: raw } } : e);
    setMode('manual');
    setNotice('Taslak hazır. Malzemeler / Yapılışı başlığı olmayan metni aşağıdaki alanlara kendin ayırabilirsin.');
  }
  async function addImages(files: FileList | null) {
    if (!files || !editor) return;
    if (files.length + editor.images.length > IMAGE_LIMIT) { setError(`Tarif başına en fazla ${IMAGE_LIMIT} görsel ekleyebilirsin.`); return; }
    setBusy(true); setError('');
    try {
      const images: RecipeImage[] = [];
      for (const f of Array.from(files)) images.push({ id: uid(), name: f.name, data: await imageData(f) });
      setEditor(e => e ? { ...e, images: [...e.images, ...images] } : e);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function importUrl() {
    if (!editor?.fields.sourceUrl) return;
    setError(''); setNotice(''); setUrlCandidates([]); setBusy(true);
    try {
      const url = safeUrl(editor.fields.sourceUrl);
      const response = await fetch('/api/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }), signal: AbortSignal.timeout(55000) });
      if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('Bağlantı okuma servisi bu yayında bağlı değil. Yerel önizlemede kullanılabilir; burada metin veya ekran görüntüsü ekleyebilirsin.');
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Bağlantı okunamadı.');
      setUrlCandidates(body.recipes); setNotice(body.warning || 'Bulunan tarifi seçip alanları kontrol et. Kaynak görselleri otomatik indirilmez.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Bağlantı okunamadı.'); }
    finally { setBusy(false); }
  }
  function applyCandidate(fields: RecipeFields) {
    if (editor && (editor.fields.title || editor.fields.ingredients || editor.fields.instructions) && !window.confirm('Başlık, malzemeler ve adımlar seçilen tarifle değiştirilsin mi?')) return;
    setEditor(e => e ? { ...e, fields: { ...fields, collection: e.fields.collection } } : e); setRaw(fields.sourceText); setUrlCandidates([]); setMode('manual');
  }
  async function recognize(files: FileList | null) {
    if (!files?.length || !editor) return;
    if (files.length > 5) { setError('Tek seferde en fazla 5 ekran görüntüsü seç.'); return; }
    const selectedFiles = Array.from(files);
    let abandoned = false;
    setError(''); setOcrProgress('Okuma motoru hazırlanıyor…');
    try {
      const { createWorker } = await import('tesseract.js');
      const worker = await withTimeout(createWorker(['tur', 'eng']).then(w => { if (abandoned) { void w.terminate(); throw new Error('İşlem iptal edildi.'); } return w; })); ocrWorker.current = worker;
      const texts: string[] = [];
      for (const [i, f] of selectedFiles.entries()) {
        setOcrProgress(`${i + 1}/${selectedFiles.length} görsel okunuyor…`);
        const data = await imageData(f);
        const result = await withTimeout(worker.recognize(data)); texts.push(result.data.text);
      }
      if (!texts.some(t => t.trim())) throw new Error('Görselde okunabilir yazı bulunamadı.');
      setRaw(previous => [previous, ...texts].filter(Boolean).join('\n\n'));
      setNotice('Metin okundu. Sırasını ve ölçüleri kontrol et, sonra “Alanlara ayır” düğmesine bas.');
    } catch { setError('Görsel okunamadı. İlk kullanımda internet gerekir. Daha net bir görsel dene veya metni yapıştır.'); }
    finally { abandoned = true; await ocrWorker.current?.terminate(); ocrWorker.current = null; setOcrProgress(''); }
  }
  async function addNote() {
    if (!active || !note.trim()) return;
    const next = { ...active, notes: [...active.notes, { id: uid(), text: note.trim(), date: new Date().toISOString() }] };
    if (await commit(recipes.map(r => r.id === next.id ? next : r))) { setNote(''); setNotice('Not eklendi.'); }
  }
  function exportBackup() {
    const blob = new Blob([JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), recipes })], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `tarif-defterim-${new Date().toISOString().slice(0, 10)}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice('Görselleri ve notları içeren yedek indirildi.');
  }
  async function importBackup(file?: File) {
    if (!file) return;
    try {
      if (file.size > 50 * 1024 * 1024) throw new Error('Bu ilk sürüm en fazla 50 MB yedek yükleyebilir.');
      const incoming = validateLibrary(JSON.parse(await file.text()));
      const known = new Set(recipes.map(r => r.id)), fresh = incoming.filter(r => !known.has(r.id));
      if (!fresh.length) { setNotice('Eklenecek yeni tarif yok; mevcut kayıtlar korundu.'); return; }
      if (!window.confirm(`${fresh.length} tarif eklenecek. Aynı kimlikli mevcut tarifler değişmeyecek. Devam edilsin mi?`)) return;
      if (await commit([...fresh, ...recipes])) setNotice(`${fresh.length} tarif yedekten eklendi.`);
    } catch (e) { setError(e instanceof Error ? e.message : 'Yedek okunamadı.'); }
  }
  async function share(r: Recipe) {
    const text = `${r.title}\n\nMalzemeler\n${r.ingredients}\n\nYapılışı\n${r.instructions}${r.sourceUrl ? `\n\nKaynak: ${r.sourceUrl}` : ''}`;
    try {
      if (navigator.share) await navigator.share({ title: r.title, text });
      else { await navigator.clipboard.writeText(text); setNotice('Tarif metni kopyalandı. Özel notlar ve görseller eklenmedi.'); }
    } catch (e) { if ((e as Error).name !== 'AbortError') setError('Paylaşım yapılamadı. Tarif metnini seçip kopyalayabilirsin.'); }
  }
  const collections = [...new Set(recipes.map(r => r.collection).filter(Boolean))].sort();
  const visible = recipes.filter(r => matchesRecipe(r, query, collection) && (!favorites || r.favorite)).sort((a, b) => sort === 'title' ? a.title.localeCompare(b.title, 'tr') : b.updatedAt.localeCompare(a.updatedAt));
  return <>
    <header className="topbar"><a href="/" className="brand"><span className="brand-mark">r.</span>tarif defterim</a><span className="device-label">{online ? 'Bu cihazdaki arşiv' : 'Çevrimdışı'}</span></header>
    <div className="workspace">
      <aside className="sidebar"><div className="sidebar-label">MUTFAĞIN</div><button className={!favorites ? 'nav active' : 'nav'} onClick={() => navigate(null, false)}>▤ <span>Tüm tarifler</span><b>{recipes.length}</b></button><button className={favorites ? 'nav active' : 'nav'} onClick={() => navigate(null, true)}>♡ <span>Favoriler</span><b>{recipes.filter(r => r.favorite).length}</b></button>
        <div className="sidebar-bottom"><p>Defterin güvende kalsın.</p><small>Kayıtların bu tarayıcıda tutulur. Güvende tutmak için yedeğini indir.</small><button disabled={!ready || busy} className="text-button" onClick={exportBackup}>↓ Yedek indir</button><button disabled={!ready || busy} className="text-button" onClick={() => fileInput.current?.click()}>↑ Yedek yükle</button><input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={e => { void importBackup(e.target.files?.[0]); e.target.value = ''; }} /></div>
      </aside>
      <main>
        {!editor && error && <div className="message error" role="alert">{error}<button aria-label="Hatayı kapat" onClick={() => setError('')}>×</button></div>}
        {!editor && notice && <div className="message" role="status">{notice}<button aria-label="Bildirimi kapat" onClick={() => setNotice('')}>×</button></div>}
        {!ready ? <p role="status">Tarif defterin açılıyor…</p> : active ? <>
          <button className="back" onClick={() => navigate(null)}>← Tariflerime dön</button>
          <div className="detail-top"><div><span className="eyebrow">{active.collection || 'TARİF DEFTERİM'}</span><h1>{active.title}</h1><p className="muted">{active.servings && `${active.servings} kişilik · `}{active.minutes && `${active.minutes} dk · `}{date(active.updatedAt)}</p></div><button className="primary" onClick={() => start(active)}>Tarifi düzenle</button></div>
          {!!active.images.length && <div className="gallery">{active.images.map((img, i) => <img key={img.id} src={img.data} alt={`${active.title} — görsel ${i + 1}`} />)}</div>}
          <div className="detail-actions"><button disabled={busy} onClick={() => void commit(recipes.map(r => r.id === active.id ? { ...r, favorite: !r.favorite } : r))}>{active.favorite ? '♥ Favorilerde' : '♡ Favoriye ekle'}</button><button onClick={() => void share(active)}>Tarifi paylaş</button>{active.sourceUrl && <a href={active.sourceUrl} target="_blank" rel="noopener noreferrer">Kaynağı aç ↗</a>}</div>
          {!active.ingredients && !active.instructions && <p className="hint">Bu kayıt henüz bir tarif taslağı. Kaynak bağlantısını açıp metnini ekleyebilir veya ekran görüntüsünü okutabilirsin.</p>}
          <div className="recipe-columns"><section className="paper"><h2>Malzemeler</h2>{active.ingredients ? <ul className="ingredients">{active.ingredients.split('\n').filter(Boolean).map((line, i) => <li key={i}>{line}</li>)}</ul> : <p className="muted">Henüz malzeme eklenmedi.</p>}</section><section className="paper"><h2>Hazırlanışı</h2>{active.instructions ? <ol className="steps">{active.instructions.split('\n').filter(Boolean).map((line, i) => <li key={i}>{line.replace(/^\d+[.)]\s*/, '')}</li>)}</ol> : <p className="muted">Henüz hazırlama adımı eklenmedi.</p>}</section></div>
          <section className="notes paper"><span className="eyebrow">BİR SONRAKİ SEFERE</span><h2>Kendi notlarım</h2><p className="muted">Değiştirdiğin ölçüler, küçük püf noktaları, bir dahaki sefere deneyeceklerin.</p>{active.notes.map(n => <article className="note" key={n.id}><small>{date(n.date)}</small><p>{n.text}</p><button disabled={busy} className="text-button danger" onClick={() => { if (window.confirm('Bu not silinsin mi?')) void commit(recipes.map(r => r.id === active.id ? { ...r, notes: r.notes.filter(x => x.id !== n.id) } : r)); }}>Notu sil</button></article>)}<label htmlFor="note">Yeni not</label><textarea ref={noteInput} id="note" value={note} onChange={e => setNote(e.target.value)} maxLength={10000} placeholder="Bir dahakine peyniri biraz azalt…" rows={3}/><button disabled={busy || !note.trim()} onClick={() => void addNote()} className="primary">Notu kaydet</button></section>
          {active.sourceText && <details className="paper"><summary>İçe aktarılan kaynak metni</summary><p className="prewrap">{active.sourceText}</p></details>}
          {!!active.revisions.length && <details className="paper"><summary>Değişiklik geçmişi ({active.revisions.length})</summary><p className="muted">Son 20 metin sürümü saklanır. Geri alma, mevcut notları ve görselleri korur.</p>{active.revisions.map((v, i) => <div className="revision" key={`${v.date}-${i}`}><span>{v.fields.title} · {date(v.date)}</span><button disabled={busy} onClick={() => { if (window.confirm('Tarif metni bu sürüme dönsün mü? Notlar ve görseller korunacak.')) void commit(recipes.map(r => r.id === active.id ? restoreRecipe(r, i) : r)); }}>Geri yükle</button></div>)}</details>}
          <button disabled={busy} className="text-button danger" onClick={async () => { if (window.confirm('Tarif, notları ve görselleriyle silinsin mi? Bu işlem geri alınamaz.')) if (await commit(recipes.filter(r => r.id !== active.id))) setSelected(null); }}>Tarifi sil</button>
        </> : <>
          <div className="page-heading"><div><span className="eyebrow">KİŞİSEL TARİF ARŞİVİN</span><h1>{favorites ? 'Favorilerim' : 'Tariflerim'}</h1><p>Sevdiğin tarifleri biriktir, kendi dokunuşunu ekle.</p></div><button disabled={busy} className="primary" onClick={() => start()}>＋ Tarif ekle</button></div>
          <div className="toolbar"><label className="search"><span aria-hidden="true">⌕</span><input aria-label="Tariflerde ara" value={query} onChange={e => setQuery(e.target.value)} placeholder="Tarif, malzeme veya not ara…" /></label><select aria-label="Koleksiyon seç" value={collection} onChange={e => setCollection(e.target.value)}><option value="">Tüm koleksiyonlar</option>{collections.map(c => <option key={c}>{c}</option>)}</select><select aria-label="Tarifleri sırala" value={sort} onChange={e => setSort(e.target.value)}><option value="recent">Son güncellenen</option><option value="title">Tarif adı: A–Z</option></select></div>
          <div className="list-heading"><h2>{favorites ? 'Favorilerin' : 'Tariflerin'}</h2><span>{visible.length} tarif</span>{(query || collection) && <button className="text-button" onClick={() => { setQuery(''); setCollection(''); }}>Filtreleri temizle</button>}</div>
          {!visible.length ? <section className="empty"><span className="empty-symbol" aria-hidden="true">✳</span><h2>{query || collection ? 'Eşleşen tarif bulunamadı.' : favorites ? 'Favorilerin burada biriksin.' : 'İlk sayfa senin.'}</h2><p>{recipes.length ? 'Aramanı veya filtrelerini değiştir; dilersen yeni bir tarif ekle.' : 'Kaydettiğin tariflere kendi notlarını ve fotoğraflarını ekle. Hepsi aynı defterde kalsın.'}</p>{query || collection ? <button onClick={() => { setQuery(''); setCollection(''); }}>Filtreleri temizle</button> : favorites ? <button onClick={() => navigate(null, false)}>Tüm tariflere dön</button> : <button className="primary" onClick={() => start()}>İlk tarifimi ekle</button>}<span className="empty-foot">Ücretsiz · Hesap gerekmez · Bu cihazda saklanır</span></section> : <div className="recipe-grid">{visible.map(r => <button className="recipe-card" key={r.id} onClick={() => navigate(r.id)}>{r.images[0] ? <img src={r.images[0].data} alt="" /> : <div className="recipe-cover"><span>{r.title.slice(0, 1).toLocaleUpperCase('tr-TR')}</span><small>{r.collection || 'MUTFAĞIMDAN'}</small></div>}<div className="card-body"><span className="card-category">{r.collection || 'Koleksiyonsuz'}{r.favorite && ' · ♥'}</span><h3>{r.title}</h3><p>{r.servings ? `${r.servings} kişilik` : r.sourceUrl ? 'Kaynak bağlantısı kayıtlı' : 'Kendi tarifim'}{r.minutes && ` · ${r.minutes} dk`}</p><div className="card-footer"><span>{r.notes.length} not · {r.images.length} görsel</span><span>↗</span></div></div></button>)}</div>}
        </>}
      </main>
    </div>
    {editor && <dialog ref={dialog} onCancel={e => { e.preventDefault(); closeEditor(); }} aria-labelledby="editor-title"><form onSubmit={saveEditor}>
      <div className="dialog-heading"><div><span className="eyebrow">TARİF DEFTERİM</span><h2 id="editor-title">{editor.id ? 'Tarifini düzenle' : 'Yeni bir tarif'}</h2></div><button type="button" disabled={busy || !!ocrProgress} aria-label="Düzenleyiciyi kapat" onClick={closeEditor}>×</button></div>
      <div className="dialog-content">
      {error && <p role="alert" className="message error">{error}</p>}{notice && <p role="status" className="hint">{notice}</p>}
      <fieldset disabled={busy || !!ocrProgress}>
        <div className="entry-modes" role="group" aria-label="Tarif ekleme yöntemi">{([['link', '↗', 'Bağlantı'], ['text', '≡', 'Metin'], ['image', '▧', 'Ekran görüntüsü'], ['manual', '✎', 'Elle düzenle']] as const).map(([value, icon, label]) => <button type="button" key={value} aria-pressed={mode === value} onClick={() => { setMode(value); setError(''); }}><span aria-hidden="true">{icon}</span>{label}</button>)}</div>
        {mode === 'link' && <section className="import-panel"><h3>Bir bağlantı, yeni bir tarif.</h3><p className="muted">Tarif sitesinden veya herkese açık Instagram paylaşımından bağlantıyı yapıştır.</p><label htmlFor="import-url">Tarif bağlantısı</label><input autoFocus id="import-url" type="url" value={editor.fields.sourceUrl} onChange={e => field('sourceUrl', e.target.value)} maxLength={3000} placeholder="https://…"/><button className="primary import-submit" type="button" disabled={!editor.fields.sourceUrl.trim()} onClick={() => void importUrl()}>{busy ? 'Bağlantı okunuyor…' : 'Tarifi bul →'}</button><p className="field-help">Instagram açıklamasındaki tarif okunur. Videonun sesi okunmaz. Erişilemeyen paylaşımları metin veya ekran görüntüsüyle ekleyebilirsin.</p>{urlCandidates.length > 0 && <div className="candidates"><strong>Bulunan tarifler</strong>{urlCandidates.map((r, i) => <button key={i} type="button" onClick={() => applyCandidate(r)}><b>{r.title}</b><span>{r.ingredients.split('\n').filter(Boolean).length} malzeme satırı · {r.instructions.split('\n').filter(Boolean).length} adım</span><span>Taslağa aktar →</span></button>)}</div>}</section>}
        {(mode === 'text' || mode === 'image') && <section className="import-panel"><h3>{mode === 'image' ? 'Ekran görüntüsünü tarife dönüştür.' : 'Tarif metnini buraya bırak.'}</h3><p className="muted">Malzemeler ve yapılış bölümünü birlikte ekle. Kaydetmeden önce ölçüleri kontrol edebilirsin.</p>{mode === 'image' && <label className="upload-button">Ekran görüntüsü seç<input aria-label="Tarif ekran görüntüsü seç" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={e => { void recognize(e.target.files); e.target.value = ''; }} /></label>}<label htmlFor="raw">{mode === 'image' ? 'Okunan metin' : 'Kaynak metin'}</label><textarea id="raw" value={raw} onChange={e => setRaw(e.target.value)} rows={7} maxLength={100000} placeholder={'Kabak graten\nMalzemeler\n3 kabak\nYapılışı\n…'} /><button className="primary import-submit" type="button" onClick={splitText} disabled={!raw.trim()}>Taslağı oluştur →</button><small>{mode === 'image' ? 'En fazla 5 görsel. Yazılar cihazında okunur; ilk kullanımda internet gerekir.' : 'İstersen telefon klavyendeki mikrofonla dikte edebilirsin.'}</small></section>}
        <div hidden={mode !== 'manual'}>
        <div className="section-heading"><h3>Tarifin detayları</h3><p className="muted">Başlık zorunlu, diğer alanları dilediğin zaman tamamlayabilirsin.</p></div>
        <label htmlFor="title">Tarif adı *</label><input id="title" value={editor.fields.title} onChange={e => field('title', e.target.value)} required={mode === 'manual'} maxLength={160} placeholder="Örneğin, fırında kabak graten" />
        <label htmlFor="url">Kaynak bağlantısı <span className="optional">· isteğe bağlı</span></label><input id="url" type="url" value={editor.fields.sourceUrl} onChange={e => field('sourceUrl', e.target.value)} maxLength={3000} placeholder="https://…"/>
        <div className="form-row"><div><label htmlFor="servings">Kaç kişilik?</label><input id="servings" type="number" min="1" max="1000" value={editor.fields.servings} onChange={e => field('servings', e.target.value)} /></div><div><label htmlFor="minutes">Toplam süre (dk)</label><input id="minutes" type="number" min="1" max="10000" value={editor.fields.minutes} onChange={e => field('minutes', e.target.value)} /></div></div>
        <label htmlFor="collection">Koleksiyon</label><input id="collection" list="collections" value={editor.fields.collection} maxLength={100} onChange={e => field('collection', e.target.value)} placeholder="Akşam yemekleri, Tatlılar…"/><datalist id="collections">{collections.map(c => <option key={c} value={c}/>)}</datalist>
        <label htmlFor="ingredients">Malzemeler</label><textarea id="ingredients" value={editor.fields.ingredients} onChange={e => field('ingredients', e.target.value)} rows={5} maxLength={100000} placeholder="Her satıra bir malzeme yaz."/>
        <label htmlFor="instructions">Hazırlanışı</label><textarea id="instructions" value={editor.fields.instructions} onChange={e => field('instructions', e.target.value)} rows={6} maxLength={100000} placeholder="Her satıra bir hazırlama adımı yaz."/>
        <label>Fotoğraflar</label><p className="field-help">İlk görsel kapak olur. En fazla 8 görsel; yüklerken boyutları küçültülür.</p><div className="image-editor">{editor.images.map((img, i) => <div key={img.id}><img src={img.data} alt={img.name}/><div><button type="button" disabled={i === 0} onClick={() => setEditor(e => e ? { ...e, images: [img, ...e.images.filter(x => x.id !== img.id)] } : e)}>{i === 0 ? 'Kapak' : 'Kapak yap'}</button><button aria-label={`${img.name} görselini kaldır`} type="button" onClick={() => setEditor(e => e ? { ...e, images: e.images.filter(x => x.id !== img.id) } : e)}>×</button></div></div>)}</div>
        <label className="upload-button">＋ Görsel ekle<input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={e => { void addImages(e.target.files); e.target.value = ''; }} /></label>
        </div>
      </fieldset>
      {ocrProgress && <p role="status" className="hint">{ocrProgress} Bu ekranı açık tut.</p>}
      </div>
      {discard && <div className="discard-panel" role="alert"><strong>Değişikliklerin henüz kaydedilmedi.</strong><p>Çıkarsan bu taslaktaki değişiklikler kaybolacak.</p><div><button type="button" onClick={() => setDiscard(false)}>Düzenlemeye devam et</button><button type="button" className="danger" onClick={discardEditor}>Değişikliklerden vazgeç</button></div></div>}
      <div className="dialog-footer"><span>{busy ? 'İşleniyor…' : mode === 'manual' ? 'Yalnızca bu cihazda saklanır.' : 'Önce tarifini bir taslağa dönüştür.'}</span><button type="button" disabled={busy || !!ocrProgress} onClick={closeEditor}>Vazgeç</button>{mode === 'manual' && <button className="primary" disabled={busy || !!ocrProgress} type="submit">{busy ? 'Kaydediliyor…' : 'Tarifi kaydet'}</button>}</div>
    </form></dialog>}
  </>;
}
