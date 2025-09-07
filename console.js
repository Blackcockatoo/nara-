
// Local data helpers
const DB = {
  get(key, fallback){ try{ return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }catch(e){ return fallback; }},
  set(key, val){ localStorage.setItem(key, JSON.stringify(val)); }
};

// ===== Recorder =====
let mediaRecorder, chunks = [], stream=null;
const recBtn = document.getElementById('recBtn');
const stopBtn = document.getElementById('stopBtn');
const tagSel = document.getElementById('tag');
const noteTa = document.getElementById('note');
const clipsDiv = document.getElementById('clips');

async function startRec(){
  try{
    stream = await navigator.mediaDevices.getUserMedia({audio:true});
    mediaRecorder = new MediaRecorder(stream);
    chunks = [];
    mediaRecorder.ondataavailable = e=> chunks.push(e.data);
    mediaRecorder.onstop = saveClip;
    mediaRecorder.start();
    recBtn.disabled = true; stopBtn.disabled = False = false;
    recBtn.textContent='Recording…';
  }catch(e){
    alert('Microphone permission denied or unsupported.');
  }
}
function stopRec(){
  if(mediaRecorder && mediaRecorder.state!=='inactive'){
    mediaRecorder.stop();
  }
  if(stream){ stream.getTracks().forEach(t=>t.stop()); }
  recBtn.disabled=false; stopBtn.disabled=true; recBtn.textContent='Start Recording';
}
recBtn.onclick = startRec;
stopBtn.onclick = stopRec;

function saveClip(){
  const blob = new Blob(chunks, {type:'audio/webm'});
  const url = URL.createObjectURL(blob);
  const entry = {
    ts: Date.now(),
    tag: tagSel.value,
    note: noteTa.value.trim(),
    audio: url
  };
  const list = DB.get('cc_clips', []);
  list.push(entry);
  DB.set('cc_clips', list);
  renderClips();
  noteTa.value='';
}

function renderClips(){
  const list = DB.get('cc_clips', []);
  clipsDiv.innerHTML='';
  list.slice().reverse().forEach((c,i)=>{
    const card = document.createElement('div');
    card.className='card';
    card.innerHTML = `<div class="small">${new Date(c.ts).toLocaleString()} · <b>${c.tag}</b></div>
      <p>${c.note||''}</p>
      <audio controls src="${c.audio}"></audio>`;
    clipsDiv.appendChild(card);
  });
}
renderClips();

// ===== Carrot Meter =====
let carrots = DB.get('cc_carrots', 0);
let resets = DB.get('cc_resets', 0);
const carrotsEl = document.getElementById('carrots');
const resetsEl = document.getElementById('resets');
const fill = document.getElementById('meterFill');

function updateMeter(){
  carrotsEl.textContent = carrots;
  resetsEl.textContent = resets;
  fill.style.width = Math.min(100, carrots%100) + '%';
}
updateMeter();

document.getElementById('add1').onclick = ()=>{ carrots+=1; DB.set('cc_carrots', carrots); updateMeter(); };
document.getElementById('add5').onclick = ()=>{ carrots+=5; DB.set('cc_carrots', carrots); updateMeter(); };

document.getElementById('resetToken').onclick = ()=>{
  resets += 1; DB.set('cc_resets', resets); updateMeter();
  const saved = carrots;
  const start = Date.now();
  const cool = 60000; // 60s cool period
  const timer = setInterval(()=>{
    const t = Date.now()-start;
    const frac = Math.min(1, t/cool);
    const reduce = Math.round(saved * (1-frac) * 0.15); // gentle dip up to 15%
    fill.style.width = Math.min(100, ((saved-reduce)%100)) + '%';
    if(frac>=1){ clearInterval(timer); updateMeter(); }
  }, 200);
};

// ===== Weekly Digest =====
function computeDigest(){
  const clips = DB.get('cc_clips', []);
  const startOfWeek = new Date(); // rudimentary: last 7 days
  startOfWeek.setDate(startOfWeek.getDate()-7);
  const weekClips = clips.filter(c=> c.ts>=startOfWeek.getTime());
  return {
    generatedAt: new Date().toISOString(),
    totals: {carrots, resets, clips: weekClips.length},
    entries: weekClips
  };
}

function exportHTML(){
  const d = computeDigest();
  const rows = d.entries.map(e=> `<tr><td>${new Date(e.ts).toLocaleString()}</td><td>${e.tag}</td><td>${(e.note||'').replace(/</g,'&lt;')}</td></tr>`).join('');
  const html = `<!doctype html><html><head><meta charset="utf-8">
  <style>body{font-family:Arial,Helvetica,sans-serif;background:#0b1020;color:#e6e9ef;padding:20px}
  table{width:100%;border-collapse:collapse} td,th{border:1px solid #2a2f52;padding:8px} th{background:#111935}</style>
  <title>Carrot Console — Weekly Digest</title></head><body>
  <h1>Carrot Console — Weekly Digest</h1>
  <p><b>Generated:</b> ${d.generatedAt}</p>
  <p><b>Carrots:</b> ${d.totals.carrots} · <b>Resets:</b> ${d.totals.resets} · <b>Clips:</b> ${d.totals.clips}</p>
  <table><thead><tr><th>Time</th><th>Tag</th><th>Note</th></tr></thead><tbody>${rows}</tbody></table>
  </body></html>`;
  const blob = new Blob([html], {type:'text/html'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download='carrot_console_weekly.html'; a.click(); URL.revokeObjectURL(url);
}

function exportJSON(){
  const d = computeDigest();
  const blob = new Blob([JSON.stringify(d,null,2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download='carrot_console_weekly.json'; a.click(); URL.revokeObjectURL(url);
}

document.getElementById('exportHTML').onclick = exportHTML;
document.getElementById('exportJSON').onclick = exportJSON;
document.getElementById('clearAll').onclick = ()=>{
  if(confirm('Clear all Carrot Console local data?')){
    localStorage.removeItem('cc_clips');
    localStorage.removeItem('cc_carrots');
    localStorage.removeItem('cc_resets');
    carrots=0; resets=0; updateMeter(); renderClips();
  }
};
