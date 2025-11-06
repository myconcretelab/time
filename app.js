// Minimal local-first SPA for gentle time balance tracking

// ---------- Utilities ----------
const $ = (sel, el=document) => el.querySelector(sel);
const $$ = (sel, el=document) => Array.from(el.querySelectorAll(sel));
const fmtMins = (mins) => {
  const h = Math.floor(mins/60); const m = mins%60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
};
const todayStr = () => new Date().toISOString().slice(0,10);
const fmtDateEU = (iso) => { const [y,m,d]=iso.split('-'); return `${d}/${m}`; };
const uid = () => Math.random().toString(36).slice(2,9);

// ---------- Storage ----------
const KEYS = {
  user: 'time/user',
  themes: (u)=>`time/${u}/themes`,
  entries: (u)=>`time/${u}/entries`,
  sizes: (u)=>`time/${u}/sizes`,
  pebbleColor: (u)=>`time/${u}/pebbleColor`, // legacy single color
  pebbleColorTray: (u)=>`time/${u}/pebbleColorTray`,
  pebbleColorChip: (u)=>`time/${u}/pebbleColorChip`,
  ringThickness: (u)=>`time/${u}/ringThickness`,
  handleDiameter: (u)=>`time/${u}/handleDiameter`
};

function loadThemes(user=state.user){
  const raw = localStorage.getItem(KEYS.themes(user));
  if (raw) return JSON.parse(raw);
  const defaults = [
    {id: uid(), name:'Travail manuel', icon:'🧰', color:'#c98b6b', category:'pro'},
    {id: uid(), name:'Enfants', icon:'🧒', color:'#f2a65a', category:'famille'},
    {id: uid(), name:'Création', icon:'🎨', color:'#8bb2b2', category:'créatif'},
    {id: uid(), name:'Repos', icon:'🌿', color:'#9aa380', category:'soin'},
    {id: uid(), name:'Présence', icon:'💞', color:'#c7a0c5', category:'relation'},
    {id: uid(), name:'Administratif', icon:'🗂️', color:'#a5a2a1', category:'tâches'},
  ];
  localStorage.setItem(KEYS.themes(user), JSON.stringify(defaults));
  return defaults;
}
function saveThemes(themes, user=state.user){ localStorage.setItem(KEYS.themes(user), JSON.stringify(themes)); scheduleSync(); }

function loadEntries(user=state.user){
  const raw = localStorage.getItem(KEYS.entries(user));
  return raw ? JSON.parse(raw) : {};
}
function saveEntries(entries, user=state.user){ localStorage.setItem(KEYS.entries(user), JSON.stringify(entries)); scheduleSync(); }

function loadSizes(user=state.user){
  const raw = localStorage.getItem(KEYS.sizes(user));
  if (raw) return JSON.parse(raw);
  const defaults = [30, 60];
  localStorage.setItem(KEYS.sizes(user), JSON.stringify(defaults));
  return defaults;
}
function saveSizes(sizes, user=state.user){ localStorage.setItem(KEYS.sizes(user), JSON.stringify(sizes)); scheduleSync(); }

function loadPebbleColorTray(user=state.user){
  return localStorage.getItem(KEYS.pebbleColorTray(user)) || localStorage.getItem(KEYS.pebbleColor(user)) || '#edeae4';
}
function savePebbleColorTray(color, user=state.user){
  localStorage.setItem(KEYS.pebbleColorTray(user), color);
  scheduleSync();
}
function loadPebbleColorChip(user=state.user){
  return localStorage.getItem(KEYS.pebbleColorChip(user)) || localStorage.getItem(KEYS.pebbleColor(user)) || '#edeae4';
}
function savePebbleColorChip(color, user=state.user){
  localStorage.setItem(KEYS.pebbleColorChip(user), color);
  scheduleSync();
}

function loadRingThickness(user=state.user){
  const v = Number(localStorage.getItem(KEYS.ringThickness(user)));
  return Number.isFinite(v) && v>0 ? v : 16;
}
function saveRingThickness(px, user=state.user){
  localStorage.setItem(KEYS.ringThickness(user), String(px));
  scheduleSync();
}

function loadHandleDiameter(user=state.user){
  const v = Number(localStorage.getItem(KEYS.handleDiameter(user)));
  return Number.isFinite(v) && v>0 ? v : 16;
}
function saveHandleDiameter(px, user=state.user){
  localStorage.setItem(KEYS.handleDiameter(user), String(px));
  scheduleSync();
}

