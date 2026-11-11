/* کلیپ‌ساز — افزونه‌ها: متن/تصویر روی صفحه + انیمیشن، ساخت ارائه با هوش مصنوعی، تصویرهای داخل PDF */
(function(){
'use strict';
const Q=(s,r)=>(r||document).querySelector(s);
const FONT='Vazirmatn,Tahoma,sans-serif';
const fa=n=>String(n).replace(/\d/g,d=>'۰۱۲۳۴۵۶۷۸۹'[d]);
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const AR=/[؀-ۿ]/;
const ANS=[['none','بدون انیمیشن'],['fade','محو شدن'],['rise','بالا آمدن'],['zoom','بزرگ شدن'],['slide','لغزیدن از چپ'],['bounce','پرش'],['flip','چرخش'],['type','تایپ حرف‌به‌حرف'],['lines','خط‌به‌خط']];

// ---- CSS ----
const st=document.createElement('style');st.textContent=`
.xs{position:fixed;left:0;right:0;bottom:0;z-index:55;background:var(--pn);border-top:1px solid var(--ln);border-radius:18px 18px 0 0;box-shadow:0 -8px 28px #0007;max-height:52vh;overflow:auto;padding:10px 12px 14px;font-size:13px;direction:rtl;display:flex;flex-direction:column;gap:8px}
.xm{position:fixed;inset:0;z-index:60;background:#000b;display:flex;align-items:center;justify-content:center;padding:10px;direction:rtl}
.xm>.xb{background:var(--pn);color:var(--tx);border:1px solid var(--ln);border-radius:18px;padding:14px;max-width:560px;width:100%;max-height:92vh;overflow:auto;display:flex;flex-direction:column;gap:8px;font-size:14px;line-height:1.8}
.xr{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
.xs label,.xb label{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.xs input[type=range]{flex:1;min-width:90px;accent-color:var(--ac)}
.xs textarea,.xb textarea,.xb input[type=text],.xb input[type=password],.xb input[type=number],.xs select,.xb select{background:var(--bg);color:var(--tx);border:1px solid var(--ln);border-radius:10px;padding:6px 8px;font:inherit;width:100%;box-sizing:border-box}
.xb input[type=number]{width:70px}
.xs button,.xb button{font:inherit;padding:6px 11px;border-radius:10px;border:1px solid var(--ln);background:var(--bg);color:var(--tx);min-height:34px}
.xs button.on,.xb button.on{background:var(--ac);color:#06201b;border-color:var(--ac)}
.xg{display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:6px}
.xg .it{position:relative;border:2px solid var(--ln);border-radius:10px;overflow:hidden;background:#fff;min-height:70px;font-size:10px;color:#222;cursor:pointer}
.xg .it.sel{border-color:var(--ac);box-shadow:0 0 0 2px var(--ac)}
.xg .it img{width:100%;height:84px;object-fit:contain;display:block}
.xg .it span{display:block;text-align:center;padding:1px}
.xc{border:1px solid var(--ln);border-radius:12px;padding:8px;display:flex;flex-direction:column;gap:6px}
`;document.head.appendChild(st);

// ================= موتور انیمیشن و رسم کادرها =================
const ANI=window.ANI={it:null,t0:0,pv:0};
window.ovPlay=it=>{ANI.it=it;ANI.t0=performance.now()};
window.ovPreview=it=>{ovPlay(it);ANI.pv=1;dirty=1};
function lay(g,o){const pad=o.bc?18:0,iw=Math.max(40,o.w-2*pad),k=o.t+'|'+o.s+'|'+iw+'|'+(o.bd?1:0);if(o._k===k)return o._l;
 g.font=(o.bd?'bold ':'')+o.s+'px '+FONT;g.direction=AR.test(o.t||'')?'rtl':'ltr';const L=[];
 String(o.t||'').split('\n').forEach((para,pi)=>{let cu='';for(const w of para.split(/\s+/).filter(Boolean)){const t=cu?cu+' '+w:w;if(cu&&g.measureText(t).width>iw){L.push({t:cu,p:pi});cu=w}else cu=t}L.push({t:cu,p:pi})});
 o._k=k;o._l=L;o._h=L.length*o.s*1.55;return L}
function boxH(g,o){if(o.k=='i'){const im=imOf(o);return im&&im.naturalWidth?o.w*im.naturalHeight/im.naturalWidth:o.w*.6}lay(g,o);return o._h+(o.bc?36:0)}
function imOf(o){if(!o._im){const im=new Image();im.onload=()=>{dirty=1};im.src=o.u;o._im=im}return o._im}
function one(g,o,act,now){
 let A=null,busy=0;const an=o.an;
 if(act&&an&&an!='none'){const d=(o.ad||.8)*1000,e=now-ANI.t0-(o.ae||0)*1000,np=o.k=='i'?1:String(o.t||'').split('\n').filter(x=>x.trim()).length,tot=an=='lines'?Math.max(1,np)*d:d;
  if(e<tot+60)busy=1;if(e<0)return 1;const p=Math.min(1,e/d);A={e,d,p,q:1-Math.pow(1-p,3)}}
 const h=boxH(g,o);let alpha=1;
 g.save();
 if(A){const q=A.q,cx0=o.x+o.w/2,cy0=o.y+h/2;
  if(an=='fade')alpha=q;
  else if(an=='rise'){g.translate(0,(1-q)*80);alpha=q}
  else if(an=='zoom'){g.translate(cx0,cy0);g.scale(.75+.25*q,.75+.25*q);g.translate(-cx0,-cy0);alpha=q}
  else if(an=='slide'){g.translate((1-q)*-320,0);alpha=q}
  else if(an=='bounce'){const t=A.p,b=1+2.7*Math.pow(t-1,3)+1.7*Math.pow(t-1,2);alpha=Math.min(1,t*3);g.translate(0,(1-b)*160)}
  else if(an=='flip'){g.translate(cx0,0);g.scale(Math.max(.02,q),1);g.translate(-cx0,0)}}
 g.globalAlpha*=alpha;
 if(o.k=='i'){const im=imOf(o);if(im.complete&&im.naturalWidth){g.drawImage(im,o.x,o.y,o.w,h)}}
 else{const L=lay(g,o),pad=o.bc?18:0,rtl=AR.test(o.t||''),al=o.al||(rtl?'right':'left');
  if(o.bc){g.fillStyle=o.bc;g.beginPath();(g.roundRect||g.rect).call(g,o.x,o.y,o.w,h,16);g.fill()}
  g.font=(o.bd?'bold ':'')+o.s+'px '+FONT;g.direction=rtl?'rtl':'ltr';g.textBaseline='top';g.fillStyle=o.c||'#fff';g.textAlign=al;
  const ax=al=='right'?o.x+o.w-pad:al=='center'?o.x+o.w/2:o.x+pad;
  let left=Infinity,lp=A&&an=='lines'?Math.floor(A.e/A.d):1e9;
  if(A&&an=='type')left=Math.floor(A.p*String(o.t||'').replace(/\n/g,'').length);
  if(!o.bc){g.shadowColor='#000a';g.shadowBlur=o.s*.25}
  for(let j=0;j<L.length;j++){const l=L[j];if(l.p>lp)break;let tx=l.t;if(left!=Infinity){if(left<=0)break;if(tx.length>left){tx=tx.slice(0,left);left=0}else left-=tx.length}
   g.fillText(tx,ax,o.y+pad+j*o.s*1.55+o.s*.15)}}
 g.restore();return busy}
window.ovPaint=function(g,it,live){const a=it.ov;if(!a||!a.length)return;
 const act=live&&ANI.it===it&&(rec||ANI.pv),now=performance.now();let busy=0;
 g.save();if(live)g.translate(0,it.y);
 for(const o of a)busy|=one(g,o,act,now);
 g.restore();
 if(act){if(busy)dirty=1;else ANI.pv=0}};
window.ovDraw=it=>ovPaint(cx,it,1);

// ================= ویرایشگر کادرها =================
let ovSheet=null;
window.ovDlg=function(){
 const s=secs[cur];if(!s||!s.items.length||s.kind=='vid'){toast('اول PDF، پاورپوینت یا عکس باز کن');return}
 if(ovSheet){ovSheet.remove();ovSheet=null}
 let it=itemAt(s,(innerHeight/2-V.y)/V.s),sel=0;
 const o=document.createElement('div');o.className='xs';document.body.appendChild(o);ovSheet=o;
 const idx=()=>s.items.indexOf(it);
 const show=()=>{V.s=Math.min(innerWidth/W,V.s);V.x=0;V.y=-it.y*V.s+6;cl();dirty=1};
 const chg=()=>{dirty=1;scheduleSave()};
 function mkBox(k){it.ov=it.ov||[];const b={k,x:Math.round(W*.1),y:Math.round(Math.min(it.h*.1,200)),w:Math.round(W*.8),an:'rise',ad:.8,ae:0};
  if(k=='t')Object.assign(b,{t:'متن را اینجا بنویس',s:56,c:'#ffffff',bc:'#000000b8',bd:1});
  it.ov.push(b);sel=it.ov.length-1;return b}
 function render(){
  const a=it.ov||[];if(sel>=a.length)sel=a.length-1;const b=a[sel];
  o.innerHTML=`<div class="xr"><b>🅰 صفحه ${fa(idx()+1)} از ${fa(s.items.length)}</b><button id="xp">‹</button><button id="xn">›</button><span style="flex:1"></span><button id="xx">✕ بستن</button></div>
  <div class="xr"><button id="xat">➕ متن</button><label class="xb" style="display:inline-flex"><span style="padding:6px 11px;border:1px solid var(--ln);border-radius:10px;background:var(--bg)">➕ عکس</span><input type="file" accept="image/*" id="xai" hidden></label><button id="xpv">▶ پیش‌نمایش انیمیشن</button><button id="xdl">🗑 حذف کادر</button><button id="xdp">⧉ تکرار</button></div>
  <div class="xr">${a.length?a.map((q,k)=>`<button data-k="${k}" class="${k==sel?'on':''}">${q.k=='i'?'🖼':'T'} ${fa(k+1)}${q.k!='i'?' '+esc((q.t||'').slice(0,8)):''}</button>`).join(''):'<small>هنوز کادری روی این صفحه نیست؛ «➕ متن» یا «➕ عکس» را بزن.</small>'}</div>
  ${b?`<div class="xc">
   ${b.k=='t'?`<textarea id="xt" rows="3">${esc(b.t)}</textarea>
   <label>اندازه <input type="range" id="xsz" min="16" max="160" value="${b.s}"> <input type="color" id="xc" value="${(b.c||'#ffffff').slice(0,7)}"> <label><input type="checkbox" id="xbd" ${b.bd?'checked':''}> پررنگ</label></label>
   <label><input type="checkbox" id="xbg" ${b.bc?'checked':''}> زمینه‌ی کادر <input type="color" id="xbc" value="${(b.bc||'#000000').slice(0,7)}"> <select id="xal" style="width:auto"><option value="">تراز خودکار</option><option value="right" ${b.al=='right'?'selected':''}>راست</option><option value="center" ${b.al=='center'?'selected':''}>وسط</option><option value="left" ${b.al=='left'?'selected':''}>چپ</option></select></label>`:''}
   <label>عرض <input type="range" id="xw" min="120" max="${W}" value="${b.w}"></label>
   <label>چپ↔راست <input type="range" id="xx1" min="0" max="${W}" value="${b.x}"></label>
   <label>بالا↔پایین <input type="range" id="xy1" min="0" max="${Math.round(it.h)}" value="${b.y}"></label>
   <hr style="width:100%;border:0;border-top:1px solid var(--ln)">
   <label>انیمیشن <select id="xan" style="width:auto;flex:1">${ANS.map(([v,t])=>`<option value="${v}" ${((b.an||'none')==v)?'selected':''}>${t}</option>`).join('')}</select></label>
   <label>مدت <input type="range" id="xad" min="0.2" max="5" step="0.1" value="${b.ad||.8}"><b id="xadv">${fa(b.ad||.8)}</b> ثانیه</label>
   <label>تأخیر <input type="range" id="xae" min="0" max="15" step="0.1" value="${b.ae||0}"><b id="xaev">${fa(b.ae||0)}</b> ثانیه</label>
   <div class="xr"><button id="xall">همین انیمیشن روی همه‌ی کادرهای همه‌ی صفحه‌ها</button></div></div>`:''}`;
  const g=id=>Q('#'+id,o);
  g('xx').onclick=()=>{o.remove();ovSheet=null;ANI.pv=0;dirty=1};
  const nav=d=>{const n=idx()+d;if(n<0||n>=s.items.length)return;it=s.items[n];sel=0;show();render()};g('xp').onclick=()=>nav(-1);g('xn').onclick=()=>nav(1);
  g('xat').onclick=()=>{mkBox('t');chg();render();ovPreview(it)};
  g('xai').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{const bm=await createImageBitmap(f),sc=Math.min(1,1400/bm.width),c=document.createElement('canvas');c.width=Math.round(bm.width*sc);c.height=Math.round(bm.height*sc);c.getContext('2d').drawImage(bm,0,0,c.width,c.height);
    const b=mkBox('i');b.u=c.toDataURL(/png|gif|webp/i.test(f.type)?'image/png':'image/jpeg',.88);b.w=Math.round(Math.min(W*.5,it.h*.7*bm.width/bm.height));b.an='fade';chg();render();ovPreview(it)}catch{toast('این عکس باز نشد')}};
  g('xpv').onclick=()=>{ovPreview(it)};
  g('xdl').onclick=()=>{if(b){a.splice(sel,1);sel=Math.max(0,sel-1);chg();render()}};
  g('xdp').onclick=()=>{if(b){const c={...b,_im:undefined,_k:undefined,_l:undefined,x:b.x+30,y:b.y+30};a.push(c);sel=a.length-1;chg();render()}};
  o.querySelectorAll('[data-k]').forEach(x=>x.onclick=()=>{sel=+x.dataset.k;render()});
  if(!b)return;
  const bind=(id,fn,ev)=>{const e=g(id);if(e)e[ev||'oninput']=()=>{fn(e);chg()}};
  bind('xt',e=>{b.t=e.value});bind('xsz',e=>{b.s=+e.value});bind('xc',e=>{b.c=e.value});bind('xbd',e=>{b.bd=e.checked?1:0},'onchange');
  bind('xbg',e=>{b.bc=e.checked?(g('xbc').value+'b8'):''},'onchange');bind('xbc',e=>{if(b.bc)b.bc=e.value+'b8'});bind('xal',e=>{b.al=e.value},'onchange');
  bind('xw',e=>{b.w=+e.value});bind('xx1',e=>{b.x=+e.value});bind('xy1',e=>{b.y=+e.value});
  bind('xan',e=>{b.an=e.value;ovPreview(it)},'onchange');
  bind('xad',e=>{b.ad=+e.value;g('xadv').textContent=fa(e.value)});bind('xae',e=>{b.ae=+e.value;g('xaev').textContent=fa(e.value)});
  ['xad','xae'].forEach(id=>{const e=g(id);if(e)e.onchange=()=>ovPreview(it)});
  g('xall')&&(g('xall').onclick=()=>{s.items.forEach(p=>(p.ov||[]).forEach(q=>{q.an=b.an;q.ad=b.ad;q.ae=b.ae}));chg();toast('روی همه‌ی کادرها اعمال شد')});
 }
 show();render();
};

// ================= خواندن متن و تصویر فایل =================
const AR2=/[؀-ۿﭐ-﷿ﹰ-﻿]/;
const FIN=[0xFE8F,0xFE90,0xFE95,0xFE96,0xFE99,0xFE9A,0xFE9D,0xFE9E,0xFEA1,0xFEA2,0xFEA5,0xFEA6,0xFEB1,0xFEB2,0xFEB5,0xFEB6,0xFEB9,0xFEBA,0xFEBD,0xFEBE,0xFEC1,0xFEC2,0xFEC5,0xFEC6,0xFEC9,0xFECA,0xFECD,0xFECE,0xFED1,0xFED2,0xFED5,0xFED6,0xFED9,0xFEDA,0xFEDD,0xFEDE,0xFEE1,0xFEE2,0xFEE5,0xFEE6,0xFEE9,0xFEEA,0xFEF1,0xFEF2,0xFB56,0xFB57,0xFB7A,0xFB7B,0xFB8E,0xFB8F,0xFB92,0xFB93,0xFBFC,0xFBFD].map(c=>String.fromCharCode(c)).join('');
const ZWRE=new RegExp('(['+FIN+'])(?=[\\u0621-\\u06FF\\uFB50-\\uFEFF])','g');
const zw=t=>t.replace(ZWRE,'$1‌');
function pdfLines(items){
 const its=items.filter(t=>t.str!=null&&t.str!=='').map(t=>({s:t.str.replace(/[\x00-\x08\x0b-\x1f]/g,' '),l:t.transform[4],r:t.transform[4]+Math.abs(t.width||0),y:t.transform[5],h:Math.abs(t.height||t.transform[3]||10)||10}));
 if(!its.length)return'';its.sort((a,b)=>b.y-a.y);const lines=[];
 its.forEach(t=>{const L=lines[lines.length-1];if(L&&Math.abs(L.y-t.y)<Math.max(3,t.h*.45))L.a.push(t);else lines.push({y:t.y,a:[t],h:t.h})});
 const out=[];
 lines.forEach(L=>{const all=L.a.map(t=>t.s).join(''),rtl=(all.match(new RegExp(AR2.source,'g'))||[]).length>all.replace(/\s/g,'').length*.3;
  let a=L.a.slice().sort((p,q)=>rtl?q.l-p.l:p.l-q.l);
  if(rtl){const res=[];let grp=[];const flush=()=>{if(grp.length){grp.reverse();res.push(...grp);grp=[]}};a.forEach(t=>{if(!AR2.test(t.s)&&/[0-9A-Za-z]/.test(t.s))grp.push(t);else{flush();res.push(t)}});flush();a=res}
  let txt='',prev=null;a.forEach(t=>{const str=t.s;if(prev){const gap=rtl?(prev.l-t.r):(t.l-prev.r),sp=/^\s/.test(str)||/\s$/.test(prev.s);if(!sp&&gap>t.h*.22)txt+=' '}txt+=str;prev=t});
  out.push({t:zw(txt).replace(/\s+/g,' ').trim(),y:L.y,h:L.h})});
 const paras=[];let cu='',py=null,ph=null;
 out.forEach(L=>{if(!L.t)return;if(py!==null&&((py-L.y)>Math.max(ph,L.h)*1.9||Math.abs(L.h-ph)/ph>.15)){paras.push(cu);cu=''}cu+=(cu?' ':'')+L.t;py=L.y;ph=L.h});
 if(cu)paras.push(cu);return paras.join('\n').normalize('NFKC')}
async function pageText(it){const d=it.pdf;if(!d)return'';try{if(d.text)return String(await d.text(it.no)||'');const pg=await d.getPage(it.no),tc=await pg.getTextContent();return pdfLines(tc.items)}catch{return''}}

// ---- ساخت مودال ----
function modal(html){const m=document.createElement('div');m.className='xm';m.innerHTML='<div class="xb">'+html+'</div>';document.body.appendChild(m);return m}
function saveBlobAs(bl,name){const a=document.createElement('a');a.href=URL.createObjectURL(bl);a.download=name;a.style.display='none';document.body.appendChild(a);a.click();setTimeout(()=>{a.remove();URL.revokeObjectURL(a.href)},8000)}

// ================= تصویرهای داخل PDF / پاورپوینت =================
function objToCanvas(o){const w=o.width,h=o.height,sc=Math.min(1,1800/Math.max(w,h)),c=document.createElement('canvas');c.width=Math.max(1,Math.round(w*sc));c.height=Math.max(1,Math.round(h*sc));const g=c.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,c.width,c.height);
 if(o.bitmap){g.drawImage(o.bitmap,0,0,c.width,c.height);return c}
 if(!o.data)return null;const id=new ImageData(w,h),d=id.data,s=o.data;
 if(o.kind===3&&s.length>=w*h*4)d.set(s.subarray(0,w*h*4));
 else if(o.kind===2&&s.length>=w*h*3){for(let a=0,j=0;a<w*h;a++,j+=3){d[a*4]=s[j];d[a*4+1]=s[j+1];d[a*4+2]=s[j+2];d[a*4+3]=255}}
 else if(o.kind===1){const rb=(w+7)>>3;for(let y=0;y<h;y++)for(let x=0;x<w;x++){const v=(s[y*rb+(x>>3)]>>(7-(x&7)))&1?255:0,k=(y*w+x)*4;d[k]=d[k+1]=d[k+2]=v;d[k+3]=255}}
 else return null;
 const t=document.createElement('canvas');t.width=w;t.height=h;t.getContext('2d').putImageData(id,0,0);g.drawImage(t,0,0,c.width,c.height);return c}
