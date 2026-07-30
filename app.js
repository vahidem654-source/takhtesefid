/* ===================== تخته‌کلاس — منطق برنامه ===================== */
(function(){
"use strict";

/* ---------- عناصر پایه ---------- */
const bgCanvas = document.getElementById('bgCanvas');
const drawCanvas = document.getElementById('drawCanvas');
const boardStage = document.getElementById('boardStage');
const boardWrap = document.getElementById('boardWrap');
const bgCtx = bgCanvas.getContext('2d');
const drawCtx = drawCanvas.getContext('2d');

const toast = document.getElementById('toast');
function showToast(msg, ms=2200){
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(()=>toast.classList.remove('show'), ms);
}

/* ---------- ابعاد تخته ---------- */
function fitStage(){
  const maxW = boardWrap.clientWidth - 24;
  const maxH = boardWrap.clientHeight - 24;
  const ratio = 16/9;
  let w = maxW, h = w/ratio;
  if(h > maxH){ h = maxH; w = h*ratio; }
  boardStage.style.width = w+'px';
  boardStage.style.height = h+'px';
  [bgCanvas, drawCanvas].forEach(c=>{
    const dpr = window.devicePixelRatio || 1;
    c.width = w*dpr; c.height = h*dpr;
    c.getContext('2d').setTransform(dpr,0,0,dpr,0,0);
  });
  redrawBackground();
}
window.addEventListener('resize', ()=>{ fitStage(); });

/* ---------- وضعیت ابزارها ---------- */
const state = {
  tool:'pen',
  color:'#e2a33d',
  size:4,
  micOn:true,
  camOn:false,
  drawing:false,
  startX:0, startY:0,
  snapshotBeforeShape:null,
};

document.querySelectorAll('.tool-btn').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    document.querySelectorAll('.tool-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    state.tool = btn.dataset.tool;
  });
});

const colorPicker = document.getElementById('colorPicker');
const colorSwatch = document.getElementById('colorSwatch');
colorPicker.addEventListener('input', e=>{
  state.color = e.target.value;
  colorSwatch.style.background = state.color;
  sizePreview.style.background = state.color;
});
colorSwatch.style.background = state.color;

const sizeRange = document.getElementById('sizeRange');
const sizePreview = document.getElementById('sizePreview');
sizePreview.style.background = state.color;
function updateSizePreview(){
  const s = Math.max(4, Math.min(26, state.size));
  sizePreview.style.width = s+'px';
  sizePreview.style.height = s+'px';
}
sizeRange.addEventListener('input', e=>{ state.size = +e.target.value; updateSizePreview(); });
updateSizePreview();

/* ---------- تاریخچه (واگرد/ازنو) — جدا برای هر «سند» (تخته آزاد یا هر صفحه کتاب) ---------- */
function currentDocKey(){ return currentDoc==='book' ? ('pdf-'+book.page) : currentDoc; }
const historyStore = {}; // key -> {stack:[dataURL...], idx:number}
function ensureHistory(key){
  if(!historyStore[key]) historyStore[key] = {stack:[drawCanvas_toBlankOrSaved(key)], idx:0};
  return historyStore[key];
}
function drawCanvas_toBlankOrSaved(key){
  return null; // بار اول بوم خالی است
}
function pushHistory(){
  const key = currentDocKey();
  const h = ensureHistory(key);
  h.stack = h.stack.slice(0, h.idx+1);
  h.stack.push(drawCanvas.toDataURL());
  if(h.stack.length>25) h.stack.shift();
  h.idx = h.stack.length-1;
}
function restoreFromDataURL(url){
  const dpr = window.devicePixelRatio||1;
  drawCtx.setTransform(1,0,0,1,0,0);
  drawCtx.clearRect(0,0,drawCanvas.width, drawCanvas.height);
  drawCtx.setTransform(dpr,0,0,dpr,0,0);
  if(!url) return;
  const img = new Image();
  img.onload = ()=>{
    drawCtx.setTransform(1,0,0,1,0,0);
    drawCtx.drawImage(img,0,0,drawCanvas.width, drawCanvas.height);
    drawCtx.setTransform(dpr,0,0,dpr,0,0);
  };
  img.src = url;
}
function undo(){
  const key = currentDocKey();
  const h = ensureHistory(key);
  if(h.idx<=0){ clearDraw(); return; }
  h.idx--;
  restoreFromDataURL(h.stack[h.idx]);
}
function redo(){
  const key = currentDocKey();
  const h = ensureHistory(key);
  if(h.idx>=h.stack.length-1) return;
  h.idx++;
  restoreFromDataURL(h.stack[h.idx]);
}
function clearDraw(){
  const dpr = window.devicePixelRatio||1;
  drawCtx.setTransform(1,0,0,1,0,0);
  drawCtx.clearRect(0,0,drawCanvas.width, drawCanvas.height);
  drawCtx.setTransform(dpr,0,0,dpr,0,0);
}
document.getElementById('btnUndo').addEventListener('click', undo);
document.getElementById('btnRedo').addEventListener('click', redo);
document.getElementById('btnClear').addEventListener('click', ()=>{
  clearDraw(); pushHistory();
});