function getEntry(date){
  const entries = loadEntries();
  if (!entries[date]) entries[date] = { pebbles: [], note: '', emotion: '' };
  return entries[date];
}
function setEntry(date, entry){
  const entries = loadEntries();
  entries[date] = entry; saveEntries(entries);
}

// ---------- State ----------
let state = {
  tab: 'today',
  date: todayStr(),
  user: localStorage.getItem(KEYS.user) || 'Seb',
  themes: [],
  sizes: [],
  pebbleTray: '#edeae4',
  pebbleChip: '#edeae4',
  ringThickness: 16,
  handleDiameter: 16
};

// ---------- Tabs ----------
function initTabs(){
  const activate = (btn)=>{
    const tab = btn.dataset.tab;
    state.tab = tab;
    $$('.tab').forEach(b=>{
      const isActive = b===btn;
      b.classList.toggle('active', isActive);
      b.setAttribute('aria-selected', String(isActive));
      if (isActive) b.setAttribute('aria-current','page'); else b.removeAttribute('aria-current');
    });
    $$('.view').forEach(v=>v.classList.remove('active'));
    const view = document.getElementById('view-'+tab);
    if (view) view.classList.add('active');
    if (tab==='stats') renderStats();
    if (tab==='settings') renderSettings();
  };
  $$('.tab').forEach(btn => btn.addEventListener('click', () => activate(btn)));
  // Keyboard navigation for bottom nav
  const tabs = $$('.bottom-nav .tab');
  tabs.forEach((btn, idx)=>{
    btn.addEventListener('keydown', (e)=>{
      if (e.key==='ArrowRight' || e.key==='ArrowLeft'){
        e.preventDefault();
        const dir = e.key==='ArrowRight' ? 1 : -1;
        const next = tabs[(idx + dir + tabs.length) % tabs.length];
        next.focus();
      } else if (e.key==='Enter' || e.key===' '){
        e.preventDefault(); activate(btn);
      }
    });
  });
}

// ---------- Today View ----------
function initDate(){
  const input = $('#date');
  input.value = state.date;
  input.addEventListener('change', () => {
    state.date = input.value || todayStr();
    renderToday();
  });
  $('#prev-day').addEventListener('click', ()=>{ state.date = addDays(dateFromISO(state.date), -1).toISOString().slice(0,10); input.value = state.date; renderToday(); });
  $('#next-day').addEventListener('click', ()=>{ state.date = addDays(dateFromISO(state.date), +1).toISOString().slice(0,10); input.value = state.date; renderToday(); });
}

function totalsByTheme(entry){
  const totals = Object.fromEntries(state.themes.map(t=>[t.id,0]));
  for (const p of entry.pebbles) totals[p.themeId] = (totals[p.themeId]||0) + p.minutes;
  return totals;
}