async function extractImages(sec,add,say,stop){
 const items=sec.items;let doc=items[0]&&items[0].pdf;if(!doc)return;
 if(doc.deck){const ms=await doc.deck.media();let n=0;for(const m of ms){if(stop())break;say('در حال خواندن تصویرها… '+fa(++n)+' از '+fa(ms.length));let bm;try{bm=await createImageBitmap(m.blob)}catch{continue}if(bm.width<80||bm.height<80)continue;add({blob:m.blob,w:bm.width,h:bm.height,label:'اسلاید '+m.slides.map(x=>fa(x+1)).join('، ')});await wait(0)}return}
 const OPS=_pj&&_pj.OPS;if(!OPS)return;const seen={};let cnt=0;
 for(let p=1;p<=doc.numPages&&!stop();p++){say('در حال جست‌وجوی تصویر… صفحه '+fa(p)+' از '+fa(doc.numPages));const pg=await doc.getPage(p),ops=await pg.getOperatorList();
  for(let k=0;k<ops.fnArray.length&&!stop();k++){const fn=ops.fnArray[k];if(fn!==OPS.paintImageXObject&&fn!==OPS.paintInlineImageXObject&&fn!==OPS.paintImageXObjectRepeat)continue;
   const ar=ops.argsArray[k];let obj;
   if(fn===OPS.paintInlineImageXObject)obj=ar[0];else{const id=ar[0];if(seen[id])continue;seen[id]=1;obj=await new Promise(res=>{const store=String(id).indexOf('g_')==0?pg.commonObjs:pg.objs;let ok=false;try{store.get(id,v=>{ok=true;res(v)})}catch{res(null)}setTimeout(()=>{if(!ok)res(null)},4000)})}
   if(!obj||!(obj.width>=100&&obj.height>=100))continue;const c=objToCanvas(obj);if(!c)continue;
   const blob=await new Promise(r=>c.toBlob(r,'image/jpeg',.9));if(!blob)continue;add({blob,w:obj.width,h:obj.height,label:'صفحه '+fa(p)});if(++cnt>=400)return}}}