/* ---------- رسم آزاد و اشکال ---------- */
function getPos(e){
  const rect = drawCanvas.getBoundingClientRect();
  const t = (e.touches && e.touches[0]) || e;
  return { x: t.clientX-rect.left, y: t.clientY-rect.top };
}
let lastPt = null;
function pointerDown(e){
  e.preventDefault();
  state.drawing = true;
  const p = getPos(e);
  lastPt = p;
  state.startX = p.x; state.startY = p.y;
  if(['line','rect','circle','triangle'].includes(state.tool)){
    state.snapshotBeforeShape = drawCanvas.toDataURL();
  }
  if(state.tool==='text'){
    state.drawing=false;
    const txt = prompt('متن مورد نظر را وارد کنید:');
    if(txt){
      drawCtx.fillStyle = state.color;
      drawCtx.font = (14+state.size*2)+'px Vazirmatn, sans-serif';
      drawCtx.textBaseline='top';
      drawCtx.fillText(txt, p.x, p.y);
      pushHistory();
    }
  }
}
function pointerMove(e){
  if(!state.drawing) return;
  e.preventDefault();
  const p = getPos(e);
  if(state.tool==='pen' || state.tool==='highlighter' || state.tool==='eraser'){
    drawCtx.save();
    drawCtx.lineJoin='round'; drawCtx.lineCap='round';
    if(state.tool==='eraser'){
      drawCtx.globalCompositeOperation='destination-out';
      drawCtx.lineWidth = state.size*2.2;
    } else {
      drawCtx.globalCompositeOperation='source-over';
      drawCtx.strokeStyle = state.color;
      drawCtx.lineWidth = state.tool==='highlighter' ? state.size*2.5 : state.size;
      drawCtx.globalAlpha = state.tool==='highlighter' ? 0.35 : 1;
    }
    drawCtx.beginPath();
    drawCtx.moveTo(lastPt.x, lastPt.y);
    drawCtx.lineTo(p.x, p.y);
    drawCtx.stroke();
    drawCtx.restore();
    lastPt = p;
  } else if(['line','rect','circle','triangle'].includes(state.tool)){
    restoreFromDataURLSync(state.snapshotBeforeShape);
    drawCtx.save();
    drawCtx.strokeStyle = state.color;
    drawCtx.lineWidth = state.size;
    drawCtx.lineJoin='round'; drawCtx.lineCap='round';
    drawShape(state.tool, state.startX, state.startY, p.x, p.y);
    drawCtx.restore();
  }
}
function restoreFromDataURLSync(url){
  // نسخه‌ی همزمان برای پیش‌نمایش حین کشیدن شکل (بدون انتظار لود تصویر جدید هر بار، از کش تصویر استفاده می‌کند)
  if(!restoreFromDataURLSync._img || restoreFromDataURLSync._src!==url){
    restoreFromDataURLSync._img = new Image();
    restoreFromDataURLSync._src = url;
    restoreFromDataURLSync._img.src = url;
  }
  const dpr = window.devicePixelRatio||1;
  drawCtx.setTransform(1,0,0,1,0,0);
  drawCtx.clearRect(0,0,drawCanvas.width, drawCanvas.height);
  drawCtx.setTransform(dpr,0,0,dpr,0,0);
  const img = restoreFromDataURLSync._img;
  if(img.complete && img.naturalWidth){
    drawCtx.setTransform(1,0,0,1,0,0);
    drawCtx.drawImage(img,0,0,drawCanvas.width, drawCanvas.height);
    drawCtx.setTransform(dpr,0,0,dpr,0,0);
  }
}
function drawShape(tool,x1,y1,x2,y2){
  drawCtx.beginPath();
  if(tool==='line'){
    drawCtx.moveTo(x1,y1); drawCtx.lineTo(x2,y2);
  } else if(tool==='rect'){
    drawCtx.rect(Math.min(x1,x2), Math.min(y1,y2), Math.abs(x2-x1), Math.abs(y2-y1));
  } else if(tool==='circle'){
    const r = Math.hypot(x2-x1,y2-y1);
    drawCtx.arc(x1,y1,r,0,Math.PI*2);
  } else if(tool==='triangle'){
    drawCtx.moveTo(x1, y2);
    drawCtx.lineTo((x1+x2)/2, y1);
    drawCtx.lineTo(x2, y2);
    drawCtx.closePath();
  }
  drawCtx.stroke();
}
function pointerUp(e){
  if(!state.drawing) return;
  state.drawing=false;
  pushHistory();
}
['mousedown','touchstart'].forEach(ev=>drawCanvas.addEventListener(ev, pointerDown, {passive:false}));
['mousemove','touchmove'].forEach(ev=>drawCanvas.addEventListener(ev, pointerMove, {passive:false}));
['mouseup','touchend','mouseleave'].forEach(ev=>drawCanvas.addEventListener(ev, pointerUp, {passive:false}));