function renderToday(skipWeekStrip=false){
  // buckets
  const container = $('#buckets');
  container.innerHTML = '';
  const entry = getEntry(state.date);
  const totals = totalsByTheme(entry);
  // total de jour retiré de l'en-tête (plus de #day-total)

  if (!skipWeekStrip) renderWeekStrip();

  for (const t of state.themes){
    const bucket = document.createElement('div');
    bucket.className = 'bucket';
    bucket.dataset.themeId = t.id;
    // header + dial container
    bucket.innerHTML = `
      <div class="bucket-header">
        <div class="bucket-title" style="color:${t.color}">${escapeHtml(t.name)}</div>
        <div class="bucket-total">${totals[t.id] ? fmtMins(totals[t.id]) : ''}</div>
      </div>
      <div class="dial" id="dial-${t.id}" title="Glisse pour ajuster"></div>
      
    `;

    // Append before sizing to get width
    container.appendChild(bucket);

    // NexusUI Dial
    const dialHost = document.getElementById(`dial-${t.id}`);
    const size = Math.max(60, Math.floor(bucket.clientWidth));
    let dial = null;
    if (window.Nexus && window.Nexus.Dial){
      dial = new window.Nexus.Dial(`#dial-${t.id}`, {
        size: [size, size],
        interaction: 'radial',
        min: 0,
        max: RING_MAX_MINUTES,
        step: smallestUnit(),
        value: Math.min(totals[t.id]||0, RING_MAX_MINUTES)
      });
      try{ dial.colorize && dial.colorize('accent', t.color); }catch{}
      try{ dial.colorize && dial.colorize('fill', '#ffffff'); }catch{}
      dial.on('change', (v)=>{
        const minsTarget = Math.round(v/ smallestUnit())*smallestUnit();
        setThemeTotal(state.date, t.id, minsTarget);
        const e2 = getEntry(state.date);
        const totals2 = totalsByTheme(e2);
        $('.bucket-total', bucket).textContent = totals2[t.id] ? fmtMins(totals2[t.id]) : '';
        // Update view without recomputing the week strip for smoother drag
        renderToday(true);
      });
      // Refresh the week strip once the user ends interaction
      ['mouseup','touchend','pointerup'].forEach(evt=>{
        dialHost.addEventListener(evt, ()=>{ renderWeekStrip(); }, { passive:true });
      });
    } else {
      dialHost.textContent = 'NexusUI non chargé';
      dialHost.style.color = 'var(--muted)';
      dialHost.style.textAlign = 'center';
      dialHost.style.padding = '1rem 0';
    }

    // Drag & drop supprimé; le Dial contrôle le total
  }

  // emotion
  const picker = $('#emotion-picker');
  $$('.emotion', picker).forEach(btn=>{
    btn.classList.toggle('selected', btn.dataset.emotion === (entry.emotion||''));
    btn.onclick = () => {
      const e = getEntry(state.date);
      e.emotion = (e.emotion===btn.dataset.emotion) ? '' : btn.dataset.emotion;
      setEntry(state.date, e);
      renderToday();
    };
  });
  // note
  const noteEl = $('#note');
  noteEl.value = entry.note || '';
  noteEl.onchange = () => { const e = getEntry(state.date); e.note = noteEl.value; setEntry(state.date, e); };
  // no pebble tray / drag
}

// ---------- Stats View ----------
function dateFromISO(s){ const [y,m,d] = s.split('-').map(Number); return new Date(y, m-1, d); }
function startOfMonth(d){ return new Date(d.getFullYear(), d.getMonth(), 1); }
function addDays(d, n){ const x = new Date(d); x.setDate(x.getDate()+n); return x; }

function rangeDates(selectValue){
  const entries = loadEntries();
  const dates = Object.keys(entries).sort();
  if (dates.length===0) return [];
  const today = new Date();
  if (selectValue==='all') return dates;
  if (selectValue==='this-month'){
    const start = startOfMonth(today).toISOString().slice(0,10);
    return dates.filter(d=>d>=start);
  }
  const n = Number(selectValue)||30;
  const start = addDays(today, -n+1).toISOString().slice(0,10);
  return dates.filter(d=>d>=start);
}

function renderStats(){
  const sel = $('#range');
  const dates = rangeDates(sel.value);
  const entries = loadEntries();
  const totals = new Map(); // themeId -> minutes
  for (const d of dates){
    for (const p of (entries[d]?.pebbles||[])){
      totals.set(p.themeId, (totals.get(p.themeId)||0) + p.minutes);
    }
  }
  const themeIndex = new Map(state.themes.map(t=>[t.id, t]));
  const data = Array.from(totals.entries()).map(([id, minutes])=>({
    id, minutes, theme: themeIndex.get(id)
  })).filter(x=>x.theme);
  data.sort((a,b)=>b.minutes-a.minutes);

  drawPie($('#pie'), data);
  renderLegend($('#stats-legend'), data);

  sel.onchange = renderStats;
}

function drawPie(canvas, data){
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0,0,canvas.width, canvas.height);
  const total = data.reduce((a,b)=>a+b.minutes, 0) || 1;
  const cx = canvas.width/2, cy = canvas.height/2, r = Math.min(cx,cy)-10;
  let a0 = -Math.PI/2; // start top
  for (const d of data){
    const a1 = a0 + 2*Math.PI*(d.minutes/total);
    ctx.beginPath();
    ctx.moveTo(cx,cy);
    ctx.arc(cx,cy, r, a0, a1);
    ctx.closePath();
    ctx.fillStyle = d.theme.color;
    ctx.fill();
    a0 = a1;
  }
  // inner cut for donut
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath(); ctx.arc(cx,cy, r*0.55, 0, Math.PI*2); ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  // soft ring
  ctx.beginPath(); ctx.arc(cx,cy, r*0.58, 0, Math.PI*2);
  ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(0,0,0,0.08)'; ctx.stroke();
}

