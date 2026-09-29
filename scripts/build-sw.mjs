import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const files = await readdir('out', { recursive: true });
const assets = files.filter(f => /\.(html|css|js|svg|webmanifest)$/.test(f) && f !== 'sw.js').map(f => '/' + f.replaceAll('\\', '/'));
const hash = createHash('sha256');
for (const path of assets) hash.update(await readFile('out' + path));
const version = 'recipe-agent-' + hash.digest('hex').slice(0, 12);
await writeFile('out/sw.js', `
const CACHE=${JSON.stringify(version)};
const ASSETS=${JSON.stringify(['/', ...assets])};
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('recipe-agent-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);
 if(event.request.method!=='GET'||url.origin!==self.location.origin)return;
 if(event.request.mode==='navigate'){
   event.respondWith(fetch(event.request).catch(()=>caches.match('/')));return;
 }
 if(ASSETS.includes(url.pathname))event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request)));
});
`);
console.log('Offline shell ready:', assets.length, 'assets');
