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
  ringThickness: (u)=>`time/${u}/ringThickness`
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
  ringThickness: 16
};

// ---------- Tabs ----------
function initTabs(){
  $$('.tab').forEach(btn => btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;
    state.tab = tab;
    $$('.tab').forEach(b=>{
      b.classList.toggle('active', b===btn);
      b.setAttribute('aria-selected', b===btn);
    });
    $$('.view').forEach(v=>v.classList.remove('active'));
    $('#view-'+tab).classList.add('active');
    if (tab==='stats') renderStats();
    if (tab==='settings') renderSettings();
  }));
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

function renderToday(){
  // buckets
  const container = $('#buckets');
  container.innerHTML = '';
  const entry = getEntry(state.date);
  const totals = totalsByTheme(entry);
  // total of day
  const dayTotal = entry.pebbles.reduce((a,b)=>a+b.minutes, 0);
  const remain = 1440 - dayTotal;
  const dt = $('#day-total');
  dt.classList.remove('over','remain');
  if (remain === 0) { dt.textContent = `${fmtMins(dayTotal)} / 24h`; }
  else if (remain > 0) { dt.textContent = `${fmtMins(dayTotal)} · Reste ${fmtMins(remain)}`; dt.classList.add('remain'); }
  else { dt.textContent = `${fmtMins(dayTotal)} · Dépassé de ${fmtMins(-remain)}`; dt.classList.add('over'); }

  renderWeekStrip();

  renderTray();

  for (const t of state.themes){
    const bucket = document.createElement('div');
    bucket.className = 'bucket';
    bucket.dataset.themeId = t.id;
    const textColor = bestTextColor(t.color);
    bucket.style.background = t.color;
    bucket.style.color = textColor;
    bucket.style.borderColor = mixColor(t.color, '#000000', 0.15);
    bucket.innerHTML = `
      <div class="bucket-header">
        <span class="swatch" style="background:${t.color}; border-color:${mixColor(t.color, '#000000', 0.2)}"></span>
        <div class="bucket-title">${t.icon} ${t.name}</div>
        <div class="bucket-total">${totals[t.id] ? fmtMins(totals[t.id]) : ''}</div>
      </div>
      <canvas class="ring" width="120" height="120" title="Glisse pour ajuster"></canvas>
      <div class="bucket-body" aria-label="Zone de dépôt"></div>
      
    `;

    // Render pebbles inside bucket
    const body = $('.bucket-body', bucket);
    const pebbles = entry.pebbles.filter(p=>p.themeId===t.id);
    for (const p of pebbles){
      const chip = document.createElement('div');
      chip.className = 'pebble small';
      // flat chip uses chip appearance color / CSS vars
      chip.style.background = getComputedStyle(document.documentElement).getPropertyValue('--pebble-chip-bg').trim() || state.pebbleChip;
      const fg = getComputedStyle(document.documentElement).getPropertyValue('--pebble-chip-fg').trim() || bestTextColor(state.pebbleChip);
      chip.style.color = fg;
      // subtle border for contrast vs theme background
      const L = relLuma(t.color);
      chip.style.borderColor = L>0.5 ? mixColor(t.color, '#000000', 0.35) : mixColor(t.color, '#FFFFFF', 0.35);
      chip.textContent = p.minutes===60 ? '1h' : `${p.minutes}m`;
      chip.title = 'Cliquer pour retirer';
      chip.addEventListener('click', ()=>{
        // remove this pebble
        const e = getEntry(state.date);
        e.pebbles = e.pebbles.filter(x=>x.id!==p.id);
        setEntry(state.date, e);
        renderToday();
      });
      body.appendChild(chip);
    }

    // Ring slider
    const ring = $('.ring', bucket);
    drawRing(ring, totals[t.id]||0, t.color);
    initRing(ring, totals[t.id]||0, (minsTarget)=>{
      setThemeTotal(state.date, t.id, minsTarget);
      const e2 = getEntry(state.date);
      const totals2 = totalsByTheme(e2);
      $('.bucket-total', bucket).textContent = totals2[t.id] ? fmtMins(totals2[t.id]) : '';
      drawRing(ring, totals2[t.id]||0, t.color);
      renderToday();
    });

    // Drag & drop events
    bucket.addEventListener('dragover', (ev)=>{ ev.preventDefault(); bucket.classList.add('drag-over'); });
    bucket.addEventListener('dragleave', ()=> bucket.classList.remove('drag-over'));
    bucket.addEventListener('drop', (ev)=>{
      ev.preventDefault(); bucket.classList.remove('drag-over');
      const mins = Number(ev.dataTransfer.getData('text/pebble-mins')) || 0;
      if (!mins) return;
      const e = getEntry(state.date);
      e.pebbles.push({ id: uid(), themeId: t.id, minutes: mins });
      setEntry(state.date, e);
      renderToday();
    });

    container.appendChild(bucket);
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

  // prepare draggable tray
  $$('.pebble.source').forEach(src => {
    src.addEventListener('dragstart', (ev)=>{
      ev.dataTransfer.setData('text/pebble-mins', src.dataset.mins);
      ev.dataTransfer.effectAllowed = 'copy';
    });
  });
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
      <span class="name">${d.theme.icon} ${d.theme.name}</span>
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
      <input class="icon" type="text" value="${t.icon}" size="2" aria-label="Icône" />
      <input class="name" type="text" value="${escapeHtml(t.name)}" aria-label="Nom" />
      <input class="color" type="color" value="${t.color}" aria-label="Couleur" />
      <button class="del" title="Supprimer">Supprimer</button>
    `;
    const sw = li.querySelector('.swatch');
    const iconInput = li.querySelector('.icon');
    const nameInput = li.querySelector('.name');
    const colorInput = li.querySelector('.color');
    const delBtn = li.querySelector('.del');
    const upBtn = li.querySelector('.up');
    const downBtn = li.querySelector('.down');
    iconInput.addEventListener('change', ()=>{ t.icon = iconInput.value; saveThemes(state.themes); renderToday(); renderStats(); });
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
  const trayInput = $('#pebble-color-tray');
  const chipInput = $('#pebble-color-chip');
  const thickInput = $('#ring-thickness');
  const thickVal = $('#ring-thickness-val');
  if (trayInput){
    trayInput.value = state.pebbleTray;
    applyPebbleColors();
    trayInput.oninput = (e)=>{ state.pebbleTray = e.target.value; applyPebbleColors(); };
    trayInput.onchange = ()=>{ savePebbleColorTray(state.pebbleTray); renderToday(); renderStats(); };
  }
  if (chipInput){
    chipInput.value = state.pebbleChip;
    applyPebbleColors();
    chipInput.oninput = (e)=>{ state.pebbleChip = e.target.value; applyPebbleColors(); };
    chipInput.onchange = ()=>{ savePebbleColorChip(state.pebbleChip); renderToday(); renderStats(); };
  }
  if (thickInput){
    thickInput.value = String(state.ringThickness);
    if (thickVal) thickVal.textContent = `${state.ringThickness}px`;
    thickInput.oninput = (e)=>{ state.ringThickness = Number(e.target.value)||16; if (thickVal) thickVal.textContent = `${state.ringThickness}px`; renderToday(); };
    thickInput.onchange = ()=>{ saveRingThickness(state.ringThickness); renderToday(); };
  }

  // sizes list
  const sizesList = $('#sizes-list');
  sizesList.innerHTML = '';
  for (const val of state.sizes.slice().sort((a,b)=>a-b)){
    const li = document.createElement('li');
    li.className = 'size-item';
    li.innerHTML = `
      <input type="number" min="5" step="5" value="${val}" aria-label="minutes" />
      <button class="del">Supprimer</button>
    `;
    const num = $('input', li); const del = $('.del', li);
    num.addEventListener('change', ()=>{
      const v = Math.max(5, Math.round(Number(num.value)||val));
      // replace value
      state.sizes = state.sizes.map(s=> s===val ? v : s);
      state.sizes = Array.from(new Set(state.sizes));
      saveSizes(state.sizes); renderSettings(); renderToday(); renderStats();
    });
    del.addEventListener('click', ()=>{
      state.sizes = state.sizes.filter(s=>s!==val); if (state.sizes.length===0) state.sizes=[30];
      saveSizes(state.sizes); renderSettings(); renderToday(); renderStats();
    });
    sizesList.appendChild(li);
  }
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
  const t = { id: uid(), name: 'Nouveau thème', icon:'✨', color: randomSoftColor(), category:'' };
  state.themes.push(t); saveThemes(state.themes); renderSettings(); renderToday();
});

$('#add-size')?.addEventListener('click', ()=>{
  const def = 15;
  state.sizes.push(def); state.sizes = Array.from(new Set(state.sizes));
  saveSizes(state.sizes); renderSettings(); renderToday();
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
  const weekday = (selected.getDay()+6)%7; // 0=Mon
  const start = addDays(selected, -weekday);
  const entries = loadEntries();
  for (let i=0;i<7;i++){
    const d = addDays(start, i);
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
    meta.innerHTML = `<span>${fmtDateEU(iso)}</span><span>${total?fmtMins(total):''}</span>`;
    day.appendChild(stack); day.appendChild(meta);
    day.addEventListener('click', ()=>{ state.date = iso; $('#date').value = iso; renderToday(); });
    strip.appendChild(day);
  }
}

function smallestUnit(){ return Math.min(...state.sizes); }
function decomposeMinutes(mins){
  const sizes = state.sizes.slice().sort((a,b)=>b-a);
  const out = [];
  let rest = Math.max(0, Math.round(mins));
  for (const s of sizes){
    while (rest >= s){ out.push(s); rest -= s; }
  }
  if (rest>0){ // round up to nearest size
    out.push(sizes[sizes.length-1]);
  }
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
  // Ensure the arc + shadow never gets clipped by the canvas edge
  const cx = w/2, cy = h/2;
  const pad = (thickness/2) + 6; // half stroke + shadow blur
  const r = Math.max(0, Math.min(cx, cy) - pad);
  const textColor = bestTextColor(themeColor);
  const stroke = mixColor(themeColor, '#000000', 0.35); // darker than pad bg
  const track = mixColor(themeColor, '#ffffff', 0.70); // lighter subtle track
  ctx.clearRect(0,0,w,h);
  ctx.lineCap='round'; ctx.lineJoin='round';
  // subtle shadow for depth
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.08)';
  ctx.shadowBlur = 6; ctx.shadowOffsetY = 1;
  ctx.beginPath(); ctx.arc(cx,cy,r,-Math.PI/2,Math.PI*1.5);
  ctx.strokeStyle=track; ctx.lineWidth=thickness; ctx.stroke();
  ctx.restore();
  // progress (avoid exact 2π to prevent cap artifact)
  const frac = Math.min(1, Math.max(0, minutes/1440));
  const endA = -Math.PI/2 + frac*2*Math.PI - 0.0001;
  ctx.beginPath(); ctx.arc(cx,cy,r,-Math.PI/2, endA);
  ctx.strokeStyle=stroke; ctx.lineWidth=thickness; ctx.stroke();
  // center dot
  ctx.beginPath();
  ctx.arc(cx, cy, 2.5, 0, Math.PI*2);
  ctx.fillStyle = (textColor==='#000000') ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.22)';
  ctx.fill();
  // text
  ctx.fillStyle=textColor; ctx.font='600 13px system-ui'; ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText(minutes?fmtMins(minutes):'', cx, cy);
}
function initRing(canvas, currentMinutes, onChange){
  let dragging=false;
  const update = (ev)=>{
    const rect = canvas.getBoundingClientRect();
    const x = (ev.touches?ev.touches[0].clientX:ev.clientX) - rect.left - canvas.width/2;
    const y = (ev.touches?ev.touches[0].clientY:ev.clientY) - rect.top - canvas.height/2;
    const ang = Math.atan2(y,x); // -PI..PI where 0 is right
    let a = ang - (-Math.PI/2); // relative to top
    if (a<0) a += 2*Math.PI;
    const frac = a/(2*Math.PI);
    const mins = Math.round(frac*1440/ smallestUnit())*smallestUnit();
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
  return { version:2, user: state.user, themes: state.themes, entries: loadEntries(), sizes: state.sizes, pebbleColorTray: state.pebbleTray, pebbleColorChip: state.pebbleChip, ringThickness: state.ringThickness };
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
    applyPebbleColors();
    setHeaderHeightVar();
    initDate();
    renderToday();
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
    await tryLoadFromServer(state.user);
    if (!state.themes.length) state.themes = loadThemes();
    if (!state.sizes.length) state.sizes = loadSizes();
    state.pebbleTray = loadPebbleColorTray();
    state.pebbleChip = loadPebbleColorChip();
    state.ringThickness = loadRingThickness();
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