function renderLegend(el, data){
  el.innerHTML = '';
  const total = data.reduce((a,b)=>a+b.minutes, 0);
  for (const d of data){
    const row = document.createElement('div'); row.className = 'legend-item';
    row.innerHTML = `
      <span class="swatch" style="background:${d.theme.color}"></span>
      <span class="name">${d.theme.name}</span>
      <span class="time">${fmtMins(d.minutes)} ${total?`· ${Math.round(100*d.minutes/total)}%`:''}</span>
    `;
    el.appendChild(row);
  }
  if (!data.length){ el.innerHTML = '<div style="color:var(--muted)">Aucune donnée sur la période.</div>'; }
}

// ---------- Settings View ----------
function renderSettings(){
  const ul = $('#themes-list');
  ul.innerHTML = '';
  for (let i=0; i<state.themes.length; i++){
    const t = state.themes[i];
    const li = document.createElement('li');
    li.className = 'theme-item';
    li.innerHTML = `
      <span class="swatch" style="background:${t.color}"></span>
      <div class="move">
        <button class="up" title="Monter">▲</button>
        <button class="down" title="Descendre">▼</button>
      </div>
      <input class="name" type="text" value="${escapeHtml(t.name)}" aria-label="Nom" />
      <input class="color" type="color" value="${t.color}" aria-label="Couleur" />
      <button class="del" title="Supprimer">Supprimer</button>
    `;
    const sw = li.querySelector('.swatch');
    const nameInput = li.querySelector('.name');
    const colorInput = li.querySelector('.color');
    const delBtn = li.querySelector('.del');
    const upBtn = li.querySelector('.up');
    const downBtn = li.querySelector('.down');
    nameInput.addEventListener('change', ()=>{ t.name = nameInput.value; saveThemes(state.themes); renderToday(); renderStats(); });
    colorInput.addEventListener('input', ()=>{ t.color = colorInput.value; sw.style.background = t.color; saveThemes(state.themes); renderToday(); renderStats(); });
    delBtn.addEventListener('click', ()=>{
      if (!confirm(`Supprimer le thème "${t.name}" ?`)) return;
      // Remove theme and its pebbles from all entries
      state.themes = state.themes.filter(x=>x.id!==t.id); saveThemes(state.themes);
      const entries = loadEntries();
      for (const k of Object.keys(entries)){
        entries[k].pebbles = (entries[k].pebbles||[]).filter(p=>p.themeId!==t.id);
      }
      saveEntries(entries);
      renderSettings(); renderToday(); renderStats();
    });
    upBtn.addEventListener('click', ()=> moveTheme(i, -1));
    downBtn.addEventListener('click', ()=> moveTheme(i, +1));
    ul.appendChild(li);
  }

  // appearance
  const trayInput = null; // pebble color controls removed
  const chipInput = null;
  const thickInput = $('#ring-thickness');
  const thickVal = $('#ring-thickness-val');
  const handleInput = document.getElementById('handle-diameter');
  const handleVal = document.getElementById('handle-diameter-val');
  // no pebble color inputs
  if (thickInput){
    thickInput.value = String(state.ringThickness);
    if (thickVal) thickVal.textContent = `${state.ringThickness}px`;
    thickInput.oninput = (e)=>{ state.ringThickness = Number(e.target.value)||16; if (thickVal) thickVal.textContent = `${state.ringThickness}px`; renderToday(); };
    thickInput.onchange = ()=>{ saveRingThickness(state.ringThickness); renderToday(); };
  }

  if (handleInput){
    handleInput.value = String(state.handleDiameter);
    if (handleVal) handleVal.textContent = `${state.handleDiameter}px`;
    handleInput.oninput = (e)=>{ state.handleDiameter = Number(e.target.value)||16; if (handleVal) handleVal.textContent = `${state.handleDiameter}px`; renderToday(); };
    handleInput.onchange = ()=>{ saveHandleDiameter(state.handleDiameter); renderToday(); };
  }

  // no sizes controls
}

function moveTheme(index, delta){
  const j = index + delta;
  if (j < 0 || j >= state.themes.length) return;
  const arr = state.themes;
  const tmp = arr[index];
  arr[index] = arr[j];
  arr[j] = tmp;
  saveThemes(arr);
  renderSettings();
  renderToday();
  renderStats();
}

$('#add-theme')?.addEventListener('click', ()=>{
  const t = { id: uid(), name: 'Nouveau thème', icon:'', color: randomSoftColor(), category:'' };
  state.themes.push(t); saveThemes(state.themes); renderSettings(); renderToday();
});