/* ---------- تم روز/شب ---------- */
const btnDay = document.getElementById('btnDay');
btnDay.addEventListener('click', ()=>{
  document.body.classList.toggle('day');
  document.body.classList.toggle('night-board');
  redrawBackground();
});

/* ---------- تمام‌صفحه ---------- */
document.getElementById('btnFullscreen').addEventListener('click', ()=>{
  if(!document.fullscreenElement){ document.documentElement.requestFullscreen().catch(()=>{}); }
  else { document.exitFullscreen(); }
});

/* ---------- راهنما ---------- */
document.getElementById('btnHelp').addEventListener('click', ()=>document.getElementById('modalOverlay').classList.add('open'));
document.getElementById('btnCloseModal').addEventListener('click', ()=>document.getElementById('modalOverlay').classList.remove('open'));

/* ---------- سه «سند» قابل‌جابه‌جایی: تخته خالی، عکس، کتاب ---------- */
let currentDoc = 'board'; // 'board' | 'image' | 'book'
const docStore = {}; // 'board'/'image' -> آخرین وضعیت نقاشی (dataURL). صفحات کتاب در book.pageStore نگه داشته می‌شود.

function saveCurrentDrawState(){
  if(currentDoc==='book') book.pageStore[book.page] = drawCanvas.toDataURL();
  else docStore[currentDoc] = drawCanvas.toDataURL();
}
function updateSwitcherButtons(){
  document.querySelectorAll('#docSwitcher .doc-btn').forEach(b=>{
    b.classList.toggle('active', b.dataset.doc===currentDoc);
  });
}
async function switchDoc(target){
  if(target===currentDoc) return;
  if(target==='image' && !bgImage) return showToast('هنوز عکسی بارگذاری نشده.');
  if(target==='book' && !book.pdf) return showToast('هنوز کتابی بارگذاری نشده.');
  saveCurrentDrawState();
  currentDoc = target;
  document.getElementById('pageNav').style.display = (target==='book') ? 'flex' : 'none';
  if(target==='book'){
    await renderBookPage(); // خودش پس‌زمینه و یادداشت همان صفحه را برمی‌گرداند
  } else {
    redrawBackground();
    restoreFromDataURL(docStore[target] || null);
    historyStore[target] = {stack:[docStore[target]||null], idx:0};
  }
  updateSwitcherButtons();
}
document.querySelectorAll('#docSwitcher .doc-btn').forEach(btn=>{
  btn.addEventListener('click', ()=>{ if(!btn.disabled) switchDoc(btn.dataset.doc); });
});

/* ---------- آپلود عکس ---------- */
let bgImage = null;
document.getElementById('btnUploadImg').addEventListener('click', ()=>document.getElementById('fileImg').click());
document.getElementById('fileImg').addEventListener('change', e=>{
  const f = e.target.files[0]; if(!f) return;
  const img = new Image();
  img.onload = ()=>{
    saveCurrentDrawState();
    bgImage = img;
    currentDoc = 'image';
    document.getElementById('pageNav').style.display='none';
    docStore['image'] = null;
    redrawBackground();
    clearDraw();
    historyStore['image'] = {stack:[null], idx:0};
    document.getElementById('btnDocImage').disabled = false;
    updateSwitcherButtons();
    showToast('عکس روی تخته بارگذاری شد — حالا می‌توانید رویش بنویسید.');
  };
  img.src = URL.createObjectURL(f);
});

