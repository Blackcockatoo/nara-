// console.js (v0.2) — Carrot Console upgrades
// - Asset references moved to /assets in index.html
// - Recorder with duration + waveform
// - Meter snapshot via <canvas>
// - CSV export
// - PWA-safe (no external libs), accessibility & safety prompts
// - Settings modal + include settings in digest

const els = {
  start: document.getElementById('startBtn'),
  stop: document.getElementById('stopBtn'),
  save: document.getElementById('saveBtn'),
  tag: document.getElementById('tagSelect'),
  note: document.getElementById('noteInput'),
  timer: document.getElementById('recTimer'),
  wave: document.getElementById('waveCanvas'),
  clips: document.getElementById('clips'),
  carrot1: document.getElementById('carrot1'),
  carrot5: document.getElementById('carrot5'),
  resetToken: document.getElementById('resetToken'),
  meterLabel: document.getElementById('meterLabel'),
  progressBar: document.getElementById('progressBar'),
  exportHtml: document.getElementById('exportHtml'),
  exportJson: document.getElementById('exportJson'),
  exportCsv: document.getElementById('exportCsv'),
  importJson: document.getElementById('importJson'),
  openSettings: document.getElementById('openSettingsBtn'),
  wipeAll: document.getElementById('wipeAllBtn'),
  settingsDialog: document.getElementById('settingsDialog'),
  setClass: document.getElementById('setClass'),
  setStudents: document.getElementById('setStudents'),
  setTeacher: document.getElementById('setTeacher'),
  saveSettings: document.getElementById('saveSettings'),
  meterCanvas: document.getElementById('meterCanvas'),
};

// State
let mediaStream, mediaRecorder, recChunks = [], recStart = 0, recTimerId = 0;
let audioCtx, analyser, sourceNode;

const store = {
  get clips(){ return JSON.parse(localStorage.getItem('cc_clips')||'[]'); },
  set clips(v){ localStorage.setItem('cc_clips', JSON.stringify(v)); },
  get carrots(){ return Number(localStorage.getItem('cc_carrots')||'0'); },
  set carrots(v){ localStorage.setItem('cc_carrots', String(v)); },
  get resets(){ return Number(localStorage.getItem('cc_resets')||'0'); },
  set resets(v){ localStorage.setItem('cc_resets', String(v)); },
  get settings(){ return JSON.parse(localStorage.getItem('cc_settings')||'{}'); },
  set settings(v){ localStorage.setItem('cc_settings', JSON.stringify(v)); },
};

