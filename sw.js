const C='cm17';
self.addEventListener('install',e=>e.waitUntil(caches.open(C).then(c=>Promise.all(['./','index.html','manifest.webmanifest','icon-192.png','icon-512.png','jszip.min.js','pptx.js','pdf.min.mjs','pdf.worker.min.mjs'].map(u=>c.add(u).catch(()=>0)))).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!=C).map(x=>caches.delete(x)))).then(()=>clients.claim())));
self.addEventListener('fetch',e=>{if(e.request.method!='GET')return;e.respondWith(fetch(e.request).then(n=>{const cp=n.clone();caches.open(C).then(c=>c.put(e.request,cp));return n}).catch(()=>caches.match(e.request)))});