function redrawBackground(){
  const dpr = window.devicePixelRatio||1;
  bgCtx.setTransform(1,0,0,1,0,0);
  bgCtx.clearRect(0,0,bgCanvas.width,bgCanvas.height);
  bgCtx.setTransform(dpr,0,0,dpr,0,0);
  const w = bgCanvas.width/dpr, h = bgCanvas.height/dpr;
  if(currentDoc==='book' && book.pageCanvas){
    bgCtx.drawImage(book.pageCanvas,0,0,w,h);
  } else if(currentDoc==='image' && bgImage){
    // fit-contain
    const ir = bgImage.width/bgImage.height, br = w/h;
    let dw,dh,dx,dy;
    if(ir>br){ dw=w; dh=w/ir; dx=0; dy=(h-dh)/2; } else { dh=h; dw=h*ir; dy=0; dx=(w-dw)/2; }
    bgCtx.fillStyle = document.body.classList.contains('day') ? '#fff':'#132a2b';
    bgCtx.fillRect(0,0,w,h);
    bgCtx.drawImage(bgImage,dx,dy,dw,dh);
  }
}

/* ---------- آپلود کتاب / PDF ---------- */
const book = { pdf:null, page:1, numPages:1, pageCanvas:null, pageStore:{} };
if(window['pdfjsLib']){
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}
document.getElementById('btnUploadBook').addEventListener('click', ()=>document.getElementById('fileBook').click());
document.getElementById('fileBook').addEventListener('change', async e=>{
  const f = e.target.files[0]; if(!f) return;
  showToast('در حال باز کردن کتاب…');
  saveCurrentDrawState();
  const buf = await f.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({data:buf}).promise;
  book.pdf = pdf; book.numPages = pdf.numPages; book.page = 1; book.pageStore = {};
  currentDoc = 'book';
  document.getElementById('pageNav').style.display='flex';
  document.getElementById('btnDocBook').disabled = false;
  await renderBookPage();
  updateSwitcherButtons();
  showToast('کتاب بارگذاری شد — می‌توانید روی هر صفحه یادداشت بنویسید.');
});
async function renderBookPage(){
  const page = await book.pdf.getPage(book.page);
  const vp = page.getViewport({scale:2});
  const off = document.createElement('canvas');
  off.width = vp.width; off.height = vp.height;
  await page.render({canvasContext: off.getContext('2d'), viewport: vp}).promise;
  book.pageCanvas = off;
  redrawBackground();
  restoreFromDataURL(book.pageStore[book.page] || null);
  historyStore['pdf-'+book.page] = {stack:[book.pageStore[book.page]||null], idx:0};
  document.getElementById('pgLabel').textContent = toFa(book.page)+' / '+toFa(book.numPages);
}
function toFa(n){ return String(n).replace(/[0-9]/g, d=>'۰۱۲۳۴۵۶۷۸۹'[d]); }
function saveCurrentPageAnnotation(){
  if(currentDoc==='book') book.pageStore[book.page] = drawCanvas.toDataURL();
}
document.getElementById('pgPrev').addEventListener('click', async ()=>{
  if(currentDoc!=='book' || book.page<=1) return;
  saveCurrentPageAnnotation();
  book.page--; await renderBookPage();
});
document.getElementById('pgNext').addEventListener('click', async ()=>{
  if(currentDoc!=='book' || book.page>=book.numPages) return;
  saveCurrentPageAnnotation();
  book.page++; await renderBookPage();
});