// Utilities
const fmtTime = (s)=>{
  const m = Math.floor(s/60).toString().padStart(2,'0');
  const sec = Math.floor(s%60).toString().padStart(2,'0');
  return `${m}:${sec}`;
};
const download = (name, mime, content)=>{
  const blob = new Blob([content], {type: mime});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(()=>{
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 0);
};

// Recorder
async function startRec(){
  try{
    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  }catch(err){
    alert('Microphone permission is required.');
    return;
  }
  recChunks = [];
  mediaRecorder = new MediaRecorder(mediaStream, { mimeType: 'audio/webm' });
  mediaRecorder.ondataavailable = e => { if (e.data.size) recChunks.push(e.data); };
  mediaRecorder.onstop = ()=> stopWaveform();
  mediaRecorder.start();

  // UI state
  els.start.disabled = true; els.stop.disabled = false; els.save.disabled = true;
  recStart = Date.now();
  recTimerId = setInterval(()=>{
    const secs = (Date.now()-recStart)/1000; els.timer.textContent = fmtTime(secs);
  }, 250);

  startWaveform();
}

function stopRec(){
  if(mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
  if (mediaStream) mediaStream.getTracks().forEach(t=>t.stop());
  clearInterval(recTimerId);
  els.timer.textContent = '00:00';
  els.start.disabled = false; els.stop.disabled = true; els.save.disabled = false;
}

function startWaveform(){
  try{
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;
    sourceNode = audioCtx.createMediaStreamSource(mediaStream);
    sourceNode.connect(analyser);
    drawWave();
  }catch(e){ /* ignore visualizer failures */ }
}

function stopWaveform(){
  try{
    if(sourceNode) sourceNode.disconnect();
    if(audioCtx) audioCtx.close();
  }catch(e){}
}

function drawWave(){
  const ctx = els.wave.getContext('2d');
  const buf = new Uint8Array(analyser.frequencyBinCount);
  const w = els.wave.width, h = els.wave.height;
  function frame(){
    requestAnimationFrame(frame);
    analyser.getByteTimeDomainData(buf);
    ctx.clearRect(0,0,w,h);
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    ctx.fillRect(0,0,w,h);
    ctx.lineWidth = 2; ctx.strokeStyle = '#93d7ef';
    ctx.beginPath();
    const slice = w / buf.length;
    for(let i=0;i<buf.length;i++){
      const v = buf[i]/128.0; const y = v*h/2;
      const x = i*slice; i===0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
    }
    ctx.stroke();
  }
  frame();
}

async function saveClip(){
  if(!recChunks.length){ alert('No audio captured.'); return; }
  const blob = new Blob(recChunks, { type: 'audio/webm' });
  const url = URL.createObjectURL(blob);
  const dur = els.timer.textContent !== '00:00' ? els.timer.textContent : '';
  const clip = {
    id: crypto.randomUUID(),
    ts: Date.now(),
    tag: els.tag.value,
    note: els.note.value.trim(),
    url,
    size: blob.size,
    dur,
  };
  const clips = store.clips; clips.unshift(clip); store.clips = clips;
  els.note.value=''; recChunks = []; els.save.disabled = true;
  renderClips();
}

function renderClips(){
  const clips = store.clips;
  els.clips.setAttribute('aria-busy','true');
  els.clips.innerHTML = '';
  for(const c of clips){
    const div = document.createElement('div'); div.className = 'clip';
    const d = new Date(c.ts);
    div.innerHTML = `
      <header>
        <strong>${c.tag}</strong>
        <small>${d.toLocaleString()} ${c.dur?`· ${c.dur}`:''} · ${(c.size/1024).toFixed(1)} KB</small>
      </header>
      ${c.note?`<div>${escapeHtml(c.note)}</div>`:''}
      <audio controls src="${c.url}" aria-label="Playback for ${c.tag} clip"></audio>
      <div>
        <button class="btn danger" data-id="${c.id}">Delete</button>
      </div>
    `;
    div.querySelector('button').addEventListener('click', (e)=>{
      const id = e.currentTarget.getAttribute('data-id');
      if(confirm('Delete this clip? This cannot be undone.')){
        const after = store.clips.filter(x=>x.id!==id);
        store.clips = after; renderClips();
      }
    });
    els.clips.appendChild(div);
  }
  els.clips.setAttribute('aria-busy','false');
}

function escapeHtml(s){ return s.replace(/[&<>"]+/g, m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[m])); }

// Carrot meter
function updateMeter(){
  const carrots = store.carrots; const resets = store.resets;
  const pct = Math.min(100, Math.round((carrots%100)));
  els.progressBar.style.width = pct + '%';
  els.progressBar.parentElement.setAttribute('aria-valuenow', pct);
  els.meterLabel.textContent = `${carrots} carrots · ${resets} resets`;
}

function drawMeterSnapshot(){
  const c = els.meterCanvas; const ctx = c.getContext('2d');
  const w = c.width, h = c.height;
  ctx.clearRect(0,0,w,h);
  // Card background
  ctx.fillStyle = '#0b1530'; ctx.fillRect(0,0,w,h);
  ctx.fillStyle = '#eaf2ff'; ctx.font = '16px system-ui';
  ctx.fillText('Carrot Meter', 12, 22);
  // Bar
  const carrots = store.carrots; const resets = store.resets;
  const pct = Math.min(100, Math.round((carrots%100)));
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.fillRect(12, 40, w-24, 20);
  ctx.fillStyle = '#d7b15f';
  ctx.fillRect(12, 40, Math.round((w-24)*pct/100), 20);
  ctx.fillStyle = '#93d7ef'; ctx.font = '14px system-ui';
  ctx.fillText(`${carrots} carrots · ${resets} resets`, 12, 80);
  return c.toDataURL('image/png');
}

// Exports
function computeDigest(){
  const now = Date.now(); const day = 86400000;
  const weekAgo = now - day*7;
  const clips = store.clips.filter(c=>c.ts>=weekAgo);
  const totals = {
    clips: clips.length,
    carrots: store.carrots,
    resets: store.resets,
  };
  return {clips, totals, settings: store.settings, generatedAt: now};
}

function exportHTML(){
  const digest = computeDigest();
  const img = drawMeterSnapshot();
  const rows = digest.clips.map(c=>{
    const d = new Date(c.ts).toLocaleString();
    return `<tr><td>${d}</td><td>${c.tag}</td><td>${escapeHtml(c.note||'')}</td><td>${c.dur||''}</td><td>${(c.size/1024).toFixed(1)} KB</td></tr>`;
  }).join('');
  const cls = digest.settings.className||'';
  const stu = (digest.settings.students||[]).join(', ');
  const tch = digest.settings.teacher||'';
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Carrot Digest</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body{font-family:system-ui,Segoe UI,Roboto,Inter,sans-serif;padding:16px;color:#111}
    header{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}
    .card{border:1px solid #ddd;border-radius:12px;padding:12px;margin:12px 0}
    table{width:100%;border-collapse:collapse}
    th,td{border-bottom:1px solid #eee;padding:8px;text-align:left}
    small{color:#555}
  </style></head><body>
  <header>
    <h1>Weekly Digest</h1>
    <small>${new Date(digest.generatedAt).toLocaleString()}</small>
  </header>
  <section class="card">
    <strong>Class:</strong> ${cls || '—'}<br/>
    <strong>Teacher/School:</strong> ${tch || '—'}<br/>
    <strong>Students:</strong> ${stu || '—'}
  </section>
  <section class="card">
    <img src="${img}" alt="Carrot meter snapshot" style="max-width:100%;height:auto" />
    <p><strong>Totals:</strong> ${digest.totals.clips} clips · ${digest.totals.carrots} carrots · ${digest.totals.resets} resets</p>
  </section>
  <section class="card">
    <h2>Timeline (7 days)</h2>
    <table><thead><tr><th>When</th><th>Tag</th><th>Note</th><th>Duration</th><th>Size</th></tr></thead>
    <tbody>${rows||'<tr><td colspan="5"><em>No clips in the last 7 days</em></td></tr>'}</tbody></table>
  </section>
  </body></html>`;
  download('carrot-digest.html','text/html',html);
}

function exportJSON(){
  const digest = computeDigest();
  download('carrot-digest.json','application/json', JSON.stringify(digest, null, 2));
}

function exportCSV(){
  const digest = computeDigest();
  const head = ['timestamp','local_time','tag','note','duration','size_kb'];
  const lines = [head.join(',')];
  for(const c of digest.clips){
    const row = [
      c.ts,
      JSON.stringify(new Date(c.ts).toLocaleString()),
      JSON.stringify(c.tag),
      JSON.stringify(c.note||''),
      JSON.stringify(c.dur||''),
      (c.size/1024).toFixed(1),
    ];
    lines.push(row.join(','));
  }
  download('carrot-clips.csv','text/csv', lines.join('\n'));
}

// Import / safety
function importFromJSON(file){
  const reader = new FileReader();
  reader.onload = ()=>{
    try{
      const data = JSON.parse(reader.result);
      if(!confirm('Import JSON? This will merge clips and overwrite settings/totals.')) return;
      if(Array.isArray(data.clips)){
        const merged = [...data.clips, ...store.clips].sort((a,b)=>b.ts-a.ts);
        store.clips = merged;
      }
      if(data.totals){
        if(typeof data.totals.carrots==='number') store.carrots = data.totals.carrots;
        if(typeof data.totals.resets==='number') store.resets = data.totals.resets;
      }
      if(data.settings) store.settings = data.settings;
      renderClips(); updateMeter(); alert('Import complete.');
    }catch(e){ alert('Invalid JSON file.'); }
  };
  reader.readAsText(file);
}

function wipeAll(){
  if(confirm('Wipe ALL local data (clips, carrots, resets, settings)?')){
    localStorage.removeItem('cc_clips');
    localStorage.removeItem('cc_carrots');
    localStorage.removeItem('cc_resets');
    localStorage.removeItem('cc_settings');
    renderClips(); updateMeter();
  }
}

// Settings dialog
function openSettings(){ els.settingsDialog.showModal(); loadSettingsForm(); }
function loadSettingsForm(){
  const s = store.settings || {};
  els.setClass.value = s.className || '';
  els.setStudents.value = (s.students||[]).join(', ');
  els.setTeacher.value = s.teacher || '';
}
function saveSettings(e){
  e.preventDefault();
  const s = {
    className: els.setClass.value.trim(),
    students: els.setStudents.value.split(',').map(s=>s.trim()).filter(Boolean),
    teacher: els.setTeacher.value.trim(),
  };
  store.settings = s;
  els.settingsDialog.close();
}

// Events
els.start.addEventListener('click', startRec);
els.stop.addEventListener('click', stopRec);
els.save.addEventListener('click', saveClip);
els.carrot1.addEventListener('click', ()=>{ store.carrots = store.carrots + 1; updateMeter();});
els.carrot5.addEventListener('click', ()=>{ store.carrots = store.carrots + 5; updateMeter();});
els.resetToken.addEventListener('click', ()=>{ store.resets = store.resets + 1; updateMeter();});
els.exportHtml.addEventListener('click', exportHTML);
els.exportJson.addEventListener('click', exportJSON);
els.exportCsv.addEventListener('click', exportCSV);
els.importJson.addEventListener('change', (e)=>{ if(e.target.files[0]) importFromJSON(e.target.files[0]); });
els.openSettings.addEventListener('click', openSettings);
els.saveSettings.addEventListener('click', saveSettings);
els.wipeAll.addEventListener('click', wipeAll);

// Init
renderClips(); updateMeter();
