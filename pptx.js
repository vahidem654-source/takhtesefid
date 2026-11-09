/* Minimal PPTX -> canvas renderer (text incl. RTL, shapes, pictures, tables, groups, placeholders inheritance).
   Needs JSZip. API: PPTX.load(arrayBuffer) -> deck {w,h,slides:[{index,hidden}],warnings:Set,render(i,canvas,widthPx)} */
(function(){
'use strict';
const L=(e,n)=>e?Array.from(e.getElementsByTagNameNS('*',n)):[];
const kids=(e,n)=>e?Array.from(e.children).filter(c=>c.localName===n):[];
const kid=(e,n)=>e?Array.from(e.children).find(c=>c.localName===n)||null:null;
const kp=(e,...ns)=>{for(const n of ns){e=kid(e,n);if(!e)return null}return e};
const at=(e,a,d)=>e&&e.hasAttribute(a)?e.getAttribute(a):d;
const nat=(e,a,d)=>{const v=at(e,a,null);return v==null?d:+v};
const RNS='http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const rattr=(e,n)=>e&&(e.getAttributeNS(RNS,n)||e.getAttribute('r:'+n));
const EMU_PT=12700;
function resolvePath(dir,t){if(t[0]==='/')return t.slice(1);const o=[];for(const p of (dir+t).split('/')){if(p==='..')o.pop();else if(p&&p!=='.')o.push(p)}return o.join('/')}

// ---------- colors
const COLORS=new Set(['srgbClr','schemeClr','sysClr','prstClr','scrgbClr','hslClr']);
const PRST={black:'000000',white:'FFFFFF',red:'FF0000',green:'008000',blue:'0000FF',yellow:'FFFF00',gray:'808080',grey:'808080',orange:'FFA500',purple:'800080',cyan:'00FFFF',magenta:'FF00FF',lime:'00FF00',navy:'000080',teal:'008080',silver:'C0C0C0',maroon:'800000',olive:'808000',pink:'FFC0CB',brown:'A52A2A',darkBlue:'00008B',darkRed:'8B0000',darkGreen:'006400',lightGray:'D3D3D3',darkGray:'A9A9A9'};
const hex=s=>{s=(s||'000000').replace('#','');return[parseInt(s.slice(0,2),16)||0,parseInt(s.slice(2,4),16)||0,parseInt(s.slice(4,6),16)||0]};
function toHsl([r,g,b]){r/=255;g/=255;b/=255;const mx=Math.max(r,g,b),mn=Math.min(r,g,b);let h=0,s=0;const l=(mx+mn)/2;if(mx!==mn){const d=mx-mn;s=l>.5?d/(2-mx-mn):d/(mx+mn);h=mx===r?(g-b)/d+(g<b?6:0):mx===g?(b-r)/d+2:(r-g)/d+4;h/=6}return[h,s,l]}
function fromHsl([h,s,l]){const f=(p,q,t)=>{if(t<0)t+=1;if(t>1)t-=1;return t<1/6?p+(q-p)*6*t:t<.5?q:t<2/3?p+(q-p)*(2/3-t)*6:p};let r,g,b;if(s===0)r=g=b=l;else{const q=l<.5?l*(1+s):l+s-l*s,p=2*l-q;r=f(p,q,h+1/3);g=f(p,q,h);b=f(p,q,h-1/3)}return[r*255,g*255,b*255]}
const cl=(v,a,b)=>Math.max(a,Math.min(b,v));
function colorOf(el,env){if(!el)return null;let c=COLORS.has(el.localName)?el:Array.from(el.children).find(k=>COLORS.has(k.localName));if(!c)return null;
 let rgb,a=1;const v=c.getAttribute('val');
 switch(c.localName){case 'srgbClr':rgb=hex(v);break;case 'sysClr':rgb=hex(c.getAttribute('lastClr')||(v==='window'?'FFFFFF':'000000'));break;case 'prstClr':rgb=hex(PRST[v]||'000000');break;
  case 'schemeClr':{if(v==='phClr')rgb=env.phClr?env.phClr.slice(0,3):[0,0,0];else{const m=env.clrMap[v]||v;rgb=env.theme.colors[m]||env.theme.colors[v]||[0,0,0]}break}
  default:rgb=[0,0,0]}
 rgb=rgb.slice(0,3);
 for(const m of c.children){const n=m.localName,x=nat(m,'val',0)/100000;
  if(n==='lumMod'||n==='lumOff'||n==='satMod'||n==='satOff'||n==='hueOff'){const hs=toHsl(rgb);if(n==='lumMod')hs[2]*=x;else if(n==='lumOff')hs[2]+=x;else if(n==='satMod')hs[1]*=x;else if(n==='satOff')hs[1]+=x;else hs[0]=(hs[0]+nat(m,'val',0)/21600000+1)%1;hs[1]=cl(hs[1],0,1);hs[2]=cl(hs[2],0,1);rgb=fromHsl(hs)}
  else if(n==='tint')rgb=rgb.map(c=>c*x+255*(1-x));else if(n==='shade')rgb=rgb.map(c=>c*x);else if(n==='alpha')a=x;}
 return[Math.round(rgb[0]),Math.round(rgb[1]),Math.round(rgb[2]),a]}
const css=c=>c?(c[3]<1?`rgba(${c[0]},${c[1]},${c[2]},${c[3]})`:`rgb(${c[0]},${c[1]},${c[2]})`):'transparent';

// ---------- loading
async function load(buf){
 const zip=await JSZip.loadAsync(buf),P={zip,docs:{},parts:{}};
 const xml=async n=>{if(n in P.docs)return P.docs[n];const f=zip.file(n);if(!f)return P.docs[n]=null;return P.docs[n]=new DOMParser().parseFromString(await f.async('string'),'application/xml')};
 const relsOf=async n=>{const d=n.replace(/[^/]+$/,''),x=await xml(n.replace(/([^/]+)$/,'_rels/$1.rels')),m={};if(x)for(const r of L(x,'Relationship')){if(r.getAttribute('TargetMode')==='External')continue;m[r.getAttribute('Id')]={type:r.getAttribute('Type').split('/').pop(),target:resolvePath(d,r.getAttribute('Target'))}}return m};
 const part=async(n,kind)=>{if(P.parts[n])return P.parts[n];const doc=await xml(n);if(!doc)return null;const p=P.parts[n]={path:n,doc,kind,rels:await relsOf(n),imgs:{}};return p};
 const pres=await xml('ppt/presentation.xml');if(!pres)throw new Error('not pptx');
 const sz=L(pres,'sldSz')[0],W=nat(sz,'cx',12192000),H=nat(sz,'cy',6858000);
 const prels=await relsOf('ppt/presentation.xml');
 const order=L(pres,'sldId').map(s=>prels[rattr(s,'id')]).filter(Boolean).map(r=>r.target);
 const defText=kp(pres.documentElement,'defaultTextStyle');
 const warnings=new Set(),slides=[];
 for(let i=0;i<order.length;i++){const sp=await part(order[i],'slide');if(!sp)continue;
  const lay=Object.values(sp.rels).find(r=>r.type==='slideLayout'),lp=lay&&await part(lay.target,'layout');
  const mas=lp&&Object.values(lp.rels).find(r=>r.type==='slideMaster'),mp=mas&&await part(mas.target,'master');
  const th=mp&&Object.values(mp.rels).find(r=>r.type==='theme'),tp=th&&await xml(th.target);
  sp.layout=lp;sp.master=mp;sp.theme=tp?parseTheme(tp):parseTheme(null);
  sp.clrMap={};const cm=mp&&kid(mp.doc.documentElement,'clrMap');if(cm)for(const a of cm.attributes)sp.clrMap[a.name]=a.value;
  slides.push({index:slides.length,part:sp,hidden:sp.doc.documentElement.getAttribute('show')==='0'})}
 const deck={w:W,h:H,slides,warnings,defText};
 const MIME={png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',gif:'image/gif',webp:'image/webp',bmp:'image/bmp',svg:'image/svg+xml'};
 deck.text=i=>{const out=[];for(const p of L(spTree(slides[i].part),'p')){const t=Array.from(p.children).filter(c=>c.localName==='r'||c.localName==='fld').map(r=>Array.from(r.children).filter(e=>e.localName==='t').map(e=>e.textContent).join('')).join('');if(t.trim())out.push(t.trim())}return out.join('\n')};
 deck.media=async()=>{const m=new Map();slides.forEach((s,i)=>{for(const r of Object.values(s.part.rels))if(r.type==='image'){const e=m.get(r.target)||{path:r.target,slides:[]};if(!e.slides.includes(i))e.slides.push(i);m.set(r.target,e)}});
  const out=[];for(const e of m.values()){const ext=e.path.split('.').pop().toLowerCase();if(!MIME[ext])continue;const f=zip.file(e.path);if(!f)continue;out.push({path:e.path,slides:e.slides,blob:new Blob([await f.async('uint8array')],{type:MIME[ext]})})}return out};
 deck.render=async(i,canvas,widthPx)=>{const s=slides[i];await prep(P,s.part,warnings);
  const k=widthPx/W;canvas.width=Math.round(widthPx);canvas.height=Math.round(H*k);const g=canvas.getContext('2d');
  const env={k,theme:s.part.theme,clrMap:s.part.clrMap,deck,slideNo:i+1,g,warn:warnings};
  g.save();g.fillStyle='#fff';g.fillRect(0,0,canvas.width,canvas.height);
  try{drawBackground(g,s.part,env,canvas.width,canvas.height);
   const m=s.part.master,l=s.part.layout;
   const showM=!l||l.doc.documentElement.getAttribute('showMasterSp')!=='0',showMs=s.part.doc.documentElement.getAttribute('showMasterSp')!=='0';
   if(m&&showM&&showMs)drawTree(g,spTree(m),m,{...env,part:m,s});
   if(l&&showMs)drawTree(g,spTree(l),l,{...env,part:l,s});
   drawTree(g,spTree(s.part),s.part,{...env,part:s.part,s})}catch(e){console.error('render',e)}
  g.restore();return canvas};
 return deck}
function parseTheme(doc){const th={colors:{dk1:[0,0,0],lt1:[255,255,255],dk2:[68,84,106],lt2:[231,230,230],accent1:[68,114,196],accent2:[237,125,49],accent3:[165,165,165],accent4:[255,192,0],accent5:[91,155,213],accent6:[112,173,71],hlink:[5,99,193],folHlink:[149,79,114]},major:'',minor:'',fills:[],bgFills:[],lns:[]};
 if(!doc)return th;const cs=L(doc,'clrScheme')[0];if(cs)for(const c of cs.children){const v=c.firstElementChild;if(v)th.colors[c.localName]=v.localName==='sysClr'?hex(v.getAttribute('lastClr')):hex(v.getAttribute('val'))}
 const fs=L(doc,'fontScheme')[0];th.major=at(kp(fs,'majorFont','latin'),'typeface','');th.minor=at(kp(fs,'minorFont','latin'),'typeface','');
 const fm=L(doc,'fmtScheme')[0];if(fm){th.fills=Array.from(kid(fm,'fillStyleLst')?.children||[]);th.bgFills=Array.from(kid(fm,'bgFillStyleLst')?.children||[]);th.lns=Array.from(kid(fm,'lnStyleLst')?.children||[])}return th}
const spTree=p=>kp(p.doc.documentElement,'cSld','spTree');
async function prep(P,sp,warn){for(const p of [sp,sp.layout,sp.master]){if(!p||p.prepped)continue;p.prepped=1;
  for(const b of L(p.doc,'blip')){const id=rattr(b,'embed');if(!id||id in p.imgs)continue;const r=p.rels[id];p.imgs[id]=null;if(!r)continue;
   if(/\.(emf|wmf|tiff?)$/i.test(r.target)){warn.add('تصویر با قالب EMF/WMF');continue}
   try{const f=P.zip.file(r.target);if(!f)continue;const ext=r.target.split('.').pop().toLowerCase(),mime={png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',gif:'image/gif',webp:'image/webp',svg:'image/svg+xml',bmp:'image/bmp'}[ext]||'image/png';
    const blob=new Blob([await f.async('uint8array')],{type:mime});p.imgs[id]=await createImageBitmap(blob)}catch{warn.add('تصویر ناخوانا')}}}}

// ---------- background
function drawBackground(g,sp,env,cw,ch){
 for(const p of [sp,sp.layout,sp.master]){if(!p)continue;const bg=kp(p.doc.documentElement,'cSld','bg');if(!bg)continue;
  const e2={...env,part:p};let fill=null;const pr=kid(bg,'bgPr'),ref=kid(bg,'bgRef');
  if(pr)fill=fillOfSpPr(pr,e2);else if(ref){const idx=nat(ref,'idx',1001),c=colorOf(ref,e2);const el=idx>=1001?env.theme.bgFills[idx-1001]:env.theme.fills[idx-1];fill=el?fillOfEl(el,{...e2,phClr:c}):{k:'solid',c}}
  if(fill&&fill.k!=='none'){paintFill(g,fill,{x:0,y:0,w:cw,h:ch},e2,()=>{g.beginPath();g.rect(0,0,cw,ch)});return}
  if(fill&&fill.k==='none')return}}

// ---------- fills / lines
function fillOfSpPr(spPr,env){for(const c of spPr.children){if(['solidFill','gradFill','blipFill','pattFill','noFill','grpFill'].includes(c.localName))return fillOfEl(c,env)}return undefined}
function fillOfEl(c,env){switch(c.localName){case 'noFill':return{k:'none'};case 'solidFill':return{k:'solid',c:colorOf(c,env)};
 case 'pattFill':return{k:'solid',c:colorOf(kid(c,'fgClr'),env)};
 case 'gradFill':{const stops=kids(kp(c,'gsLst')||c,'gs').map(gs=>({p:nat(gs,'pos',0)/100000,c:colorOf(gs,env)||[0,0,0,1]}));const lin=kid(c,'lin'),path=kid(c,'path');return{k:'grad',stops,ang:lin?nat(lin,'ang',0)/60000:90,radial:!!path}}
 case 'blipFill':{const b=kid(c,'blip');return{k:'img',rid:rattr(b,'embed'),src:kid(c,'srcRect')}}
 default:return{k:'solid',c:colorOf(c,env)}}}
function paintFill(g,f,box,env,pathFn){if(!f||f.k==='none'||(f.k==='solid'&&!f.c))return;g.save();pathFn();
 if(f.k==='solid'){g.fillStyle=css(f.c);g.fill()}
 else if(f.k==='grad'&&f.stops.length){let gr;if(f.radial){gr=g.createRadialGradient(box.x+box.w/2,box.y+box.h/2,0,box.x+box.w/2,box.y+box.h/2,Math.max(box.w,box.h)/2)}
  else{const a=f.ang*Math.PI/180,cx=box.x+box.w/2,cy=box.y+box.h/2,dx=Math.cos(a),dy=Math.sin(a),hl=(Math.abs(box.w*dx)+Math.abs(box.h*dy))/2;gr=g.createLinearGradient(cx-dx*hl,cy-dy*hl,cx+dx*hl,cy+dy*hl)}
  for(const s of f.stops)gr.addColorStop(cl(s.p,0,1),css(s.c));g.fillStyle=gr;g.fill()}
 else if(f.k==='img'){const bm=env.part.imgs[f.rid];if(bm){g.clip();drawBitmap(g,bm,box,f.src)}}
 g.restore()}
function drawBitmap(g,bm,box,src){let sx=0,sy=0,sw=bm.width,sh=bm.height;if(src){const l=nat(src,'l',0)/100000,t=nat(src,'t',0)/100000,r=nat(src,'r',0)/100000,b=nat(src,'b',0)/100000;sx=bm.width*l;sy=bm.height*t;sw=bm.width*(1-l-r);sh=bm.height*(1-t-b)}
 try{g.drawImage(bm,sx,sy,sw,sh,box.x,box.y,box.w,box.h)}catch{}}
function lineOf(spPr,style,env){const ln=kid(spPr,'ln');let w=ln?nat(ln,'w',null):null,fill=null,dash=null,none=false;
 if(ln){for(const c of ln.children){if(c.localName==='noFill')none=true;else if(c.localName==='solidFill')fill=colorOf(c,env);else if(c.localName==='gradFill'){const f=fillOfEl(c,env);fill=f.stops[0]?.c}else if(c.localName==='prstDash')dash=c.getAttribute('val')}}
 if(none)return null;
 if(!fill&&style){const lr=kid(style,'lnRef'),idx=nat(lr,'idx',0);if(idx>0){fill=colorOf(lr,env);if(w==null){const t=env.theme.lns[idx-1];w=nat(t,'w',9525)}}}
 if(!fill)return null;return{w:(w==null?9525:w)*env.k,c:fill,dash,head:kid(ln,'headEnd'),tail:kid(ln,'tailEnd')}}
function strokeLine(g,l,pathFn){g.save();pathFn();g.lineWidth=Math.max(.5,l.w);g.strokeStyle=css(l.c);if(l.dash&&l.dash!=='solid'){const u=Math.max(1,l.w);g.setLineDash(/sysDot|dot/.test(l.dash)?[u,u*2]:/lgDash/.test(l.dash)?[u*8,u*3]:[u*4,u*3])}g.lineJoin='round';g.stroke();g.restore()}

// ---------- geometry
const adjOf=(av,name,def)=>{if(!av)return def;for(const gd of kids(av,'gd'))if(gd.getAttribute('name')===name){const m=/val\s+(-?\d+)/.exec(gd.getAttribute('fmla')||'');if(m)return +m[1]}return def};
function presetPath(g,prst,w,h,av){const ss=Math.min(w,h);g.beginPath();
 switch(prst){
 case 'ellipse':g.ellipse(w/2,h/2,w/2,h/2,0,0,Math.PI*2);break;
 case 'roundRect':{const r=Math.min(ss*adjOf(av,'adj',16667)/100000,ss/2);g.roundRect?g.roundRect(0,0,w,h,r):g.rect(0,0,w,h);break}
 case 'round2SameRect':{const r=Math.min(ss*adjOf(av,'adj1',16667)/100000,ss/2);g.roundRect?g.roundRect(0,0,w,h,[r,r,0,0]):g.rect(0,0,w,h);break}
 case 'round1Rect':{const r=Math.min(ss*adjOf(av,'adj',16667)/100000,ss);g.roundRect?g.roundRect(0,0,w,h,[0,r,0,0]):g.rect(0,0,w,h);break}
 case 'triangle':{const x=w*adjOf(av,'adj',50000)/100000;g.moveTo(x,0);g.lineTo(w,h);g.lineTo(0,h);g.closePath();break}
 case 'rtTriangle':g.moveTo(0,0);g.lineTo(w,h);g.lineTo(0,h);g.closePath();break;
 case 'diamond':g.moveTo(w/2,0);g.lineTo(w,h/2);g.lineTo(w/2,h);g.lineTo(0,h/2);g.closePath();break;
 case 'parallelogram':{const o=ss*adjOf(av,'adj',25000)/100000;g.moveTo(o,0);g.lineTo(w,0);g.lineTo(w-o,h);g.lineTo(0,h);g.closePath();break}
 case 'trapezoid':{const o=ss*adjOf(av,'adj',25000)/100000;g.moveTo(o,0);g.lineTo(w-o,0);g.lineTo(w,h);g.lineTo(0,h);g.closePath();break}
 case 'hexagon':{const o=ss*adjOf(av,'adj',25000)/100000;g.moveTo(o,0);g.lineTo(w-o,0);g.lineTo(w,h/2);g.lineTo(w-o,h);g.lineTo(o,h);g.lineTo(0,h/2);g.closePath();break}
 case 'octagon':{const o=ss*adjOf(av,'adj',29289)/100000;g.moveTo(o,0);g.lineTo(w-o,0);g.lineTo(w,o);g.lineTo(w,h-o);g.lineTo(w-o,h);g.lineTo(o,h);g.lineTo(0,h-o);g.lineTo(0,o);g.closePath();break}
 case 'homePlate':case 'pentagon':{const d=ss*adjOf(av,'adj',50000)/100000;g.moveTo(0,0);g.lineTo(w-d,0);g.lineTo(w,h/2);g.lineTo(w-d,h);g.lineTo(0,h);g.closePath();break}
 case 'chevron':{const d=ss*adjOf(av,'adj',50000)/100000;g.moveTo(0,0);g.lineTo(w-d,0);g.lineTo(w,h/2);g.lineTo(w-d,h);g.lineTo(0,h);g.lineTo(d,h/2);g.closePath();break}
 case 'rightArrow':case 'leftArrow':{const t=h*adjOf(av,'adj1',50000)/100000,y1=(h-t)/2,y2=y1+t,x1=w-ss*adjOf(av,'adj2',50000)/100000;
  const P=[[0,y1],[x1,y1],[x1,0],[w,h/2],[x1,h],[x1,y2],[0,y2]];P.forEach((p,i)=>{const x=prst==='leftArrow'?w-p[0]:p[0];i?g.lineTo(x,p[1]):g.moveTo(x,p[1])});g.closePath();break}
 case 'upArrow':case 'downArrow':{const t=w*adjOf(av,'adj1',50000)/100000,x1=(w-t)/2,x2=x1+t,y1=h-ss*adjOf(av,'adj2',50000)/100000;
  const P=[[x1,h],[x1,y1],[0,y1],[w/2,0],[w,y1],[x2,y1],[x2,h]];P.forEach((p,i)=>{const y=prst==='downArrow'?h-p[1]:p[1];i?g.lineTo(p[0],y):g.moveTo(p[0],y)});g.closePath();break}
 case 'plus':case 'mathPlus':{const o=ss*adjOf(av,'adj',25000)/100000;g.moveTo(o,0);g.lineTo(w-o,0);g.lineTo(w-o,o);g.lineTo(w,o);g.lineTo(w,h-o);g.lineTo(w-o,h-o);g.lineTo(w-o,h);g.lineTo(o,h);g.lineTo(o,h-o);g.lineTo(0,h-o);g.lineTo(0,o);g.lineTo(o,o);g.closePath();break}
 case 'star5':{const cx=w/2,cy=h/2,R=Math.min(w,h)/2,r=R*.4;for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,rr=i%2?r:R,x=cx+Math.cos(a)*rr*(w/Math.min(w,h)),y=cy+Math.sin(a)*rr*(h/Math.min(w,h));i?g.lineTo(x,y):g.moveTo(x,y)}g.closePath();break}
 case 'donut':{const r=ss*adjOf(av,'adj',25000)/100000;g.ellipse(w/2,h/2,w/2,h/2,0,0,Math.PI*2);g.moveTo(w-r,h/2);g.ellipse(w/2,h/2,w/2-r,h/2-r,0,0,Math.PI*2,true);break}
 case 'line':case 'straightConnector1':case 'bentConnector3':g.moveTo(0,0);g.lineTo(w,h);break;
 default:g.rect(0,0,w,h)}}
function custPath(g,cg,w,h){g.beginPath();for(const p of L(cg,'path')){const pw=nat(p,'w',w)||w,ph=nat(p,'h',h)||h,sx=w/pw,sy=h/ph,pt=e=>[nat(e,'x',0)*sx,nat(e,'y',0)*sy];
  for(const c of p.children){const pts=kids(c,'pt').map(pt);switch(c.localName){case 'moveTo':g.moveTo(...pts[0]);break;case 'lnTo':g.lineTo(...pts[0]);break;case 'cubicBezTo':g.bezierCurveTo(...pts[0],...pts[1],...pts[2]);break;case 'quadBezTo':g.quadraticCurveTo(...pts[0],...pts[1]);break;case 'close':g.closePath();break}}}}

// ---------- xfrm + inheritance
function xfrmOf(el,env){let x=kp(el,'spPr','xfrm')||kid(el,'xfrm')||kp(el,'grpSpPr','xfrm');if(!x)return null;const o=kid(x,'off'),e=kid(x,'ext'),k=env.k;
 return{x:nat(o,'x',0)*k,y:nat(o,'y',0)*k,w:nat(e,'cx',0)*k,h:nat(e,'cy',0)*k,rot:nat(x,'rot',0)/60000,fh:at(x,'flipH','0')==='1'||at(x,'flipH','')==='true',fv:at(x,'flipV','0')==='1'||at(x,'flipV','')==='true',el:x}}
const phOf=sp=>{const ph=sp&&kp(sp,'nvSpPr','nvPr','ph');return ph?{type:at(ph,'type','obj'),idx:at(ph,'idx',null)}:null};
const normType=t=>t==='ctrTitle'?'title':(t==='subTitle'||t==='obj'||t==='body'||t==='chart'||t==='tbl'||t==='pic'||t==='media'||t==='clipArt'||t==='dgm'||t==='object')?'body':t;
function findPh(part,ph,master){if(!part||!ph)return null;const tree=spTree(part);if(!tree)return null;const sps=kids(tree,'sp');
 if(!master){for(const s of sps){const q=phOf(s);if(q&&ph.idx!=null&&q.idx===ph.idx)return s}
  for(const s of sps){const q=phOf(s);if(q&&normType(q.type)===normType(ph.type)&&(ph.idx==null||q.idx==null||ph.type==='title'||ph.type==='ctrTitle'))return s}return null}
 for(const s of sps){const q=phOf(s);if(q&&normType(q.type)===normType(ph.type))return s}return null}

// ---------- tree drawing
function drawTree(g,tree,part,env){if(!tree)return;for(const ch of tree.children){
 try{switch(ch.localName){case 'sp':case 'cxnSp':drawSp(g,ch,env);break;case 'pic':drawPic(g,ch,env);break;case 'grpSp':drawGrp(g,ch,env);break;case 'graphicFrame':drawFrame(g,ch,env);break}}catch(e){console.error(e)}}}
function drawGrp(g,grp,env){const x=kp(grp,'grpSpPr','xfrm');if(!x){drawTree(g,grp,env.part,env);return}
 const o=kid(x,'off'),e=kid(x,'ext'),co=kid(x,'chOff'),ce=kid(x,'chExt'),k=env.k,ex=nat(e,'cx',1)||1,ey=nat(e,'cy',1)||1,cx=nat(ce,'cx',ex)||ex,cy=nat(ce,'cy',ey)||ey,sx=ex/cx,sy=ey/cy;
 g.save();const ox=nat(o,'x',0)*k,oy=nat(o,'y',0)*k,w=ex*k,h=ey*k;g.translate(ox+w/2,oy+h/2);g.rotate(nat(x,'rot',0)/60000*Math.PI/180);if(at(x,'flipH','0')==='1')g.scale(-1,1);if(at(x,'flipV','0')==='1')g.scale(1,-1);g.translate(-w/2,-h/2);
 g.translate(0,0);g.scale(sx,sy);g.translate(-nat(co,'x',0)*k,-nat(co,'y',0)*k);
 // children are drawn in child coords (EMU*k); group origin maps chOff -> 0
 drawTree(g,grp,env.part,env);g.restore()}
function drawSp(g,sp,env){const cnv=kp(sp,'nvSpPr','cNvPr')||kp(sp,'nvCxnSpPr','cNvPr');if(at(cnv,'hidden','0')==='1')return;
 const ph=phOf(sp);if(ph&&env.part.kind!=='slide')return;
 const lay=ph?findPh(env.s.part.layout,ph,false):null,mas=ph?findPh(env.s.part.master,lay?(phOf(lay)||ph):ph,true):null;
 let xf=xfrmOf(sp,env)||(lay&&xfrmOf(lay,env))||(mas&&xfrmOf(mas,env));
 if(!xf){if(ph&&!kid(sp,'txBody'))return;xf={x:0,y:0,w:0,h:0,rot:0,fh:0,fv:0}}
 const spPr=kid(sp,'spPr'),style=kid(sp,'style'),isCxn=sp.localName==='cxnSp',w=xf.w,h=xf.h;
 g.save();g.translate(xf.x+w/2,xf.y+h/2);g.rotate(xf.rot*Math.PI/180);
 const geomEl=kid(spPr,'prstGeom'),cust=kid(spPr,'custGeom'),prst=isCxn?(at(geomEl,'prst','line')):at(geomEl,'prst',(cust?'cust':'rect'));
 const av=kid(geomEl,'avLst'),shapePath=()=>{g.save();g.translate(-w/2,-h/2);if(cust)custPath(g,cust,w,h);else presetPath(g,prst,w,h,av);g.restore()};
 // flips apply to geometry only
 const geomPath=()=>{g.save();g.scale(xf.fh?-1:1,xf.fv?-1:1);g.translate(-w/2,-h/2);if(cust)custPath(g,cust,w,h);else presetPath(g,prst,w,h,av);g.restore()};
 let fill=spPr?fillOfSpPr(spPr,env):undefined;
 if(fill===undefined&&style&&!isCxn){const fr=kid(style,'fillRef'),idx=nat(fr,'idx',0);if(idx>0){const c=colorOf(fr,env),el=env.theme.fills[idx-1];fill=el?fillOfEl(el,{...env,phClr:c}):{k:'solid',c}}}
 const noFillGeom=['line','straightConnector1','bentConnector3'].includes(prst);
 if(fill&&!noFillGeom)paintFillTransformed(g,fill,{x:-w/2,y:-h/2,w,h},env,geomPath);
 const ln=lineOf(spPr,style,env);if(ln){strokeLine(g,ln,geomPath);if(noFillGeom)arrowHeads(g,ln,w,h,xf)}
 const tb=kid(sp,'txBody');
 if(tb&&hasText(tb)){g.save();g.translate(-w/2,-h/2);drawTextBody(g,tb,{w,h},env,{sp,ph,lay,mas,style,spPr});g.restore()}
 g.restore()}
function paintFillTransformed(g,fill,box,env,pathFn){paintFill(g,fill,box,env,pathFn)}
function arrowHeads(g,ln,w,h,xf){const mk=(x,y,ang)=>{g.save();g.translate(x,y);g.rotate(ang);g.fillStyle=css(ln.c);const s=Math.max(6,ln.w*3);g.beginPath();g.moveTo(0,0);g.lineTo(-s,s/2);g.lineTo(-s,-s/2);g.closePath();g.fill();g.restore()};
 const x1=xf.fh?w/2:-w/2,y1=xf.fv?h/2:-h/2,x2=xf.fh?-w/2:w/2,y2=xf.fv?-h/2:h/2,a=Math.atan2(y2-y1,x2-x1);
 if(ln.tail&&at(ln.tail,'type','none')!=='none')mk(x2,y2,a);if(ln.head&&at(ln.head,'type','none')!=='none')mk(x1,y1,a+Math.PI)}
const hasText=tb=>kids(tb,'p').some(p=>Array.from(p.children).some(c=>c.localName==='r'||c.localName==='fld'))
function drawPic(g,pic,env){const xf=xfrmOf(pic,env);if(!xf)return;const bf=kid(pic,'blipFill'),b=kid(bf,'blip'),id=rattr(b,'embed'),bm=env.part.imgs[id];
 const spPr=kid(pic,'spPr'),prst=at(kid(spPr,'prstGeom'),'prst','rect'),w=xf.w,h=xf.h;
 g.save();g.translate(xf.x+w/2,xf.y+h/2);g.rotate(xf.rot*Math.PI/180);g.scale(xf.fh?-1:1,xf.fv?-1:1);
 if(prst!=='rect'){g.save();g.translate(-w/2,-h/2);presetPath(g,prst,w,h,kid(kid(spPr,'prstGeom'),'avLst'));g.restore();g.clip()}
 if(bm)drawBitmap(g,bm,{x:-w/2,y:-h/2,w,h},kid(bf,'srcRect'));else{g.fillStyle='#e4e4e4';g.fillRect(-w/2,-h/2,w,h);env.warn.add('تصویر پشتیبانی‌نشده')}
 g.restore();const ln=lineOf(spPr,null,env);if(ln){g.save();g.translate(xf.x+w/2,xf.y+h/2);g.rotate(xf.rot*Math.PI/180);strokeLine(g,ln,()=>{g.beginPath();g.rect(-w/2,-h/2,w,h)});g.restore()}}
function drawFrame(g,fr,env){const o=kid(fr,'xfrm'),off=kid(o,'off'),ext=kid(o,'ext');if(!o)return;const k=env.k,box={x:nat(off,'x',0)*k,y:nat(off,'y',0)*k,w:nat(ext,'cx',0)*k,h:nat(ext,'cy',0)*k};
 const gd=kp(fr,'graphic','graphicData'),tbl=kid(gd,'tbl');
 if(tbl){drawTable(g,tbl,box,env);return}
 const uri=at(gd,'uri','');env.warn.add(/chart/.test(uri)?'نمودار':/diagram/.test(uri)?'SmartArt':'شیء پشتیبانی‌نشده');
 g.save();g.fillStyle='#f1f3f6';g.fillRect(box.x,box.y,box.w,box.h);g.setLineDash([8,6]);g.strokeStyle='#9aa4b5';g.lineWidth=2;g.strokeRect(box.x,box.y,box.w,box.h);g.setLineDash([]);g.fillStyle='#6b7487';g.font=`${Math.max(14,box.h/10)}px sans-serif`;g.textAlign='center';g.textBaseline='middle';g.fillText(/chart/.test(uri)?'نمودار (نمایش داده نمی‌شود)':'عنصر پشتیبانی‌نشده',box.x+box.w/2,box.y+box.h/2);g.restore()}

// ---------- tables
function drawTable(g,tbl,box,env){const k=env.k,pr=kid(tbl,'tblPr'),rtl=at(pr,'rtl','0')==='1',first=at(pr,'firstRow','0')==='1',band=at(pr,'bandRow','0')==='1';
 const cols=kids(kp(tbl,'tblGrid'),'gridCol').map(c=>nat(c,'w',0)*k),rows=kids(tbl,'tr'),hs=rows.map(r=>nat(r,'h',0)*k);
 const xs=[];let acc=0;cols.forEach(w=>{xs.push(acc);acc+=w});const totalW=acc||box.w;
 const colX=i=>rtl?box.x+box.w-xs[i]-cols[i]:box.x+xs[i];
 let y=box.y;const occ={};
 rows.forEach((tr,ri)=>{const cells=kids(tr,'tc');let ci=0;
  for(const tc of cells){while(occ[ri+','+ci])ci++;const gs=nat(tc,'gridSpan',1),rs=nat(tc,'rowSpan',1);
   const isMerged=at(tc,'hMerge','0')==='1'||at(tc,'vMerge','0')==='1';
   for(let a=0;a<rs;a++)for(let b=0;b<gs;b++)if(a||b)occ[(ri+a)+','+(ci+b)]=1;
   if(!isMerged){let cw=0;for(let b=0;b<gs;b++)cw+=cols[ci+b]||0;let ch=0;for(let a=0;a<rs;a++)ch+=hs[ri+a]||0;
    const cx=rtl?colX(ci+gs-1):colX(ci);drawCell(g,tc,{x:cx,y,w:cw,h:ch},env,{ri,first:first&&ri===0,band:band&&!(first&&ri===0),odd:(ri-(first?1:0))%2===0})}
   ci+=gs}
  y+=hs[ri]||0})}
function drawCell(g,tc,box,env,o){const pr=kid(tc,'tcPr');let fill=pr?fillOfSpPr(pr,env):undefined;let txtColor=null,bold=false;
 const acc=env.theme.colors.accent1;
 if(fill===undefined){if(o.first){fill={k:'solid',c:[...acc,1]};txtColor=[255,255,255,1];bold=true}else if(o.band){const t=o.odd?.4:.2;fill={k:'solid',c:[...acc.map(c=>c*t+255*(1-t)),1].map((v,i)=>i<3?Math.round(v):v)}}}
 if(fill&&fill.k!=='none'&&fill.c||fill&&fill.k!=='solid'&&fill.k!=='none')paintFill(g,fill,box,env,()=>{g.beginPath();g.rect(box.x,box.y,box.w,box.h)});
 g.save();g.strokeStyle='rgba(255,255,255,.9)';g.lineWidth=Math.max(1,env.k*12700);const hasB=pr&&['lnL','lnR','lnT','lnB'].some(n=>kid(pr,n));
 if(hasB){for(const [n,f] of [['lnL',b=>[b.x,b.y,b.x,b.y+b.h]],['lnR',b=>[b.x+b.w,b.y,b.x+b.w,b.y+b.h]],['lnT',b=>[b.x,b.y,b.x+b.w,b.y]],['lnB',b=>[b.x,b.y+b.h,b.x+b.w,b.y+b.h]]]){const l=kid(pr,n);if(!l||kid(l,'noFill'))continue;const c=colorOf(kid(l,'solidFill'),env);if(!c)continue;g.strokeStyle=css(c);g.lineWidth=Math.max(1,nat(l,'w',12700)*env.k);const[a,b2,c2,d2]=f(box);g.beginPath();g.moveTo(a,b2);g.lineTo(c2,d2);g.stroke()}}
 else{g.strokeRect(box.x,box.y,box.w,box.h)}
 g.restore();
 const tb=kid(tc,'txBody');if(!tb||!hasText(tb))return;
 g.save();g.translate(box.x,box.y);
 const ins={l:nat(pr,'marL',91440)*env.k,r:nat(pr,'marR',91440)*env.k,t:nat(pr,'marT',45720)*env.k,b:nat(pr,'marB',45720)*env.k};
 drawTextBody(g,tb,{w:box.w,h:box.h},env,{sp:null,ph:null,tcAnchor:at(pr,'anchor','t'),ins,forceColor:txtColor,forceBold:bold});g.restore()}

// ---------- text
function mergeR(out,el,env){if(!el)return out;for(const a of ['sz','b','i','u','strike','baseline']){if(el.hasAttribute(a))out[a]=el.getAttribute(a)}
 for(const c of el.children){if(c.localName==='latin'&&c.getAttribute('typeface'))out.font=c.getAttribute('typeface');else if(c.localName==='cs'&&c.getAttribute('typeface'))out.cs=c.getAttribute('typeface');else if(c.localName==='solidFill')out.fill=c;else if(c.localName==='gradFill')out.fill=c}return out}
function mergeP(out,pPr){if(!pPr)return out;for(const a of ['marL','marR','indent','algn','rtl','lvl'])if(pPr.hasAttribute(a))out[a]=pPr.getAttribute(a);
 for(const c of pPr.children){const n=c.localName;
  if(n==='defRPr')out.rPr=mergeR(Object.assign({},out.rPr||{}),c);
  else if(n==='buNone')out.bu=null;else if(n==='buChar')out.bu={ch:c.getAttribute('char')};else if(n==='buAutoNum')out.bu={auto:c.getAttribute('type'),start:nat(c,'startAt',1)};
  else if(n==='buFont')out.buFont=c.getAttribute('typeface');else if(n==='buClr')out.buClr=c;else if(n==='buSzPct')out.buSz=nat(c,'val',100000)/100000;
  else if(n==='spcBef')out.spcBef=spc(c);else if(n==='spcAft')out.spcAft=spc(c);else if(n==='lnSpc')out.lnSpc=spc(c)}return out}
function spc(c){const p=kid(c,'spcPct'),q=kid(c,'spcPts');return p?{pct:nat(p,'val',100000)/100000}:q?{pts:nat(q,'val',0)/100}:null}
const lvlEl=(list,lvl)=>list?kid(list,'lvl'+(lvl+1)+'pPr'):null;
const isRtlCh=/[֐-ࣿיִ-﷿ﹰ-﻿]/,isLtrCh=/[A-Za-z0-9À-ɏ]/;
const fontStack=(rs,env)=>{let f=rs.font||'';if(f==='+mj-lt')f=env.theme.major;else if(f==='+mn-lt'||!f)f=env.theme.minor;const list=[];for(const n of [rs.cs,f]){if(n&&!n.startsWith('+'))list.push('"'+n.replace(/"/g,'')+'"')}
 list.push('Vazirmatn','Tahoma','"Noto Sans Arabic"','"DejaVu Sans"','Arial','sans-serif');return list.join(',')};
function drawTextBody(g,tb,box,env,o){
 const s=env.s,ph=o.ph,lay=o.lay,mas=o.mas,master=s.part.master,pres=env.deck.defText;
 // style chain (low -> high)
 const lists=[pres];const ms=master&&kp(master.doc.documentElement,'txStyles');
 const t=ph?normType(ph.type):null;
 if(ph&&t==='title')lists.push(kid(ms,'titleStyle'));else if(ph&&t==='body')lists.push(kid(ms,'bodyStyle'));else lists.push(kid(ms,'otherStyle'));
 if(mas)lists.push(kp(mas,'txBody','lstStyle'));if(lay)lists.push(kp(lay,'txBody','lstStyle'));lists.push(kid(tb,'lstStyle'));
 // body props
 const bp={};for(const el of [mas&&kp(mas,'txBody','bodyPr'),lay&&kp(lay,'txBody','bodyPr'),kid(tb,'bodyPr')])if(el)for(const a of el.attributes)bp[a.name]=a.value;
 const auto=kid(kid(tb,'bodyPr'),'normAutofit')||(lay&&kid(kp(lay,'txBody','bodyPr'),'normAutofit'))||(mas&&kid(kp(mas,'txBody','bodyPr'),'normAutofit'));
 let fscale=1;const na=kid(kid(tb,'bodyPr'),'normAutofit');if(na&&na.hasAttribute('fontScale'))fscale=nat(na,'fontScale',100000)/100000;
 const k=env.k;
 const get=(n,d)=>bp[n]!=null?+bp[n]:d,pad=o.ins||{l:get('lIns',91440)*k,r:get('rIns',91440)*k,t:get('tIns',45720)*k,b:get('bIns',45720)*k};
 const anchor=o.tcAnchor||bp.anchor||'t',wrap=bp.wrap!=='none';
 const innerW=Math.max(1,box.w-pad.l-pad.r),innerH=box.h-pad.t-pad.b;
 // default text color (shape style fontRef)
 const fr=o.style&&kid(o.style,'fontRef');const defColor=o.forceColor||(fr?colorOf(fr,env):null);
 let lay1=null;
 for(let it=0;it<7;it++){lay1=layoutParas(g,tb,lists,{innerW,wrap,fscale:fscale*Math.pow(.92,it),env,defColor,o,rootBp:bp});if(!auto||lay1.height<=innerH+1||it===6)break}
 let y0=anchor==='ctr'?(box.h-lay1.height)/2:anchor==='b'?box.h-pad.b-lay1.height:pad.t;if(anchor==='ctr'||anchor==='b')y0=Math.max(anchor==='ctr'?(box.h-lay1.height)/2:y0,0);
 paintParas(g,lay1,{x:pad.l,y:y0,w:innerW,env,defColor})}
function layoutParas(g,tb,lists,c){const env=c.env,k=env.k,paras=[];const counters={};let height=0;let first=true;
 for(const p of kids(tb,'p')){const pPr=kid(p,'pPr'),lvl=nat(pPr,'lvl',0);const props={};
  for(const l of lists)mergeP(props,lvlEl(l,lvl));mergeP(props,pPr);if(c.defColor&&!c.o.ph&&props.rPr)props.rPr.fill=null;
  const items=[];let anyText='';
  const mkRun=(rPr,text)=>{const rs=mergeR(Object.assign({},props.rPr||{}),rPr);if(c.o.forceColor)rs.fill=null;const szPt=(rs.sz?+rs.sz/100:18)*c.fscale;return{text,rs,px:szPt*EMU_PT*k,b:(rs.b==='1'||rs.b==='true')||!!c.o.forceBold,i:rs.i==='1'||rs.i==='true',u:rs.u&&rs.u!=='none',strike:rs.strike&&rs.strike!=='noStrike',base:nat({getAttribute:()=>rs.baseline,hasAttribute:()=>rs.baseline!=null},'x',0)||(rs.baseline?+rs.baseline:0),font:fontStack(rs,env)}};
  let lastR=null;
  for(const ch of p.children){const n=ch.localName;
   if(n==='r'||n==='fld'){let text=Array.from(ch.children).filter(e=>e.localName==='t').map(e=>e.textContent).join('');const ft=ch.getAttribute&&ch.getAttribute('type')||'';if(n==='fld'&&/slidenum/i.test(ft))text=String(env.slideNo);const run=mkRun(kid(ch,'rPr'),text);lastR=run;anyText+=text;items.push(run)}
   else if(n==='br'){const run=mkRun(kid(ch,'rPr'),'');run.br=true;items.push(run)}}
  const endR=mkRun(kid(p,'endParaRPr'),'');
  const rtl=props.rtl!=null?props.rtl==='1':isRtlCh.test(anyText.replace(/[^\p{L}]/gu,'').charAt(0)||'');
  const algn=props.algn||(rtl?'r':'l');
  const marL=(+props.marL||0)*k,indent=(+props.indent||0)*k;
  let bullet=null;
  if(props.bu&&anyText.trim()){const bsz=(props.buSz||1);if(props.bu.ch)bullet={t:props.bu.ch};else if(props.bu.auto){const key=lvl;counters[key]=(counters[key]==null?props.bu.start-1:counters[key])+1;bullet={t:autoNum(props.bu.auto,counters[key])};}
   if(bullet){bullet.px=(items[0]?items[0].px:endR.px)*bsz;bullet.font=props.buFont&&!props.buFont.startsWith('+')?`"${props.buFont}",Arial,sans-serif`:(items[0]?items[0].font:endR.font);bullet.color=props.buClr?colorOf(props.buClr,env):null}}
  else if(!props.bu||!anyText.trim()){for(const kk of Object.keys(counters))if(+kk>=lvl)delete counters[kk]}
  // words
  const toks=[];for(const it of items){if(it.br){toks.push({br:true,run:it});continue}for(const w of (it.text.match(/\S+\s*|\s+/g)||[]))toks.push({t:w,run:it})}
  const fontOf=r=>`${r.i?'italic ':''}${r.b?'bold ':''}${Math.max(1,r.px)}px ${r.font}`;
  let bulletW=0;if(bullet){g.font=`${Math.max(1,bullet.px)}px ${bullet.font}`;bulletW=g.measureText(bullet.t).width}
  let startM=marL,firstStart=marL+indent;if(bullet){if(indent>=0){firstStart=marL+indent+bulletW+bullet.px*.3}else firstStart=marL}
  for(const t of toks){if(t.br)continue;g.font=fontOf(t.run);t.font=g.font;t.w=g.measureText(t.t).width;t.wt=g.measureText(t.t.replace(/\s+$/,'')).width;t.rtl=isRtlCh.test(t.t);t.ltr=!t.rtl&&isLtrCh.test(t.t)}
  // wrap
  const lines=[];let cur={toks:[],w:0};const availOf=n=>Math.max(10,c.innerW-(n===0?firstStart:startM));
  for(const t of toks){if(t.br){lines.push(cur);cur={toks:[],w:0,afterBr:true};continue}
   const av=c.wrap?availOf(lines.length):Infinity;if(cur.toks.length&&cur.w+t.wt>av){lines.push(cur);cur={toks:[],w:0}}cur.toks.push(t);cur.w+=t.w}
  lines.push(cur);
  const base=(items[0]||endR);const lnPct=props.lnSpc&&props.lnSpc.pct?props.lnSpc.pct:1;
  for(const ln of lines){const last=ln.toks[ln.toks.length-1];ln.wv=ln.w-(last?(last.w-last.wt):0);let mx=0;for(const t of ln.toks)mx=Math.max(mx,t.run.px);if(!ln.toks.length)mx=base.px;ln.px=mx;ln.h=mx*1.2*lnPct}
  const before=first?0:(props.spcBef?(props.spcBef.pts!=null?props.spcBef.pts*EMU_PT*k:props.spcBef.pct*base.px*1.2):0),after=props.spcAft?(props.spcAft.pts!=null?props.spcAft.pts*EMU_PT*k:props.spcAft.pct*base.px*1.2):0;
  first=false;const ph_=lines.reduce((a,l)=>a+l.h,0);
  paras.push({lines,rtl,algn,marL:startM,first:firstStart,bpos:marL+indent,bullet,before,after,color:null,lnPct,y:height+before});height+=before+ph_+after}
 return{paras,height,innerW:c.innerW}}
function autoNum(t,n){const ar=['۰','۱','۲','۳','۴','۵','۶','۷','۸','۹'];if(/alphaLc/.test(t))return String.fromCharCode(96+((n-1)%26)+1)+(/Period/.test(t)?'.':')');if(/alphaUc/.test(t))return String.fromCharCode(64+((n-1)%26)+1)+'.';return n+(/Paren/.test(t)?')':'.')}
function paintParas(g,lay,o){const env=o.env;g.save();g.textBaseline='alphabetic';
 for(const p of lay.paras){let y=o.y+p.y;
  p.lines.forEach((ln,li)=>{const first=li===0,start=first?p.first:p.marL,avail=o.w-start;let order=ln.toks;
   if(p.rtl){const groups=[];let curG=null;for(const t of ln.toks){const isL=t.ltr&&!t.rtl;if(curG&&curG.l===isL)curG.a.push(t);else{curG={l:isL,a:[t]};groups.push(curG)}}order=[];const sp=t=>t.w-t.wt;for(const gr of groups){if(gr.l){gr.a.forEach((t,i)=>{t.lead=0;t.trail=i<gr.a.length-1?sp(t):0});gr.a[0].lead=sp(gr.a[gr.a.length-1])}else gr.a.forEach(t=>{t.lead=sp(t);t.trail=0})}for(const gr of groups.reverse())order.push(...(gr.l?gr.a:gr.a.slice().reverse()))}
   if(!p.rtl)ln.toks.forEach(t=>{t.lead=0;t.trail=t.w-t.wt});
   let x;const wv=ln.wv;
   if(p.rtl){const right=o.x+o.w-start;x=p.algn==='l'?o.x:p.algn==='ctr'?right-avail/2-wv/2:right-wv}else{const left=o.x+start;x=p.algn==='r'?left+avail-wv:p.algn==='ctr'?left+avail/2-wv/2:left}
   // justify
   let extra=0;if((p.algn==='just'||p.algn==='dist')&&li<p.lines.length-1&&ln.toks.length>1){extra=(avail-wv)/(ln.toks.length-1)}
   const baseY=y+ln.px*1.0+(ln.h-ln.px*1.2)*(p.lnPct>1?1:0);
   // bullet
   if(first&&p.bullet){g.font=`${Math.max(1,p.bullet.px)}px ${p.bullet.font}`;g.fillStyle=css(p.bullet.color||colorOfRun(ln.toks[0]?.run,env,o.defColor));g.direction=p.rtl?'rtl':'ltr';
    if(p.rtl){g.textAlign='right';g.fillText(p.bullet.t,o.x+o.w-p.bpos,baseY)}else{g.textAlign='left';g.fillText(p.bullet.t,o.x+p.bpos,baseY)}}
   order.forEach((t,ti)=>{const r=t.run;g.font=t.font;g.fillStyle=css(colorOfRun(r,env,o.defColor));const by=baseY-(r.base?r.px*r.base/100*.6:0);
    const rtlTok=t.rtl||(p.rtl&&!t.ltr);g.direction=rtlTok?'rtl':'ltr';
    const wi=t.lead+t.wt+t.trail+extra;const tt=t.t.replace(/\s+$/,'');if(rtlTok){g.textAlign='right';g.fillText(tt,x+t.lead+t.wt,by)}else{g.textAlign='left';g.fillText(tt,x+t.lead,by)}
    if(r.u||r.strike){g.save();g.strokeStyle=g.fillStyle;g.lineWidth=Math.max(1,r.px/16);const tw=t.wt;const xa=x+t.lead;const yy=r.u?by+r.px*.1:by-r.px*.3;g.beginPath();g.moveTo(xa,yy);g.lineTo(xa+tw,yy);g.stroke();g.restore()}
    x+=wi});
   y+=ln.h})}
 g.restore()}
function colorOfRun(r,env,def){if(!r)return def||[0,0,0,1];if(r.rs&&r.rs.fill){if(r.rs.fill.localName==='gradFill'){const f=fillOfEl(r.rs.fill,env);return f.stops[0]?f.stops[0].c:[0,0,0,1]}const c=colorOf(r.rs.fill,env);if(c)return c}
 if(def)return def;return colorOf({localName:'schemeClr',getAttribute:()=>'tx1',children:[]},env)||[0,0,0,1]}

window.PPTX={load};
})();