/* ---------- دوربین معلم (PiP) ---------- */
const camPiP = document.getElementById('camPiP');
const camVideo = document.getElementById('camVideo');
let camStream = null;
document.getElementById('btnCam').addEventListener('click', async ()=>{
  if(state.camOn){
    if(camStream) camStream.getTracks().forEach(t=>t.stop());
    camStream=null; camPiP.style.display='none'; state.camOn=false;
    return;
  }
  try{
    camStream = await navigator.mediaDevices.getUserMedia({video:true, audio:false});
    camVideo.srcObject = camStream;
    camPiP.style.display='block';
    state.camOn = true;
  }catch(err){
    showToast('دسترسی به دوربین ممکن نشد. مرورگر/دستگاه را بررسی کنید.');
  }
});
// درگ کردن PiP
(function makeDraggable(el){
  let dragging=false, sx=0, sy=0, ox=0, oy=0;
  el.addEventListener('mousedown', e=>{
    if(e.target.id==='camResize') return;
    dragging=true; sx=e.clientX; sy=e.clientY;
    const r = el.getBoundingClientRect(); const pr = boardStage.getBoundingClientRect();
    ox = r.left-pr.left; oy = r.top-pr.top;
    el.style.insetInlineEnd='auto';
  });
  window.addEventListener('mousemove', e=>{
    if(!dragging) return;
    const dx = e.clientX-sx, dy = e.clientY-sy;
    el.style.left = Math.max(0,ox+dx)+'px';
    el.style.top = Math.max(0,oy+dy)+'px';
  });
  window.addEventListener('mouseup', ()=>dragging=false);
  // resize
  const rs = document.getElementById('camResize');
  let resizing=false, rsx=0, rsy=0, rw=0, rh=0;
  rs.addEventListener('mousedown', e=>{ e.stopPropagation(); resizing=true; rsx=e.clientX; rsy=e.clientY; rw=el.clientWidth; rh=el.clientHeight; });
  window.addEventListener('mousemove', e=>{
    if(!resizing) return;
    const dx = rsx-e.clientX;
    const w = Math.max(90, rw+dx);
    el.style.width = w+'px'; el.style.height = (w*0.75)+'px';
  });
  window.addEventListener('mouseup', ()=>resizing=false);
})(camPiP);

/* ---------- کامپوزیت تخته (برای ضبط و پخش زنده) ---------- */
const compCanvas = document.createElement('canvas');
const compCtx = compCanvas.getContext('2d');
let compRunning = false;
function startCompositeLoop(){
  compRunning = true;
  function loop(){
    if(!compRunning) return;
    const w = boardStage.clientWidth, h = boardStage.clientHeight;
    if(compCanvas.width!==w*2){ compCanvas.width=w*2; compCanvas.height=h*2; }
    compCtx.clearRect(0,0,compCanvas.width, compCanvas.height);
    compCtx.drawImage(bgCanvas,0,0,compCanvas.width, compCanvas.height);
    compCtx.drawImage(drawCanvas,0,0,compCanvas.width, compCanvas.height);
    if(state.camOn && camPiP.style.display==='block'){
      const r = camPiP.getBoundingClientRect(); const pr = boardStage.getBoundingClientRect();
      const scaleX = compCanvas.width/pr.width, scaleY = compCanvas.height/pr.height;
      const x=(r.left-pr.left)*scaleX, y=(r.top-pr.top)*scaleY, w2=r.width*scaleX, h2=r.height*scaleY;
      compCtx.save();
      compCtx.translate(x+w2,y); compCtx.scale(-1,1);
      compCtx.drawImage(camVideo,0,0,w2,h2);
      compCtx.restore();
      compCtx.strokeStyle = '#e2a33d'; compCtx.lineWidth=4; compCtx.strokeRect(x,y,w2,h2);
    }
    requestAnimationFrame(loop);
  }
  loop();
}
startCompositeLoop();

/* ---------- ضبط ویدیو ---------- */
const sidePanel = document.getElementById('sidePanel');
const panelRecord = document.getElementById('panelRecord');
const panelLive = document.getElementById('panelLive');
function openPanel(which){
  sidePanel.classList.add('open');
  panelRecord.style.display = which==='rec' ? 'block':'none';
  panelLive.style.display = which==='live' ? 'block':'none';
}
document.getElementById('btnRecordPanel').addEventListener('click', ()=>openPanel('rec'));
document.getElementById('btnLivePanel').addEventListener('click', ()=>openPanel('live'));