window.imgDlg=function(){
 const sec=secs[cur];if(!sec||sec.kind!='book'){toast('اول یک PDF یا پاورپوینت باز کن (بخش «کتاب»)');return}
 const m=modal(`<b>🖼 تصویرهای داخل «${esc(sec.name)}»</b><div id="gs2" style="font-size:13px">در حال خواندن…</div><div class="xg" id="gg"></div>
 <div class="xr"><button id="gA">⬇ همه (zip)</button><button id="gS">⬇ انتخاب‌شده‌ها (zip)</button><button class="on" id="gP">📌 روی صفحه‌ی فعلی بگذار</button><button id="gN">➕ هر تصویر یک صفحه‌ی جدید</button><button id="gX">بستن</button></div>`);
 const g=id=>Q('#'+id,m);let sel={},list=[],stop=false;
 g('gX').onclick=()=>{stop=true;m.remove()};
 const add=it=>{const k=list.length;list.push(it);const d=document.createElement('div');d.className='it';d.innerHTML='<img src="'+URL.createObjectURL(it.blob)+'"><span>'+it.label+' · '+fa(it.w)+'×'+fa(it.h)+'</span>';d.onclick=()=>{if(sel[k])delete sel[k];else sel[k]=1;d.classList.toggle('sel',!!sel[k])};g('gg').appendChild(d)};
 (async()=>{try{await extractImages(sec,add,t=>{g('gs2').textContent=t},()=>stop);g('gs2').textContent=list.length?fa(list.length)+' تصویر پیدا شد. روی هر تصویر بزن تا انتخاب شود.':'تصویری در این فایل پیدا نشد (ممکن است صفحه‌ها فقط عکسِ اسکن‌شده باشند).'}catch(e){console.error(e);g('gs2').textContent='خواندن تصویرها ناموفق بود'}})();
 const ext=b=>/png/.test(b.type)?'png':/gif/.test(b.type)?'gif':/webp/.test(b.type)?'webp':'jpg';
 async function dl(ids){if(!ids.length){toast('تصویری انتخاب نشده');return}if(typeof JSZip=='undefined'){toast('jszip.min.js پیدا نشد');return}const z=new JSZip();ids.forEach((k,j)=>z.file('image-'+String(j+1).padStart(3,'0')+'.'+ext(list[k].blob),list[k].blob));saveBlobAs(await z.generateAsync({type:'blob'}),'images.zip')}
 g('gA').onclick=()=>dl(list.map((_,k)=>k));g('gS').onclick=()=>dl(Object.keys(sel).map(Number));
 const toDU=async b=>{const bm=await createImageBitmap(b),sc=Math.min(1,1400/bm.width),c=document.createElement('canvas');c.width=Math.round(bm.width*sc);c.height=Math.round(bm.height*sc);c.getContext('2d').drawImage(bm,0,0,c.width,c.height);return{u:c.toDataURL('image/jpeg',.88),w:bm.width,h:bm.height}};
 g('gP').onclick=async()=>{const ids=Object.keys(sel).map(Number);if(!ids.length){toast('اول یک یا چند تصویر را انتخاب کن');return}
  const it=itemAt(sec,(innerHeight/2-V.y)/V.s);it.ov=it.ov||[];
  for(const k of ids){const d=await toDU(list[k].blob),w=Math.round(Math.min(W*.5,it.h*.7*d.w/d.h));it.ov.push({k:'i',u:d.u,x:Math.round((W-w)/2),y:Math.round(it.h*.08),w,an:'fade',ad:.8,ae:0})}
  stop=true;m.remove();dirty=1;scheduleSave();toast('تصویر روی صفحه گذاشته شد؛ از «🅰 متن و تصویر روی صفحه» جابه‌جایش کن')};
 g('gN').onclick=async()=>{const ids=Object.keys(sel).map(Number);if(!ids.length){toast('اول یک یا چند تصویر را انتخاب کن');return}
  const items=[];for(const k of ids){const d=await toDU(list[k].blob),im=new Image();await new Promise(r=>{im.onload=r;im.onerror=r;im.src=d.u});const h=Math.round(W*d.h/d.w),c=document.createElement('canvas');c.width=W;c.height=h;c.getContext('2d').drawImage(im,0,0,W,h);items.push({h,bg:c,img:1,bgUrl:d.u})}
  stop=true;m.remove();addSec(mkSec('عکس‌های '+sec.name,items,'img'));toast('بخش تازه ساخته شد')};
};