// Export / Import / Save-to-file
$('#export-json')?.addEventListener('click', ()=>{
  const blob = new Blob([JSON.stringify(exportData(), null, 2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  const iso = new Date().toISOString().slice(0,10);
  const [y,m,d] = iso.split('-');
  a.download = `temps-vecu-${d}-${m}-${y}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
});
$('#import-json')?.addEventListener('click', ()=> $('#import-file').click());
$('#import-file')?.addEventListener('change', async (e)=>{
  const file = e.target.files?.[0]; if (!file) return;
  const text = await file.text();
  try{
    const data = JSON.parse(text);
    importData(data);
    alert('Données importées.');
    renderSettings(); renderToday(); renderStats();
  }catch(err){ alert('Import invalide.'); }
  e.target.value = '';
});
$('#save-to-file')?.addEventListener('click', async ()=>{
  if (!window.showSaveFilePicker){ alert('Non supporté par ce navigateur. Utilise Exporter JSON.'); return; }
  try {
    const handle = await window.showSaveFilePicker({suggestedName:`temps-vecu.json`, types:[{description:'JSON', accept:{'application/json':['.json']}}]});
    const writable = await handle.createWritable();
    await writable.write(new Blob([JSON.stringify(exportData(), null, 2)], {type:'application/json'}));
    await writable.close();
  } catch(e){ /* cancelled */ }
});

// ---------- Helpers ----------
function randomSoftColor(){
  const h = Math.floor(Math.random()*360);
  return `hsl(${h} 35% 68%)`;
}
function mixColor(a, b, t){
  // very rough hex mix
  const pa = hexToRgb(a)||{r:200,g:200,b:200};
  const pb = hexToRgb(b)||{r:240,g:240,b:240};
  const r = Math.round(pa.r*(1-t)+pb.r*t);
  const g = Math.round(pa.g*(1-t)+pb.g*t);
  const bl = Math.round(pa.b*(1-t)+pb.b*t);
  return `rgb(${r},${g},${bl})`;
}
function hexToRgb(hex){
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if(!m) return null; return {r:parseInt(m[1],16), g:parseInt(m[2],16), b:parseInt(m[3],16)};
}
function escapeHtml(s){ return s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;'); }

// Contrast helpers
function relLuma(hex){
  const c = hexToRgb(hex) || {r:255,g:255,b:255};
  const lin = (v)=>{ v/=255; return v<=0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4); };
  const R = lin(c.r), G = lin(c.g), B = lin(c.b);
  return 0.2126*R + 0.7152*G + 0.0722*B;
}
function contrastRatio(L1, L2){ const [a,b] = L1>L2 ? [L1,L2] : [L2,L1]; return (a+0.05)/(b+0.05); }
function bestTextColor(bg){
  const L = relLuma(bg);
  const black = contrastRatio(L, 0);
  const white = contrastRatio(L, 1);
  return white>black ? '#ffffff' : '#000000';
}

function renderTray(){
  const tray = $('#tray-items');
  tray.innerHTML = '';
  const sizes = state.sizes.slice().sort((a,b)=>a-b);
  for (const mins of sizes){
    const d = document.createElement('div');
    d.className = 'pebble source';
    d.draggable = true;
    d.dataset.mins = String(mins);
    d.textContent = mins%60===0 ? `${mins/60}h` : `${mins}m`;
    // flat color handled by CSS variables (tray)
    tray.appendChild(d);
  }
}

function renderWeekStrip(){
  const strip = $('#week-strip');
  strip.innerHTML = '';
  const selected = dateFromISO(state.date);
  const entries = loadEntries();
  // Limiter à J-2 .. J+2 autour du jour sélectionné
  for (let i=-2;i<=2;i++){
    const d = addDays(selected, i);
    const iso = d.toISOString().slice(0,10);
    const e = entries[iso] || {pebbles:[]};
    const totals = totalsByTheme(e);
    const total = Object.values(totals).reduce((a,b)=>a+b, 0);
    const day = document.createElement('div'); day.className = 'week-day';
    if (iso===state.date) day.classList.add('active');
    const stack = document.createElement('div'); stack.className = 'stack';
    let acc = 0;
    for (const t of state.themes){
      const v = totals[t.id]||0; if (!v) continue;
      const seg = document.createElement('div');
      seg.style.background = t.color; seg.style.width = total? `${100*v/total}%` : '0%';
      stack.appendChild(seg);
      acc += v;
    }
    const meta = document.createElement('div'); meta.className = 'meta';
    meta.innerHTML = `<span>${fmtDateEU(iso)}</span>`;
    day.appendChild(stack); day.appendChild(meta);
    day.addEventListener('click', ()=>{ state.date = iso; $('#date').value = iso; renderToday(); });
    strip.appendChild(day);
  }
}

const RING_STEP_MINUTES = 15;
const RING_MAX_MINUTES = 480; // 8h max par Dial
function smallestUnit(){ return RING_STEP_MINUTES; }
function decomposeMinutes(mins){
  const step = RING_STEP_MINUTES;
  const out = [];
  let rest = Math.max(0, Math.round(mins));
  while (rest >= step){ out.push(step); rest -= step; }
  if (rest>0) out.push(step); // round up to nearest step
  return out;
}
function setThemeTotal(date, themeId, minutes){
  const e = getEntry(date);
  // Replace all pebbles of this theme with a new decomposition
  e.pebbles = e.pebbles.filter(p=>p.themeId!==themeId);
  const pieces = decomposeMinutes(minutes);
  for (const m of pieces){ e.pebbles.push({ id: uid(), themeId, minutes: m }); }
  setEntry(date, e);
}

function drawRing(canvas, minutes, themeColor){
  const ctx = canvas.getContext('2d'); const w = canvas.width, h = canvas.height;
  const thickness = state.ringThickness || 16;
  const knobD = state.handleDiameter || 16;
  const tickOuter = 8; // max tick reach outside the ring
  const cx = w/2, cy = h/2;
  const pad = Math.max(thickness/2 + tickOuter + 2, knobD/2 + 4);
  const r = Math.max(0, Math.min(cx, cy) - pad);
  const textColor = bestTextColor(themeColor);
  const hasTime = minutes > 0;
  const track = mixColor(themeColor, '#ffffff', hasTime ? 0.78 : 0.88);
  const stroke = hasTime ? themeColor : mixColor(themeColor, '#ffffff', 0.65);

  ctx.clearRect(0,0,w,h);
  ctx.lineCap='round'; ctx.lineJoin='round';

  // graduations (15 min minor, 60 min major)
  const totalTicks = Math.round((RING_MAX_MINUTES/60) * 4); // heures * 4
  for (let i=0;i<totalTicks;i++){
    const a = -Math.PI/2 + (i/totalTicks)*2*Math.PI;
    const isMajor = (i%4)===0;
    const len = isMajor ? 6 : 3.5;
    const lw = isMajor ? 2 : 1;
    const ax = Math.cos(a), ay = Math.sin(a);
    ctx.beginPath();
    ctx.moveTo(cx + ax*(r + thickness/2 + 2), cy + ay*(r + thickness/2 + 2));
    ctx.lineTo(cx + ax*(r + thickness/2 + 2 + len), cy + ay*(r + thickness/2 + 2 + len));
    ctx.strokeStyle = isMajor ? 'rgba(0,0,0,0.15)' : 'rgba(0,0,0,0.08)';
    ctx.lineWidth = lw;
    ctx.stroke();
  }

  // base track
  ctx.beginPath(); ctx.arc(cx,cy,r,-Math.PI/2,Math.PI*1.5);
  ctx.strokeStyle=track; ctx.lineWidth=thickness; ctx.stroke();

  // progress (avoid exact 2π to prevent cap artifact)
  const frac = Math.min(1, Math.max(0, minutes/ RING_MAX_MINUTES));
  const endA = -Math.PI/2 + frac*2*Math.PI - 0.0001;
  if (frac>0){
    ctx.beginPath(); ctx.arc(cx,cy,r,-Math.PI/2, endA);
    ctx.strokeStyle=stroke; ctx.lineWidth=thickness; ctx.stroke();
  }

  // inner shadow on inner edge of ring
  const inner = r - thickness/2;
  const shadowW = Math.min(10, thickness*0.6);
  const grad = ctx.createRadialGradient(cx,cy, inner - shadowW/2, cx,cy, inner + shadowW/2);
  grad.addColorStop(0, 'rgba(0,0,0,0.14)');
  grad.addColorStop(1, 'rgba(0,0,0,0.0)');
  ctx.beginPath(); ctx.arc(cx,cy, inner, 0, Math.PI*2);
  ctx.strokeStyle = grad; ctx.lineWidth = shadowW; ctx.stroke();

  // knob / handle
  const knobR = knobD/2;
  const ka = frac>0 ? endA : -Math.PI/2; // top if 0
  const kx = cx + Math.cos(ka)*r;
  const ky = cy + Math.sin(ka)*r;
  ctx.save();
  ctx.beginPath(); ctx.arc(kx, ky, knobR, 0, Math.PI*2);
  ctx.fillStyle = stroke;
  ctx.shadowColor = 'rgba(0,0,0,0.25)';
  ctx.shadowBlur = 8;
  ctx.fill();
  ctx.restore();
  // inner highlight for knob
  ctx.beginPath(); ctx.arc(kx, ky, Math.max(1, knobR-2), 0, Math.PI*2);
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.fill();

  // text (only when > 0)
  ctx.fillStyle=textColor; ctx.font='600 13px system-ui'; ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText(minutes?fmtMins(minutes):'', cx, cy);
}
function initRing(canvas, currentMinutes, onChange){
  let dragging=false;
  const update = (ev)=>{
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const cx = (ev.touches?ev.touches[0].clientX:ev.clientX) - rect.left;
    const cy = (ev.touches?ev.touches[0].clientY:ev.clientY) - rect.top;
    const x = cx*scaleX - canvas.width/2;
    const y = cy*scaleY - canvas.height/2;
    const ang = Math.atan2(y,x); // -PI..PI where 0 is right
    let a = ang - (-Math.PI/2); // relative to top
    if (a<0) a += 2*Math.PI;
    const frac = a/(2*Math.PI);
    const mins = Math.round(frac*RING_MAX_MINUTES/ smallestUnit())*smallestUnit();
    onChange(mins);
  };
  const start = (ev)=>{ dragging=true; update(ev); ev.preventDefault(); };
  const move = (ev)=>{ if (!dragging) return; update(ev); ev.preventDefault(); };
  const end = ()=>{ dragging=false; };
  canvas.addEventListener('mousedown', start);
  window.addEventListener('mousemove', move);
  window.addEventListener('mouseup', end);
  canvas.addEventListener('touchstart', start, {passive:false});
  window.addEventListener('touchmove', move, {passive:false});
  window.addEventListener('touchend', end);
}

function exportData(){
  return { version:2, user: state.user, themes: state.themes, entries: loadEntries(), sizes: state.sizes, pebbleColorTray: state.pebbleTray, pebbleColorChip: state.pebbleChip, ringThickness: state.ringThickness, handleDiameter: state.handleDiameter };
}
function importData(data){
  if (!data || typeof data!=='object') throw new Error('bad');
  if (Array.isArray(data.themes)) saveThemes(data.themes);
  if (data.entries && typeof data.entries==='object') saveEntries(data.entries);
  if (Array.isArray(data.sizes) && data.sizes.length) saveSizes(data.sizes);
  if (typeof data.pebbleColorTray === 'string') { state.pebbleTray = data.pebbleColorTray; savePebbleColorTray(state.pebbleTray); }
  if (typeof data.pebbleColorChip === 'string') { state.pebbleChip = data.pebbleColorChip; savePebbleColorChip(state.pebbleChip); }
  if (!data.pebbleColorTray && !data.pebbleColorChip && typeof data.pebbleColor==='string'){
    state.pebbleTray = data.pebbleColor; state.pebbleChip = data.pebbleColor; savePebbleColorTray(state.pebbleTray); savePebbleColorChip(state.pebbleChip);
  }
  if (Number.isFinite(data.ringThickness)) { state.ringThickness = data.ringThickness; saveRingThickness(state.ringThickness); }
  if (Number.isFinite(data.handleDiameter)) { state.handleDiameter = data.handleDiameter; saveHandleDiameter(state.handleDiameter); }
  state.themes = loadThemes();
  state.sizes = loadSizes();
  applyPebbleColors();
}

// ---------- Boot ----------
function boot(){
  initTabs();
  initUserSelector();
  // Load per-user data, prefer server if available
  (async () => {
    await tryLoadFromServer(state.user);
    if (!state.themes.length) state.themes = loadThemes();
    if (!state.sizes.length) state.sizes = loadSizes();
    state.pebbleTray = loadPebbleColorTray();
    state.pebbleChip = loadPebbleColorChip();
    state.ringThickness = loadRingThickness();
    state.handleDiameter = loadHandleDiameter();
    applyPebbleColors();
    setHeaderHeightVar();
    initDate();
    renderToday();
    window.addEventListener('resize', ()=>{ if (state.tab==='today') renderToday(); }, { passive:true });
  })();
}
document.addEventListener('DOMContentLoaded', boot);

// ---------- User selector & server sync ----------
function initUserSelector(){
  const sel = $('#user');
  if (!sel) return;
  sel.value = state.user;
  sel.onchange = async ()=>{
    state.user = sel.value;
    localStorage.setItem(KEYS.user, state.user);
    state.themes = [];
    state.sizes = [];
    state.pebbleTray = '#edeae4';
    state.pebbleChip = '#edeae4';
    state.ringThickness = 16;
    state.handleDiameter = 16;
    await tryLoadFromServer(state.user);
    if (!state.themes.length) state.themes = loadThemes();
    if (!state.sizes.length) state.sizes = loadSizes();
    state.pebbleTray = loadPebbleColorTray();
    state.pebbleChip = loadPebbleColorChip();
    state.ringThickness = loadRingThickness();
    state.handleDiameter = loadHandleDiameter();
    applyPebbleColors();
    renderSettings(); renderToday(); renderStats();
  };
}

let serverDetected = null;
async function serverAvailable(){
  if (serverDetected!==null) return serverDetected;
  try{ const r = await fetch('/api/ping'); serverDetected = r.ok; }catch{ serverDetected=false; }
  return serverDetected;
}
async function tryLoadFromServer(user){
  if (!(await serverAvailable())) return false;
  try{
    const r = await fetch(`/api/load?user=${encodeURIComponent(user)}`);
    if (!r.ok) return false;
    const data = await r.json();
    if (data && typeof data==='object'){
      if (Array.isArray(data.themes)) { state.themes = data.themes; saveThemes(state.themes, user); }
      if (Array.isArray(data.sizes)) { state.sizes = data.sizes; saveSizes(state.sizes, user); }
      if (data.entries && typeof data.entries==='object') { saveEntries(data.entries, user); }
      if (typeof data.pebbleColorTray==='string') { state.pebbleTray = data.pebbleColorTray; savePebbleColorTray(state.pebbleTray, user); }
      if (typeof data.pebbleColorChip==='string') { state.pebbleChip = data.pebbleColorChip; savePebbleColorChip(state.pebbleChip, user); }
      else if (typeof data.pebbleColor==='string') { state.pebbleTray = data.pebbleColor; state.pebbleChip = data.pebbleColor; savePebbleColorTray(state.pebbleTray, user); savePebbleColorChip(state.pebbleChip, user); }
      if (Number.isFinite(data.ringThickness)) { state.ringThickness = data.ringThickness; saveRingThickness(state.ringThickness, user); }
      if (Number.isFinite(data.handleDiameter)) { state.handleDiameter = data.handleDiameter; saveHandleDiameter(state.handleDiameter, user); }
      return true;
    }
  }catch{}
  return false;
}

let syncTimer = null;
function scheduleSync(){
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(syncToServer, 400);
}
async function syncToServer(){
  if (!(await serverAvailable())) return;
  const payload = exportData();
  try{
    await fetch('/api/save', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)});
  }catch{}
}

function applyPebbleColors(){
  const root = document.documentElement;
  const trayFg = bestTextColor(state.pebbleTray);
  const chipFg = bestTextColor(state.pebbleChip);
  root.style.setProperty('--pebble-tray-bg', state.pebbleTray);
  root.style.setProperty('--pebble-tray-fg', trayFg);
  root.style.setProperty('--pebble-chip-bg', state.pebbleChip);
  root.style.setProperty('--pebble-chip-fg', chipFg);
  const prevTray = document.getElementById('preview-tray'); if (prevTray){ prevTray.style.background = state.pebbleTray; prevTray.style.color = trayFg; }
  const prevChip = document.getElementById('preview-chip'); if (prevChip){ prevChip.style.background = state.pebbleChip; prevChip.style.color = chipFg; }
}

function setHeaderHeightVar(){
  const h = document.querySelector('.app-header')?.offsetHeight || 88;
  document.documentElement.style.setProperty('--header-h', h + 'px');
  window.addEventListener('resize', ()=>{
    const hh = document.querySelector('.app-header')?.offsetHeight || 88;
    document.documentElement.style.setProperty('--header-h', hh + 'px');
  });
}