let mediaRecorder=null, recChunks=[], micStreamForRec=null;
document.getElementById('btnMicToggle').addEventListener('click', function(){
  this.classList.toggle('active');
  this.textContent = this.classList.contains('active') ? 'روشن' : 'خاموش';
});
document.getElementById('btnStartRec').addEventListener('click', async ()=>{
  const quality = document.getElementById('qualitySelect').value;
  const presets = {
    low:  {w:1280,h:720, bitrate:1_200_000},
    med:  {w:1600,h:900, bitrate:2_500_000},
    high: {w:1920,h:1080,bitrate:4_500_000},
  };
  const p = presets[quality];
  compCanvas.width = p.w; compCanvas.height = p.h;

  const videoStream = compCanvas.captureStream(30);
  let finalStream = videoStream;
  const micBtn = document.getElementById('btnMicToggle');
  if(micBtn.classList.contains('active')){
    try{
      micStreamForRec = await navigator.mediaDevices.getUserMedia({audio:true});
      finalStream = new MediaStream([...videoStream.getVideoTracks(), ...micStreamForRec.getAudioTracks()]);
    }catch(e){ showToast('میکروفن در دسترس نیست؛ ضبط بدون صدا انجام می‌شود.'); }
  }
  let mimeType = 'video/webm;codecs=vp9,opus';
  if(!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/webm;codecs=vp8,opus';
  if(!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/webm';
  recChunks = [];
  mediaRecorder = new MediaRecorder(finalStream, {mimeType, videoBitsPerSecond:p.bitrate});
  mediaRecorder.ondataavailable = e=>{ if(e.data.size>0) recChunks.push(e.data); };
  mediaRecorder.onstop = ()=>{
    const blob = new Blob(recChunks, {type:'video/webm'});
    const url = URL.createObjectURL(blob);
    const mb = (blob.size/1024/1024).toFixed(1);
    document.getElementById('downloadArea').innerHTML =
      `<p class="hint">حجم فایل: ${mb} مگابایت</p><a class="btn" download="clip.webm" href="${url}" style="display:flex;justify-content:center;margin-top:6px;text-decoration:none;">⬇ دانلود کلیپ</a>`;
    document.getElementById('recIndicator').style.display='none';
    if(micStreamForRec) micStreamForRec.getTracks().forEach(t=>t.stop());
  };
  mediaRecorder.start(1000);
  document.getElementById('recIndicator').style.display='flex';
  document.getElementById('btnStartRec').disabled = true;
  document.getElementById('btnStopRec').disabled = false;
  showToast('ضبط شروع شد');
});
document.getElementById('btnStopRec').addEventListener('click', ()=>{
  if(mediaRecorder && mediaRecorder.state!=='inactive') mediaRecorder.stop();
  document.getElementById('btnStartRec').disabled = false;
  document.getElementById('btnStopRec').disabled = true;
});

/* ===================== کلاس آنلاین (PeerJS، بدون سرور اختصاصی) ===================== */
let peer=null, isTeacher=false, teacherId=null;
const studentConns = {}; // id -> {conn, name, mediaCall}
let liveMicStream=null;
let boardLiveStream=null; // ویدیوی تخته برای پخش زنده

function buildBoardLiveStream(){
  compCanvas.width = 1280; compCanvas.height = 720;
  return compCanvas.captureStream(24);
}

document.getElementById('btnStartClass').addEventListener('click', ()=>{
  isTeacher = true;
  const custom = document.getElementById('roomNameInput').value.trim()
    .toLowerCase().replace(/[^a-z0-9-]/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'');
  peer = custom ? new Peer(custom) : new Peer(); // از بروکر رایگان و عمومی PeerJS استفاده می‌شود؛ نیازی به سرور شخصی نیست
  peer.on('open', id=>{
    teacherId = id;
    document.getElementById('classCode').textContent = id;
    document.getElementById('classCode').dataset.full = id;
    document.getElementById('teacherClassBox').style.display='block';
    document.getElementById('btnStartClass').disabled = true;
    document.getElementById('roomNameInput').disabled = true;
    showToast('کلاس آماده است. لینک دعوت را برای دانش‌آموزان بفرستید.');
  });
  peer.on('connection', conn=>{
    conn.on('data', data=>handleTeacherData(conn, data));
    conn.on('open', ()=>{ studentConns[conn.peer] = studentConns[conn.peer]||{conn,name:'دانش‌آموز'}; });
  });
  peer.on('call', call=>{
    const meta = call.metadata||{};
    if(meta.type==='join'){
      // دانش‌آموز درخواست دریافت تصویر/صدای تخته را دارد
      if(!boardLiveStream) boardLiveStream = buildBoardLiveStream();
      let streamToSend = boardLiveStream;
      navigator.mediaDevices.getUserMedia({audio:true}).then(mic=>{
        streamToSend = new MediaStream([...boardLiveStream.getVideoTracks(), ...mic.getAudioTracks()]);
        call.answer(streamToSend);
      }).catch(()=> call.answer(boardLiveStream));
    } else if(meta.type==='cam'){
      call.answer();
      call.on('stream', stream=>{
        addRemoteStudentVideo(meta.name||'دانش‌آموز', stream, call.peer);
      });
    }
  });
  peer.on('error', err=>{
    console.error(err);
    if(err.type==='unavailable-id'){
      showToast('این نام کلاس قبلاً در حال استفاده است؛ نام دیگری امتحان کنید یا خالی بگذارید.');
      document.getElementById('roomNameInput').disabled = false;
    } else {
      showToast('خطا در اتصال کلاس: '+err.type);
    }
  });
});

function handleTeacherData(conn, data){
  if(data.type==='name'){
    studentConns[conn.peer] = studentConns[conn.peer]||{conn};
    studentConns[conn.peer].name = data.name;
    studentConns[conn.peer].conn = conn;
    renderStudentList();
  } else if(data.type==='raiseCam'){
    const s = studentConns[conn.peer];
    const name = s ? s.name : 'دانش‌آموز';
    if(confirm(`«${name}» درخواست نمایش دوربین دارد. تایید می‌کنید؟`)){
      conn.send({type:'camApproved'});
    } else {
      conn.send({type:'camDenied'});
    }
  }
}
function renderStudentList(){
  const box = document.getElementById('studentList');
  const items = Object.values(studentConns);
  if(!items.length){ box.innerHTML = '<p class="hint">هنوز کسی وصل نشده…</p>'; return; }
  box.innerHTML = items.map(s=>`<div class="student-item"><span><span class="mic-dot"></span>${escapeHtml(s.name||'دانش‌آموز')}</span><span class="badge">آنلاین</span></div>`).join('');
}
function addRemoteStudentVideo(name, stream, id){
  const wrap = document.getElementById('remoteVideos');
  let vid = document.getElementById('rv-'+id);
  if(!vid){
    const holder = document.createElement('div');
    holder.innerHTML = `<p class="hint" style="margin-bottom:2px">🎥 ${escapeHtml(name)}</p><video id="rv-${id}" autoplay playsinline></video>`;
    wrap.appendChild(holder);
    vid = holder.querySelector('video');
  }
  vid.srcObject = stream;
}
function escapeHtml(s){ return String(s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

document.getElementById('btnCopyLink').addEventListener('click', ()=>{
  const id = document.getElementById('classCode').dataset.full;
  const link = location.href.split('#')[0] + '#room=' + id;
  navigator.clipboard.writeText(link).then(()=>showToast('لینک کپی شد ✅')).catch(()=>{
    showToast('کپی خودکار ممکن نشد؛ لینک را دستی کپی کنید.');
  });
});
document.getElementById('btnCopyCode').addEventListener('click', ()=>{
  const id = document.getElementById('classCode').dataset.full;
  navigator.clipboard.writeText(id).then(()=>showToast('کد کپی شد ✅')).catch(()=>{
    showToast('کپی خودکار ممکن نشد؛ کد را دستی کپی کنید.');
  });
});

/* ---------- ورود دانش‌آموز ---------- */
let studentPeer=null, studentConnToTeacher=null, studentTeacherId=null;
document.getElementById('btnJoinClass').addEventListener('click', ()=>{
  const name = document.getElementById('studentName').value.trim();
  let code = document.getElementById('joinCode').value.trim();
  if(!name) return showToast('لطفاً اسم را وارد کنید.');
  if(!code) return showToast('کد کلاس را وارد کنید.');
  document.getElementById('btnJoinClass').disabled = true;
  document.getElementById('joinStatusHint').textContent = 'در حال اتصال به کلاس…';
  joinClass(code, name);
});
// اگر از طریق لینک با room= باز شده باشد، وارد «حالت دانش‌آموز» شو و فقط فرم ورود ساده را نشان بده
(function checkHashJoin(){
  const m = location.hash.match(/room=([a-zA-Z0-9-]+)/);
  if(m){
    document.getElementById('joinCode').value = m[1];
    document.getElementById('joinCode').readOnly = true;
    document.body.classList.add('student-mode');
    document.getElementById('joinStatusHint').textContent = 'کد کلاس به‌طور خودکار وارد شد — فقط اسم خود را بنویسید و وارد شوید.';
    openPanel('live');
    setTimeout(()=>document.getElementById('studentName').focus(), 300);
  }
})();

function friendlyPeerError(type){
  if(type==='peer-unavailable') return 'اتصال برقرار نشد: این لینک/کد معتبر نیست یا معلم هنوز کلاس را شروع نکرده. از معلم بخواهید دوباره «شروع کلاس» را بزند و لینک تازه را برایتان بفرستد.';
  if(type==='network' || type==='server-error' || type==='socket-error' || type==='socket-closed') return 'اتصال به شبکه برقرار نشد؛ اینترنت خود را بررسی کنید و دوباره امتحان کنید.';
  if(type==='unavailable-id') return 'این کد در حال حاضر استفاده شده؛ دوباره تلاش کنید.';
  return 'اتصال ناموفق بود ('+type+').';
}

function joinClass(teacherPeerId, name){
  studentTeacherId = teacherPeerId;
  studentPeer = new Peer();
  studentPeer.on('open', ()=>{
    studentConnToTeacher = studentPeer.connect(teacherPeerId);
    studentConnToTeacher.on('open', ()=>{
      studentConnToTeacher.send({type:'name', name});
    });
    studentConnToTeacher.on('data', data=>{
      if(data.type==='camApproved') startStudentCam();
      if(data.type==='camDenied') showToast('معلم درخواست را رد کرد.');
    });
    // درخواست دریافت جریان تخته از معلم
    const dummy = new MediaStream();
    const call = studentPeer.call(teacherPeerId, dummy, {metadata:{type:'join'}});
    call.on('stream', stream=>{
      document.getElementById('teacherStreamVideo').srcObject = stream;
      document.getElementById('studentClassBox').style.display='block';
      document.getElementById('joinStatusHint').textContent = '';
      document.getElementById('studentJoinTitle').style.display='none';
      document.querySelectorAll('#studentJoinSection > .pre-join-row').forEach(r=>r.style.display='none');
      showToast('به کلاس وصل شدید ✅');
    });
    call.on('error', err=>{
      console.error(err);
      document.getElementById('joinStatusHint').textContent = friendlyPeerError(err.type||'call-error');
      document.getElementById('btnJoinClass').disabled = false;
    });
    call.on('close', ()=>{
      document.getElementById('joinStatusHint').textContent = 'ارتباط با کلاس قطع شد.';
    });
  });
  studentPeer.on('error', err=>{
    console.error(err);
    document.getElementById('joinStatusHint').textContent = friendlyPeerError(err.type);
    document.getElementById('btnJoinClass').disabled = false;
  });
}
document.getElementById('btnRaiseCam').addEventListener('click', ()=>{
  if(studentConnToTeacher) studentConnToTeacher.send({type:'raiseCam'});
  showToast('درخواست شما برای معلم ارسال شد.');
});
async function startStudentCam(){
  try{
    const stream = await navigator.mediaDevices.getUserMedia({video:true, audio:true});
    const name = document.getElementById('studentName').value.trim();
    studentPeer.call(studentTeacherId, stream, {metadata:{type:'cam', name}});
    showToast('دوربین شما برای معلم ارسال شد.');
  }catch(e){ showToast('دسترسی به دوربین ممکن نشد.'); }
}

/* ---------- شروع اولیه ---------- */
window.addEventListener('load', ()=>{ fitStage(); });

/* ---------- ثبت Service Worker برای نصب و کارکرد آفلاین ---------- */
if('serviceWorker' in navigator){
  window.addEventListener('load', ()=>{
    navigator.serviceWorker.register('./sw.js').catch(()=>{});
  });
}
let deferredInstallPrompt = null;
window.addEventListener('beforeinstallprompt', e=>{
  e.preventDefault();
  deferredInstallPrompt = e;
  const btn = document.createElement('button');
  btn.textContent = '📲 نصب برنامه';
  btn.id = 'btnInstallApp';
  btn.addEventListener('click', ()=>{
    if(deferredInstallPrompt){ deferredInstallPrompt.prompt(); deferredInstallPrompt=null; btn.remove(); }
  });
  document.querySelector('.header-actions').prepend(btn);
});

})();