// ================= ساخت ارائه با هوش مصنوعی =================
let AI={};try{AI=JSON.parse(localStorage.cm_ai||'{}')}catch{}
async function claudeAsk(prompt){if(!AI.ckey)throw new Error('کلید Claude تنظیم نشده');
 const r=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'content-type':'application/json','x-api-key':AI.ckey,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},body:JSON.stringify({model:AI.cmodel||'claude-sonnet-5-5',max_tokens:6000,system:'You are an expert teacher who makes presentation slides. Reply with a JSON array only.',messages:[{role:'user',content:prompt}]})});
 if(!r.ok)throw new Error('Claude '+r.status+': '+(await r.text()).slice(0,160));const j=await r.json();return(j.content||[]).map(c=>c.text||'').join('')}
async function wikiSearch(q,n){const u='https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrnamespace=6&gsrlimit='+(n||8)+'&gsrsearch='+encodeURIComponent(q+' filetype:bitmap')+'&prop=imageinfo&iiprop=url|size|extmetadata&iiurlwidth=800';
 const r=await fetch(u);if(!r.ok)throw new Error('ویکی‌مدیا '+r.status);const j=await r.json(),pages=Object.values((j.query&&j.query.pages)||{}).sort((a,b)=>a.index-b.index),strip=s=>String(s||'').replace(/<[^>]*>/g,'').trim();
 return pages.map(p=>{const ii=p.imageinfo&&p.imageinfo[0];if(!ii||!ii.thumburl)return null;const m=ii.extmetadata||{};return{thumb:ii.thumburl,credit:(strip(m.Artist&&m.Artist.value)||'Wikimedia Commons')+' — '+(strip(m.LicenseShortName&&m.LicenseShortName.value)||'CC'),title:p.title}}).filter(Boolean)}
const STOP={};'و در به از که این را با است برای آن یک هم یا تا بر شده می‌شود شد های ها ی می‌ باید هر دو نیز اما اگر چون پس بود کرد کند کنند شود شوند دارد دارند بین روی زیر آنها آن‌ها خود وی ما شما او من the of and to in is a for'.split(' ').forEach(w=>STOP[w]=1);
function offlineSlide(idx,text){
 const paras=text.split(/\n+/).map(x=>x.trim()).filter(Boolean),first=paras[0]||'',shortTitle=first.length<=60&&paras.length>1,body=(shortTitle?paras.slice(1):paras).join(' ');
 const sents=body.split(/[.؟?!۔]+\s+|\s[•\-–]\s/).map(x=>x.trim()).filter(x=>x.length>=25&&x.length<=400),freq={};
 sents.forEach(x=>x.split(/[\s،,؛:()«»"]+/).forEach(w=>{w=w.replace(/‌/g,'');if(w.length>2&&!STOP[w])freq[w]=(freq[w]||0)+1}));
 const sc=sents.map((x,k)=>{const ws=x.split(/\s+/);let t=0;ws.forEach(w=>{t+=freq[w.replace(/‌/g,'')]||0});return{k,x,v:t/Math.sqrt(ws.length)+(k==0?1.5:0)}});
 const pick=sc.slice().sort((a,b)=>b.v-a.v).slice(0,4).sort((a,b)=>a.k-b.k).map(o=>{let t=o.x;if(t.length>120){t=t.slice(0,118);const sp=t.lastIndexOf(' ');t=(sp>60?t.slice(0,sp):t)+'…'}return t});
 const title=shortTitle?first:(sents[0]||first).split(/\s+/).slice(0,7).join(' ');
 return{idx,title:title.slice(0,70),bullets:pick,queries:[title.slice(0,70)]}}
function buildPrompt(items,nSl,topic){
 const head='تو یک معلم باتجربه و طراح ارائه‌ی آموزشی هستی. '+(topic?'درباره‌ی موضوع «'+topic+'» ':'')+'از '+(items.length?'متن زیر ':'دانش خودت ')+'یک ارائه‌ی پاورپوینتِ خلاصه و روان برای دانش‌آموزان بساز.\n\nقواعد:\n- حدود '+nSl+' اسلاید بساز (یک موضوع در هر اسلاید).\n- متن را کلمه‌به‌کلمه کپی نکن؛ خلاصه و با جمله‌های کوتاه و ساده‌ی فارسی بنویس.\n- هر اسلاید: عنوان کوتاه (حداکثر ۷ کلمه) و ۳ تا ۵ نکته‌ی کوتاه (هرکدام حداکثر ۱۴ کلمه).\n- برای هر اسلاید ۲ تا ۳ عبارت جستجوی «انگلیسی» برای پیدا کردن عکس در Wikimedia Commons بده؛ اسم‌های مشخص و قابل‌دیدن، نه مفهوم انتزاعی.\n- متن ممکن است از PDF خوانده شده و غلط‌های املایی داشته باشد؛ املای درست فارسی بنویس.\n- فقط و فقط یک آرایه‌ی JSON معتبر بده، بدون هیچ توضیح یا متن اضافه و بدون ```.\n\nقالب خروجی:\n[{"title":"...","bullets":["...","..."],"queries":["english query 1","english query 2"]}]\n';
 return head+(items.length?'\nمتن:\n\n'+items.map(p=>'### صفحه '+(p.idx+1)+'\n'+p.text.slice(0,2500)).join('\n\n'):'')}
function parseSlides(t){
 t=String(t||'').replace(/```(?:json)?/gi,'').replace(/[“”]/g,'"');let arr=null;
 try{const m=t.match(/\[[\s\S]*\]/);arr=JSON.parse(m?m[0]:t)}catch{try{const o=JSON.parse(t.match(/\{[\s\S]*\}/)[0]);arr=o.slides||o.items||null}catch{}}
 if(!Array.isArray(arr)||!arr.length)throw new Error('جواب قابل‌خواندن نبود. باید فقط همان آرایه‌ی JSON باشد؛ دوباره از هوش مصنوعی بخواه «فقط JSON بده».');
 return arr.map(a=>({title:String(a.title||'').slice(0,80),bullets:(a.bullets||[]).map(String).slice(0,6),queries:(a.queries||[]).map(String).slice(0,3)})).filter(x=>x.title||x.bullets.length)}
const SH=787;
function slideBg(){const c=document.createElement('canvas');c.width=W;c.height=SH;const g=c.getContext('2d'),ln=g.createLinearGradient(0,0,W,SH);
 const day=document.documentElement.classList.contains('day');ln.addColorStop(0,day?'#f4f7ff':'#0f1830');ln.addColorStop(1,day?'#dfe8fb':'#1c2c52');g.fillStyle=ln;g.fillRect(0,0,W,SH);
 g.fillStyle=getComputedStyle(document.documentElement).getPropertyValue('--ac').trim()||'#35e0c2';g.fillRect(W-14,0,14,SH);return c}
function makeSlide(sl,imgU,imgW,imgH,credit){
 const day=document.documentElement.classList.contains('day'),ink=day?'#172033':'#ffffff',ac=day?'#0b7f6b':(getComputedStyle(document.documentElement).getPropertyValue('--ac').trim()||'#35e0c2');
 const ov=[],hasI=!!imgU,bw=hasI?760:1180,t={k:'t',t:sl.title,x:70,y:50,w:1180,s:60,bd:1,c:ac,bc:'',al:'right',an:'rise',ad:.7,ae:0};ov.push(t);
 const b={k:'t',t:sl.bullets.map(x=>'• '+x.replace(/^[•\s\-–]+/,'')).join('\n'),x:hasI?560:70,y:170,w:bw,s:42,c:ink,bc:'',al:'right',an:'lines',ad:1.1,ae:.7};
 const g=document.createElement('canvas').getContext('2d');for(let s=44;s>=22;s-=2){b.s=s;b._k=null;lay(g,b);if(b._h<=SH-170-70)break}ov.push(b);
 if(hasI){const w2=Math.round(Math.min(440,520*imgW/imgH));ov.push({k:'i',u:imgU,x:70,y:180,w:w2,an:'fade',ad:1,ae:.4})}
 if(credit)ov.push({k:'t',t:credit,x:70,y:SH-50,w:1180,s:20,c:day?'#5b6784':'#9aa7c7',bc:'',al:'right',an:'none'});
 return{h:SH,bg:slideBg(),img:1,ov}}
window.wizDlg=function(){
 const s0=secs[cur],book=s0&&s0.kind=='book',n=book?s0.items.length:0,hasC=!!AI.ckey;let run=0,cancel=false,stage=0;
 const m=modal(`<b>🪄 ساخت ارائه‌ی تازه (با انیمیشن آماده)</b><small>از متن صفحه‌های همین فایل یا از موضوعی که خودت می‌نویسی، چند اسلاید خلاصه ساخته می‌شود؛ هر اسلاید عنوان، نکته‌های خط‌به‌خط و عکس اختیاری دارد و در همان بخش «🅰» قابل ویرایش است.</small>
 ${book?`<div class="xr">از صفحه <input type="number" id="wf" min="1" max="${n}" value="1"> تا <input type="number" id="wt" min="1" max="${n}" value="${Math.min(n,10)}"><small>(از ${fa(n)})</small></div>`:'<small>(فایلی باز نیست؛ فقط موضوع/متن زیر استفاده می‌شود)</small>'}
 <label>موضوع یا متن دلخواه (اختیاری)<textarea id="wtx" rows="2" placeholder="مثلاً: چرخه‌ی آب در طبیعت"></textarea></label>
 <label>تعداد اسلاید <input type="number" id="wn" min="2" max="40" placeholder="خودکار"></label>
 <div class="xc"><b>روش خلاصه‌نویسی</b>
 <label><input type="radio" name="wm" value="prompt" ${hasC?'':'checked'}> 📋 پرامپت می‌سازم؛ تو در ChatGPT / Gemini / Claude می‌گذاری و جواب را برمی‌گردانی (رایگان، پیشنهادی)</label>
 <label><input type="radio" name="wm" value="claude" ${hasC?'checked':''} ${hasC?'':'disabled'}> 🤖 خودکار با کلید Claude ${hasC?'':'<small>(کلید ندارم)</small>'}</label>
 <label><input type="radio" name="wm" value="simple"> ✂️ ساده بدون هوش مصنوعی (فقط جمله‌های مهم؛ فقط برای متن فایل)</label>
 <button id="wk">⚙ کلید Claude (اختیاری)</button></div>
 <label><input type="checkbox" id="ww" checked> جستجوی عکس آزاد در ویکی‌مدیا (نیاز به اینترنت)</label>
 <div id="wp" style="display:none;flex-direction:column;gap:6px"><b>۱) این پرامپت را کپی کن و در هوش مصنوعی بگذار:</b><textarea id="wp1" rows="5" readonly></textarea><button id="wp2">📋 کپی پرامپت</button><b>۲) جواب هوش مصنوعی را اینجا بچسبان:</b><textarea id="wp3" rows="5" dir="ltr" placeholder='[{"title":"...","bullets":["..."]}]'></textarea></div>
 <div id="ws" style="font-size:13px;min-height:22px"></div><div id="wr"></div><div class="xr"><button class="on" id="wg">▶ ادامه</button><button id="wx">بستن</button></div>`);
 const g=id=>Q('#'+id,m),say=t=>g('ws').textContent=t;
 g('wx').onclick=()=>{cancel=true;m.remove()};
 g('wk').onclick=()=>{const k=modal(`<b>⚙ کلید Claude</b><small>فقط روی همین دستگاه ذخیره می‌شود و مستقیم به Anthropic فرستاده می‌شود؛ هزینه با حساب خودت است. در ایران ممکن است فیلترشکن لازم باشد.</small><label>کلید<input type="password" id="k1" dir="ltr" placeholder="sk-ant-..."></label><label>مدل<input type="text" id="k2" dir="ltr" placeholder="claude-sonnet-5-5"></label><div class="xr"><button class="on" id="k3">ذخیره</button><button id="k4">بستن</button></div>`);
  Q('#k1',k).value=AI.ckey||'';Q('#k2',k).value=AI.cmodel||'';Q('#k4',k).onclick=()=>k.remove();Q('#k3',k).onclick=()=>{AI={ckey:Q('#k1',k).value.trim(),cmodel:Q('#k2',k).value.trim()};try{localStorage.cm_ai=JSON.stringify(AI)}catch{}k.remove();toast('ذخیره شد؛ پنجره را ببند و دوباره باز کن')}};
 g('wp2').onclick=()=>{const t=g('wp1');t.select();const ok=()=>toast('کپی شد؛ در هوش مصنوعی بچسبان');if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(t.value).then(ok,()=>{document.execCommand('copy');ok()});else{document.execCommand('copy');ok()}};
 g('wg').onclick=async()=>{if(run)return;
  const mode=(Q('input[name=wm]:checked',m)||{}).value||'simple',topic=g('wtx').value.trim(),from=book?Math.max(1,Math.min(n,+g('wf').value||1))-1:0,to=book?Math.max(from,Math.min(n,+g('wt').value||n)-1):-1;
  const items=[];if(book&&!(topic&&topic.length>200)){say('در حال خواندن متن صفحه‌ها…');for(let k=from;k<=to;k++){const t=await pageText(s0.items[k]);if(t.length>=25)items.push({idx:k,text:t})}}
  if(topic.length>200)items.push({idx:0,text:topic});
  if(!items.length&&!topic){say('⚠ متنی پیدا نشد (فایل ممکن است اسکن‌شده باشد). یک موضوع یا متن در کادر بالا بنویس.');return}
  if(mode=='simple'&&!items.length){say('⚠ روش ساده فقط روی متن فایل کار می‌کند.');return}
  const nSl=+g('wn').value||Math.max(4,Math.round((items.length||3)*1.6)),tp=topic.length>200?'':topic;
  if(mode=='prompt'&&stage==0){g('wp1').value=buildPrompt(items,nSl,tp);g('wp').style.display='flex';stage=1;say('پرامپت آماده است: کپی کن، در ChatGPT یا Gemini یا Claude بگذار، جواب را در کادر دوم بچسبان و دوباره «ادامه» بزن.');g('wg').textContent='▶ ساخت ارائه از جواب';return}
  run=1;g('wg').disabled=true;
  try{let sl;
   if(mode=='prompt')sl=parseSlides(g('wp3').value);
   else if(mode=='claude'){say('Claude در حال خلاصه‌نویسی…');sl=parseSlides(await claudeAsk(buildPrompt(items,nSl,tp)))}
   else sl=items.map(p=>offlineSlide(p.idx,p.text));
   sl.forEach(x=>{x.cands=[];x.chosen='none'});
   if(g('ww').checked){let warn='';for(let k=0;k<sl.length&&!cancel;k++){say('در حال جستجوی عکس برای اسلاید '+fa(k+1)+' از '+fa(sl.length)+'…');
     for(const q of sl[k].queries){try{const r=await wikiSearch(q,8);r.forEach(c=>{if(!sl[k].cands.some(x=>x.thumb===c.thumb))sl[k].cands.push(c)})}catch(e){warn='⚠ جستجوی ویکی‌مدیا انجام نشد (اینترنت یا فیلترشکن را بررسی کن). ';break}if(sl[k].cands.length>=4)break}
     if(sl[k].cands.length)sl[k].chosen=0}
    sl.warn=warn}
   if(!cancel)review(m,sl)}
  catch(e){console.error(e);say('⚠ '+(e.message||'ناموفق بود'))}run=0;g('wg').disabled=false};
};
function review(m,slides){
 const g=id=>Q('#'+id,m);g('ws').textContent=(slides.warn||'')+fa(slides.length)+' اسلاید آماده است. متن و عکس هر اسلاید را بررسی کن، بعد «ساخت ارائه» را بزن.';g('wg').style.display='none';g('wp').style.display='none';
 const draw=()=>{g('wr').innerHTML=slides.map((s,k)=>`<div class="xc" data-k="${k}"><b>اسلاید ${fa(k+1)}</b><input type="text" class="wt" value="${esc(s.title)}"><textarea class="wb" rows="3">${esc(s.bullets.join('\n'))}</textarea>
  <div class="xg">${s.cands.slice(0,6).map((c,j)=>`<div class="it ${s.chosen===j?'sel':''}" data-c="${j}"><img src="${esc(c.thumb)}"></div>`).join('')}<div class="it ${s.chosen==='none'?'sel':''}" data-c="none"><span style="padding:26px 0">بدون تصویر</span></div></div>
  <div class="xr"><input type="text" class="wq" dir="ltr" value="${esc(s.queries[0]||'')}" style="flex:1;min-width:120px"><button class="wsr">🔍 جستجو</button></div></div>`).join('')+'<div class="xr"><button class="on" id="wb">✅ ساخت ارائه</button></div>'};
 draw();
 const sync=()=>m.querySelectorAll('[data-k]').forEach(c=>{const s=slides[+c.dataset.k];if(!s)return;s.title=c.querySelector('.wt').value.trim();s.bullets=c.querySelector('.wb').value.split('\n').map(x=>x.trim()).filter(Boolean);s.queries[0]=c.querySelector('.wq').value.trim()});
 g('wr').onclick=async e=>{const card=e.target.closest('[data-k]');if(!card)return;const s=slides[+card.dataset.k];
  const it=e.target.closest('.it');if(it){sync();s.chosen=it.dataset.c=='none'?'none':+it.dataset.c;draw();return}
  if(e.target.closest('.wsr')){sync();const bt=e.target.closest('button');bt.disabled=true;try{s.cands=await wikiSearch(s.queries[0],8);s.chosen=s.cands.length?0:'none'}catch(err){toast('جستجو ناموفق بود: '+err.message)}draw()}};
 g('wr').addEventListener('click',async e=>{if(e.target.id!='wb')return;sync();e.target.disabled=true;const items=[];let fail=0;
  for(let k=0;k<slides.length;k++){const s=slides[k];g('ws').textContent='در حال آماده‌سازی اسلاید '+fa(k+1)+' از '+fa(slides.length)+'…';let u=null,w=0,h=0,cr='';
   if(typeof s.chosen=='number'){try{const c=s.cands[s.chosen],r=await fetch(c.thumb);if(!r.ok)throw 0;const bm=await createImageBitmap(await r.blob()),sc=Math.min(1,900/bm.width),cv2=document.createElement('canvas');cv2.width=Math.round(bm.width*sc);cv2.height=Math.round(bm.height*sc);cv2.getContext('2d').drawImage(bm,0,0,cv2.width,cv2.height);u=cv2.toDataURL('image/jpeg',.88);w=cv2.width;h=cv2.height;cr='تصویر: '+c.credit}catch{fail++}}
   const sl=makeSlide(s,u,w,h,cr);items.push(sl)}
  const sec=mkSec('ارائه',items,'img');addSec(sec);m.remove();toast(fail?'ارائه ساخته شد؛ '+fa(fail)+' عکس دانلود نشد':'ارائه ساخته شد؛ با «🅰» می‌توانی متن و انیمیشن را تغییر دهی')})}
})();
