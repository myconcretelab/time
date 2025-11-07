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
// For bucket display: show 0h instead of empty/0m
const fmtBucketMins = (mins) => (mins===0 ? '0h' : fmtMins(mins||0));
const todayStr = () => new Date().toISOString().slice(0,10);
const fmtDateEU = (iso) => { const [y,m,d]=iso.split('-'); return `${d}/${m}`; };
const uid = () => Math.random().toString(36).slice(2,9);

// ---------- Storage (JSON/server only, no localStorage) ----------
function defaultThemes(){
  return [
    {id: uid(), name:'Travail manuel', icon:'🧰', color:'#c98b6b', category:'pro'},
    {id: uid(), name:'Enfants', icon:'🧒', color:'#f2a65a', category:'famille'},
    {id: uid(), name:'Création', icon:'🎨', color:'#8bb2b2', category:'créatif'},
    {id: uid(), name:'Repos', icon:'🌿', color:'#9aa380', category:'soin'},
    {id: uid(), name:'Présence', icon:'💞', color:'#c7a0c5', category:'relation'},
    {id: uid(), name:'Administratif', icon:'🗂️', color:'#a5a2a1', category:'tâches'},
  ];
}

function loadThemes(){
  if (state.themes && state.themes.length) return state.themes;
  state.themes = defaultThemes();
  scheduleSync();
  return state.themes;
}
function saveThemes(themes){ state.themes = Array.isArray(themes) ? themes.slice() : []; scheduleSync(); }

function loadEntries(){ return state.entries || (state.entries = {}); }
function saveEntries(entries){ state.entries = entries && typeof entries==='object' ? entries : {}; scheduleSync(); }

function loadSizes(){
  if (state.sizes && state.sizes.length) return state.sizes;
  state.sizes = [30, 60];
  scheduleSync();
  return state.sizes;
}
function saveSizes(sizes){ state.sizes = Array.isArray(sizes) ? sizes.slice() : []; scheduleSync(); }

function loadPebbleColorTray(){ return state.pebbleTray || '#edeae4'; }
function savePebbleColorTray(color){ state.pebbleTray = color || '#edeae4'; scheduleSync(); }

function loadPebbleColorChip(){ return state.pebbleChip || '#edeae4'; }
function savePebbleColorChip(color){ state.pebbleChip = color || '#edeae4'; scheduleSync(); }

function loadRingThickness(){ return Number.isFinite(state.ringThickness) && state.ringThickness>0 ? state.ringThickness : 16; }
function saveRingThickness(px){ state.ringThickness = Number(px)||16; scheduleSync(); }

function loadHandleDiameter(){ return Number.isFinite(state.handleDiameter) && state.handleDiameter>0 ? state.handleDiameter : 16; }
function saveHandleDiameter(px){ state.handleDiameter = Number(px)||16; scheduleSync(); }

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
  user: 'Seb',
  themes: [],
  emotions: [],
  emotionColors: {},
  sizes: [],
  entries: {},
  pebbleTray: '#edeae4',
  pebbleChip: '#edeae4',
  ringThickness: 16,
  handleDiameter: 16,
  stats: {
    chartType: 'donut',
    asPercent: false,
    groupBy: 'theme',
    hiddenGroups: new Set(),
    hiddenEmotions: new Set()
  }
};

function defaultEmotions(){
  // default set with associated colors
  return {
    list: ['😊','😌','🤗','😴','🌧️','🌞'],
    colors: {
      '😊':'#f6b94e', // warm yellow
      '😌':'#8bb2d9', // calm blue
      '🤗':'#c7a0c5', // lavender
      '😴':'#9aa380', // muted olive
      '🌧️':'#7e9aa6', // rainy blue-grey
      '🌞':'#f29f67', // sunny orange
    }
  };
}

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
    // header + slider container
    bucket.innerHTML = `
      <div class="bucket-header">
        <div class="bucket-title" style="color:${t.color}">${escapeHtml(t.name)}</div>
      <div class="bucket-total">${fmtBucketMins(totals[t.id]||0)}</div>
      </div>
      <div class="slider-row">
        <input
          type="range"
          class="slider"
          id="slider-${t.id}"
          min="0"
          max="${RING_MAX_MINUTES}"
          step="${smallestUnit()}"
          value="${Math.min(totals[t.id]||0, RING_MAX_MINUTES)}"
          style="accent-color:${t.color}"
          aria-label="Temps pour ${escapeHtml(t.name)}"
        />
      </div>
      
    `;

    // Append before sizing to get width
    container.appendChild(bucket);

    // Slider events: input updates the value; change refreshes week strip
    const slider = document.getElementById(`slider-${t.id}`);
    slider.addEventListener('input', (e)=>{
      const minsTarget = Number(e.target.value) || 0;
      setThemeTotal(state.date, t.id, minsTarget);
      const e2 = getEntry(state.date);
      const totals2 = totalsByTheme(e2);
      $('.bucket-total', bucket).textContent = fmtBucketMins(totals2[t.id]||0);
    });
    slider.addEventListener('change', ()=>{ renderWeekStrip(); });

    // Drag & drop supprimé; la tirette contrôle le total
  }

  // emotion
  const picker = $('#emotion-picker');
  if (picker){
    // build buttons from state.emotions
    picker.innerHTML = '';
    for (const emo of state.emotions){
      const btn = document.createElement('button');
      btn.className = 'emotion';
      btn.dataset.emotion = emo;
      btn.textContent = emo;
      if ((entry.emotion||'') === emo) btn.classList.add('selected');
      btn.onclick = () => {
        const e = getEntry(state.date);
        e.emotion = (e.emotion===emo) ? '' : emo;
        setEntry(state.date, e);
        renderToday();
      };
      picker.appendChild(btn);
    }
  }
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

// Continuous range for timeline charts (includes empty days)
function rangeContinuousDates(selectValue){
  const entries = loadEntries();
  const keys = Object.keys(entries).sort();
  const today = new Date();
  if (keys.length===0) return [];
  let startISO;
  if (selectValue==='all') startISO = keys[0];
  else if (selectValue==='this-month') startISO = startOfMonth(today).toISOString().slice(0,10);
  else {
    const n = Number(selectValue)||30;
    startISO = addDays(today, -n+1).toISOString().slice(0,10);
  }
  const endISO = today.toISOString().slice(0,10);
  const out = [];
  let d = dateFromISO(startISO);
  const end = dateFromISO(endISO);
  while (d <= end){ out.push(d.toISOString().slice(0,10)); d = addDays(d, 1); }
  return out;
}

function renderStats(){
  const rangeSel = $('#range');
  const chartSel = $('#chart-type');
  const percentChk = $('#as-percent');
  const groupSel = $('#group-by');
  // read controls -> state
  state.stats.chartType = chartSel?.value || state.stats.chartType || 'donut';
  state.stats.asPercent = !!percentChk?.checked;
  state.stats.groupBy = groupSel?.value || 'theme';

  const datesSparse = rangeDates(rangeSel.value);
  const dates = rangeContinuousDates(rangeSel.value);
  const entries = loadEntries();

  // Build groups
  const themes = state.themes.slice();
  const groupKeyOf = (t)=> state.stats.groupBy==='category' ? (t.category||'Autre') : t.id;
  const groupNameOf = (t)=> state.stats.groupBy==='category' ? (t.category||'Autre') : t.name;
  const groupsByKey = new Map(); // key -> {key, name, color}
  for (const t of themes){
    const key = groupKeyOf(t);
    if (!groupsByKey.has(key)) groupsByKey.set(key, { key, name: groupNameOf(t), color: t.color });
  }

  // Aggregate totals across range
  const totals = new Map(); // key -> minutes
  for (const d of datesSparse){
    const e = entries[d]?.pebbles||[];
    for (const p of e){
      const t = themes.find(x=>x.id===p.themeId);
      if (!t) continue;
      const key = groupKeyOf(t);
      totals.set(key, (totals.get(key)||0) + p.minutes);
    }
  }

  // Daily per group for timeline charts
  const daily = dates.map(dateISO => {
    const map = new Map();
    for (const g of groupsByKey.values()) map.set(g.key, 0);
    const pebs = entries[dateISO]?.pebbles || [];
    for (const p of pebs){
      const t = themes.find(x=>x.id===p.themeId);
      if (!t) continue;
      const key = groupKeyOf(t);
      map.set(key, (map.get(key)||0) + p.minutes);
    }
    return { date: dateISO, by: map };
  });

  // Prepare data for donut/legend
  const donutData = Array.from(groupsByKey.values()).map(g=>({
    id: g.key,
    minutes: totals.get(g.key)||0,
    theme: { name: g.name, color: g.color }
  })).filter(d=>d.minutes>0 || state.stats.chartType!=='donut');
  donutData.sort((a,b)=>b.minutes-a.minutes);

  // KPIs
  const totalMinutes = Array.from(totals.values()).reduce((a,b)=>a+b,0);
  const daysWithAny = dates.filter(d=> (entries[d]?.pebbles||[]).length>0 ).length;
  const avgPerDay = dates.length ? Math.round(totalMinutes / Math.max(1, dates.length)) : 0;
  const top = donutData[0];
  renderSummary($('#stats-summary'), {
    days: dates.length,
    daysWithAny,
    totalMinutes,
    avgPerDay,
    topName: top?.theme?.name || '—',
    topShare: totalMinutes? Math.round(100*(top?.minutes||0)/totalMinutes) : 0
  });

  // Show/hide canvases
  const pieCanvas = $('#pie');
  const barsCanvas = $('#bars');
  const heatCanvas = $('#heatmap');
  pieCanvas.style.display = state.stats.chartType==='donut' ? '' : 'none';
  barsCanvas.style.display = state.stats.chartType==='bars' ? '' : 'none';
  heatCanvas.style.display = state.stats.chartType==='heat' ? '' : 'none';

  if (state.stats.chartType==='donut'){
    drawPie(pieCanvas, donutData.filter(d=>!state.stats.hiddenGroups.has(d.id)));
  } else if (state.stats.chartType==='bars'){
    drawStackedBars(barsCanvas, daily, Array.from(groupsByKey.values()), { asPercent: state.stats.asPercent, hidden: state.stats.hiddenGroups });
  } else if (state.stats.chartType==='heat'){
    drawHeatmap(heatCanvas, daily, { hidden: state.stats.hiddenGroups });
  }

  renderLegend($('#stats-legend'), donutData);

  // ----- Emotion stats -----
  const EMOTIONS = (state.emotions && state.emotions.length) ? state.emotions.slice() : defaultEmotions().list;
  const EMOTION_COLORS = Object.assign({}, defaultEmotions().colors, state.emotionColors||{});
  // total counts per emotion in range
  const emotionCounts = new Map();
  for (const e of EMOTIONS) emotionCounts.set(e, 0);
  for (const d of datesSparse){
    const emo = entries[d]?.emotion || '';
    if (emo && emotionCounts.has(emo)) emotionCounts.set(emo, (emotionCounts.get(emo)||0)+1);
  }
  const emotionPieData = EMOTIONS.map(e=>({
    id: e,
    minutes: emotionCounts.get(e)||0, // reuse field name for pie API
    theme: { name: e, color: EMOTION_COLORS[e]||'#ccc' }
  })).filter(d=>d.minutes>0 || true); // always show slices (0 will render empty)
  // Weekday breakdown (Mon..Sun)
  const dayIndex = (iso)=> (new Date(iso).getDay()+6)%7; // 0..6, 0=Mon
  const weekly = Array.from({length:7}, ()=> new Map(EMOTIONS.map(e=>[e,0])));
  for (const d of datesSparse){
    const emo = entries[d]?.emotion || '';
    if (!emo) continue;
    const idx = dayIndex(d);
    const map = weekly[idx];
    map.set(emo, (map.get(emo)||0)+1);
  }
  const emotionGroups = EMOTIONS.map(e=>({ key:e, name:e, color: EMOTION_COLORS[e]||'#ccc' }));

  // Draw emotion donut
  const emoPieCanvas = document.getElementById('emotion-pie');
  drawPie(emoPieCanvas, emotionPieData.filter(d=>!state.stats.hiddenEmotions.has(d.id)));

  // Draw emotion weekday bars
  const emoBarsCanvas = document.getElementById('emotion-weekday');
  drawStackedBarsWeekdays(emoBarsCanvas, weekly, emotionGroups, { asPercent: state.stats.asPercent, hidden: state.stats.hiddenEmotions });

  renderEmotionLegend($('#emotion-legend'), emotionPieData);

  // Hook up control changes (idempotent)
  rangeSel.onchange = renderStats;
  chartSel.onchange = renderStats;
  percentChk.onchange = renderStats;
  groupSel.onchange = ()=>{ state.stats.hiddenGroups.clear(); renderStats(); };
}

function setupHiDPI(canvas, cssW, cssH){
  const dpr = Math.max(1, Math.floor(window.devicePixelRatio||1));
  if (cssW) canvas.style.width = cssW + 'px';
  if (cssH) canvas.style.height = cssH + 'px';
  const w = Math.floor((cssW || canvas.clientWidth || canvas.width) * dpr);
  const h = Math.floor((cssH || canvas.clientHeight || canvas.height) * dpr);
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr,0,0,dpr,0,0);
  return { ctx, w, h, dpr };
}

function drawPie(canvas, data){
  const ctx = canvas.getContext('2d');
  const cssW = 360, cssH = 360; // keep visual size similar
  setupHiDPI(canvas, cssW, cssH);
  ctx.clearRect(0,0, cssW, cssH);
  const total = data.reduce((a,b)=>a+b.minutes, 0) || 1;
  const cx = cssW/2, cy = cssH/2, r = Math.min(cx,cy)-10;
  let a0 = -Math.PI/2; // start top
  for (const d of data){
    const a1 = a0 + 2*Math.PI*(d.minutes/total);
    ctx.beginPath();
    ctx.moveTo(cx,cy);
    ctx.arc(cx,cy, r, a0, a1);
    ctx.closePath();
    ctx.fillStyle = d.theme?.color || d.color || '#ccc';
    ctx.fill();
    a0 = a1;
  }
  // inner cut for donut
  // Thickness mapped from settings.ringThickness (8..28) -> hole ratio (0.72..0.5)
  const t = Math.max(0, Math.min(1, (state.ringThickness - 8) / (28 - 8)));
  const holeRatio = 0.72 - 0.22*t;
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath(); ctx.arc(cx,cy, r*holeRatio, 0, Math.PI*2); ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  // soft ring
  const ringRatio = holeRatio + (1-holeRatio)*0.06;
  ctx.beginPath(); ctx.arc(cx,cy, r*ringRatio, 0, Math.PI*2);
  const lw = Math.max(0.5, Math.min(3, (state.handleDiameter||16)/12));
  ctx.lineWidth = lw; ctx.strokeStyle = 'rgba(0,0,0,0.10)'; ctx.stroke();
}

function renderEmotionLegend(el, data){
  el.innerHTML = '';
  const total = data.reduce((a,b)=>a+b.minutes, 0);
  for (const d of data){
    const row = document.createElement('div'); row.className = 'legend-item';
    const key = d.id;
    const hidden = state.stats.hiddenEmotions.has(key);
    row.innerHTML = `
      <input type=\"checkbox\" class=\"toggle\" ${hidden? '':'checked'} aria-label=\"Afficher ${escapeHtml(d.theme?.name||'')}\">\n      <span class=\"swatch\" style=\"background:${d.theme?.color||'#ccc'}\"></span>\n      <span class=\"name\">${d.theme?.name||'—'}</span>\n      <span class=\"time\">${d.minutes||0} ${total?`· ${Math.round(100*(d.minutes||0)/total)}%`:''}</span>
    `;
    row.querySelector('.toggle').addEventListener('change', (e)=>{
      if (e.target.checked) state.stats.hiddenEmotions.delete(key); else state.stats.hiddenEmotions.add(key);
      renderStats();
    });
    el.appendChild(row);
  }
  if (!data.length){ el.innerHTML = '<div style="color:var(--muted)">Aucune émotion sur la période.</div>'; }
}

function drawStackedBarsWeekdays(canvas, weekly, groups, opts={}){
  const hidden = opts.hidden || new Set();
  const cssW = Math.min(900, Math.max(360, canvas.parentElement?.clientWidth||640));
  const cssH = 280;
  const { ctx } = setupHiDPI(canvas, cssW, cssH);
  ctx.clearRect(0,0, cssW, cssH);
  const padL = 36, padR = 10, padT = 10, padB = 24;
  const innerW = (cssW - padL - padR);
  const innerH = (cssH - padT - padB);
  const n = 7;
  const bw = Math.max(8, innerW / n - 12);
  const daysFR = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];

  // scales
  let maxY = 0;
  for (let i=0;i<7;i++){
    const by = weekly[i];
    const sum = Array.from(by.entries()).reduce((a,[k,v])=> a + (hidden.has(k)?0:v), 0);
    if (opts.asPercent) maxY = 100; else maxY = Math.max(maxY, sum);
  }
  maxY = Math.max(1, maxY);
  const scaleY = (v)=> innerH * (v / maxY);

  // axis
  ctx.strokeStyle='rgba(0,0,0,0.1)'; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(padL, cssH-padB); ctx.lineTo(cssW-padR, cssH-padB); ctx.stroke();

  // bars
  for (let i=0;i<7;i++){
    const x0 = padL + i*(bw+12);
    const by = weekly[i];
    let acc = 0;
    for (const g of groups){
      if (hidden.has(g.key)) continue;
      const vRaw = by.get(g.key)||0;
      const dayTotal = Array.from(by.entries()).reduce((a,[k,v])=> a + (hidden.has(k)?0:v), 0);
      const v = opts.asPercent ? (dayTotal? (100*vRaw/dayTotal) : 0) : vRaw;
      const hpx = scaleY(v);
      if (!hpx) continue;
      const y = cssH - padB - acc - hpx;
      ctx.fillStyle = g.color;
      ctx.fillRect(x0, y, bw, hpx);
      acc += hpx;
    }
  }

  // labels
  ctx.fillStyle='rgba(0,0,0,0.55)'; ctx.font='11px system-ui'; ctx.textAlign='center'; ctx.textBaseline='top';
  for (let i=0;i<7;i++){
    const x = padL + i*(bw+12) + bw/2;
    ctx.fillText(daysFR[i], x, cssH - padB + 4);
  }
}

function renderLegend(el, data){
  el.innerHTML = '';
  const total = data.reduce((a,b)=>a+b.minutes, 0);
  for (const d of data){
    const row = document.createElement('div'); row.className = 'legend-item';
    const key = d.id;
    const hidden = state.stats.hiddenGroups.has(key);
    row.innerHTML = `
      <input type="checkbox" class="toggle" ${hidden? '':'checked'} aria-label="Afficher ${escapeHtml(d.theme?.name||'')}">
      <span class="swatch" style="background:${d.theme?.color||'#ccc'}"></span>
      <span class="name">${d.theme?.name||'—'}</span>
      <span class="time">${fmtMins(d.minutes)} ${total?`· ${Math.round(100*d.minutes/total)}%`:''}</span>
    `;
    row.querySelector('.toggle').addEventListener('change', (e)=>{
      if (e.target.checked) state.stats.hiddenGroups.delete(key); else state.stats.hiddenGroups.add(key);
      renderStats();
    });
    el.appendChild(row);
  }
  if (!data.length){ el.innerHTML = '<div style="color:var(--muted)">Aucune donnée sur la période.</div>'; }
}

function renderSummary(el, kpis){
  const parts = [];
  parts.push(`<span class="kpi">Total: ${fmtMins(kpis.totalMinutes||0)}</span>`);
  parts.push(`<span class="kpi">Jours: ${kpis.days||0}</span>`);
  parts.push(`<span class="kpi">Actifs: ${kpis.daysWithAny||0}</span>`);
  parts.push(`<span class="kpi">Moy/jour: ${fmtMins(kpis.avgPerDay||0)}</span>`);
  if (kpis.topName){ parts.push(`<span class="kpi">Top: ${escapeHtml(kpis.topName)} (${kpis.topShare||0}%)</span>`); }
  el.innerHTML = parts.join(' ');
}

function drawStackedBars(canvas, daily, groups, opts={}){
  const hidden = opts.hidden || new Set();
  const cssW = Math.min(900, Math.max(360, canvas.parentElement?.clientWidth||640));
  const cssH = 280;
  const { ctx } = setupHiDPI(canvas, cssW, cssH);
  ctx.clearRect(0,0, cssW, cssH);
  const padL = 36, padR = 10, padT = 10, padB = 24;
  const innerW = (cssW - padL - padR);
  const innerH = (cssH - padT - padB);
  const n = daily.length || 1;
  const bw = Math.max(2, innerW / n - 2);

  // scales
  let maxY = 0;
  for (const d of daily){
    const sum = Array.from(d.by.entries()).reduce((a,[k,v])=> a + (hidden.has(k)?0:v), 0);
    if (opts.asPercent) maxY = 100; else maxY = Math.max(maxY, sum);
  }
  maxY = Math.max(60, maxY);
  const scaleY = (v)=> innerH * (v / maxY);

  // draw axes (minimal)
  ctx.strokeStyle='rgba(0,0,0,0.1)'; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(padL, cssH-padB); ctx.lineTo(cssW-padR, cssH-padB); ctx.stroke();

  // bars
  for (let i=0;i<daily.length;i++){
    const d = daily[i];
    const x0 = padL + i*(bw+2);
    // stack by group
    let acc = 0;
    for (const g of groups){
      if (hidden.has(g.key)) continue;
      const vRaw = d.by.get(g.key)||0;
      const dayTotal = Array.from(d.by.entries()).reduce((a,[k,v])=> a + (hidden.has(k)?0:v), 0);
      const v = opts.asPercent ? (dayTotal? (100*vRaw/dayTotal) : 0) : vRaw;
      const hpx = scaleY(v);
      if (!hpx) continue;
      const y = cssH - padB - acc - hpx;
      ctx.fillStyle = g.color;
      ctx.fillRect(x0, y, bw, hpx);
      acc += hpx;
    }
  }

  // x labels (sparse)
  ctx.fillStyle='rgba(0,0,0,0.55)'; ctx.font='11px system-ui'; ctx.textAlign='center'; ctx.textBaseline='top';
  const step = Math.ceil(n / 10);
  for (let i=0;i<daily.length;i+=step){
    const x = padL + i*(bw+2) + bw/2;
    ctx.fillText(fmtDateEU(daily[i].date), x, cssH - padB + 4);
  }
}

function drawHeatmap(canvas, daily, opts={}){
  const hidden = opts.hidden || new Set();
  const cssW = Math.min(900, Math.max(360, canvas.parentElement?.clientWidth||640));
  const cssH = 220;
  const { ctx } = setupHiDPI(canvas, cssW, cssH);
  ctx.clearRect(0,0, cssW, cssH);
  const padL = 28, padR = 8, padT = 18, padB = 22;
  const innerW = cssW - padL - padR;
  const innerH = cssH - padT - padB;
  const dayTotals = daily.map(d=> Array.from(d.by.entries()).reduce((a,[k,v])=> a + (hidden.has(k)?0:v), 0));
  const maxV = Math.max(30, ...dayTotals);

  // layout: columns = weeks, rows = 7 (lun..dim)
  const dates = daily.map(d=> d.date);
  // find first day of week (Mon=1) index
  const dayIndex = (iso)=> (new Date(iso).getDay()+6)%7; // 0..6, 0=Mon
  const weeks = [];
  for (let i=0;i<dates.length;i++){
    const iso = dates[i];
    const weekIdx = weeks.length-1;
    if (weeks.length===0 || dayIndex(iso)===0) weeks.push([]);
    weeks[weeks.length-1].push({ iso, total: dayTotals[i], dow: dayIndex(iso) });
  }
  const cols = weeks.length;
  const cellW = Math.max(6, Math.floor(innerW / Math.max(1, cols)) - 2);
  const cellH = Math.floor(innerH / 7) - 2;

  // titles
  const daysFR = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];
  ctx.fillStyle='rgba(0,0,0,0.55)'; ctx.font='11px system-ui'; ctx.textAlign='right'; ctx.textBaseline='middle';
  for (let r=0;r<7;r++){ ctx.fillText(daysFR[r], padL - 6, padT + r*(cellH+2) + cellH/2); }

  // cells
  for (let c=0;c<weeks.length;c++){
    const col = weeks[c];
    for (const cell of col){
      const r = cell.dow;
      const x = padL + c*(cellW+2);
      const y = padT + r*(cellH+2);
      const t = Math.min(1, cell.total / maxV);
      const base = '#6a7c6f'; // var(--accent)
      ctx.fillStyle = mixColor('#ffffff', base, 0.15 + 0.85*t);
      ctx.fillRect(x, y, cellW, cellH);
    }
  }

  // month labels (sparse)
  ctx.fillStyle='rgba(0,0,0,0.55)'; ctx.font='11px system-ui'; ctx.textAlign='center'; ctx.textBaseline='top';
  for (let c=0;c<weeks.length;c++){
    const firstISO = weeks[c][0]?.iso;
    if (!firstISO) continue;
    const d = new Date(firstISO);
    if (d.getDate()<=7){ // show once near month start
      const month = d.toLocaleString('fr-FR', { month:'short' });
      const x = padL + c*(cellW+2) + cellW/2;
      ctx.fillText(month, x, 2);
    }
  }
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
      <input class="category" type="text" value="${escapeHtml(t.category||'')}" aria-label="Catégorie" placeholder="Catégorie" />
      <input class="color" type="color" value="${t.color}" aria-label="Couleur" />
      <button class="del" title="Supprimer">Supprimer</button>
    `;
    const sw = li.querySelector('.swatch');
    const nameInput = li.querySelector('.name');
    const catInput = li.querySelector('.category');
    const colorInput = li.querySelector('.color');
    const delBtn = li.querySelector('.del');
    const upBtn = li.querySelector('.up');
    const downBtn = li.querySelector('.down');
    nameInput.addEventListener('change', ()=>{ t.name = nameInput.value; saveThemes(state.themes); renderToday(); renderStats(); });
    catInput.addEventListener('change', ()=>{ t.category = catInput.value; saveThemes(state.themes); renderStats(); });
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
    thickInput.oninput = (e)=>{ state.ringThickness = Number(e.target.value)||16; if (thickVal) thickVal.textContent = `${state.ringThickness}px`; renderToday(); renderStats(); };
    thickInput.onchange = ()=>{ saveRingThickness(state.ringThickness); renderToday(); renderStats(); };
  }

  if (handleInput){
    handleInput.value = String(state.handleDiameter);
    if (handleVal) handleVal.textContent = `${state.handleDiameter}px`;
    handleInput.oninput = (e)=>{ state.handleDiameter = Number(e.target.value)||16; if (handleVal) handleVal.textContent = `${state.handleDiameter}px`; renderToday(); renderStats(); };
    handleInput.onchange = ()=>{ saveHandleDiameter(state.handleDiameter); renderToday(); renderStats(); };
  }

  // no sizes controls

  // emotions editor
  const emoUL = document.getElementById('emotions-list');
  if (emoUL){
    emoUL.innerHTML = '';
    const list = state.emotions || [];
    for (let i=0;i<list.length;i++){
      const e = list[i];
      const li = document.createElement('li');
      li.className = 'theme-item';
      const color = (state.emotionColors && state.emotionColors[e]) || '#cccccc';
      li.innerHTML = `
        <span class="swatch" style="background:${color}"></span>
        <div class="move">
          <button class="up" title="Monter">▲</button>
          <button class="down" title="Descendre">▼</button>
        </div>
        <input class="emoji" type="text" value="${escapeHtml(e)}" aria-label="Émotion" />
        <input class="color" type="color" value="${color}" aria-label="Couleur" />
        <button class="del" title="Supprimer">Supprimer</button>
      `;
      const sw = li.querySelector('.swatch');
      const emojiInput = li.querySelector('.emoji');
      const colorInput = li.querySelector('.color');
      const upBtn = li.querySelector('.up');
      const downBtn = li.querySelector('.down');
      const delBtn = li.querySelector('.del');
      // change emoji: update list and migrate color mapping
      emojiInput.addEventListener('change', ()=>{
        const newVal = emojiInput.value || '';
        const oldVal = list[i];
        if (newVal===oldVal) return;
        // update entries: migrate old emotion to new
        const entries = loadEntries();
        for (const k of Object.keys(entries)){
          if (entries[k].emotion === oldVal) entries[k].emotion = newVal;
        }
        // move color mapping
        const col = state.emotionColors[oldVal];
        delete state.emotionColors[oldVal];
        if (col) state.emotionColors[newVal] = col;
        list[i] = newVal;
        state.emotions = list.slice();
        scheduleSync();
        renderSettings(); renderToday(); renderStats();
      });
      colorInput.addEventListener('input', ()=>{
        state.emotionColors[e] = colorInput.value;
        sw.style.background = colorInput.value;
        scheduleSync();
        renderStats();
      });
      upBtn.addEventListener('click', ()=>{ if (i>0){ const tmp=list[i-1]; list[i-1]=list[i]; list[i]=tmp; state.emotions=list.slice(); scheduleSync(); renderSettings(); renderToday(); renderStats(); }});
      downBtn.addEventListener('click', ()=>{ if (i<list.length-1){ const tmp=list[i+1]; list[i+1]=list[i]; list[i]=tmp; state.emotions=list.slice(); scheduleSync(); renderSettings(); renderToday(); renderStats(); }});
      delBtn.addEventListener('click', ()=>{
        state.emotions = list.filter((_,idx)=>idx!==i);
        // keep past data as-is; color mapping can be kept or cleaned
        scheduleSync();
        renderSettings(); renderToday(); renderStats();
      });
      emoUL.appendChild(li);
    }
    const addBtn = document.getElementById('add-emotion');
    if (addBtn){
      addBtn.onclick = ()=>{
        const d = defaultEmotions();
        const fallback = '🙂';
        const newEmoji = fallback;
        if (!state.emotions) state.emotions = [];
        state.emotions.push(newEmoji);
        if (!state.emotionColors) state.emotionColors = {};
        state.emotionColors[newEmoji] = '#cccccc';
        scheduleSync();
        renderSettings(); renderToday(); renderStats();
      };
    }
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
const RING_MAX_MINUTES = 480; // 8h max par tirette
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
  return {
    version:3,
    user: state.user,
    themes: state.themes,
    entries: loadEntries(),
    sizes: state.sizes,
    emotions: state.emotions,
    emotionColors: state.emotionColors,
    pebbleColorTray: state.pebbleTray,
    pebbleColorChip: state.pebbleChip,
    ringThickness: state.ringThickness,
    handleDiameter: state.handleDiameter
  };
}
function importData(data){
  if (!data || typeof data!=='object') throw new Error('bad');
  if (Array.isArray(data.themes)) saveThemes(data.themes);
  if (data.entries && typeof data.entries==='object') saveEntries(data.entries);
  if (Array.isArray(data.sizes) && data.sizes.length) saveSizes(data.sizes);
  if (Array.isArray(data.emotions)) state.emotions = data.emotions.slice();
  if (data.emotionColors && typeof data.emotionColors==='object') state.emotionColors = Object.assign({}, data.emotionColors);
  if (typeof data.pebbleColorTray === 'string') { state.pebbleTray = data.pebbleColorTray; savePebbleColorTray(state.pebbleTray); }
  if (typeof data.pebbleColorChip === 'string') { state.pebbleChip = data.pebbleColorChip; savePebbleColorChip(state.pebbleChip); }
  if (!data.pebbleColorTray && !data.pebbleColorChip && typeof data.pebbleColor==='string'){
    state.pebbleTray = data.pebbleColor; state.pebbleChip = data.pebbleColor; savePebbleColorTray(state.pebbleTray); savePebbleColorChip(state.pebbleChip);
  }
  if (Number.isFinite(data.ringThickness)) { state.ringThickness = data.ringThickness; saveRingThickness(state.ringThickness); }
  if (Number.isFinite(data.handleDiameter)) { state.handleDiameter = data.handleDiameter; saveHandleDiameter(state.handleDiameter); }
  // Defaults for emotions if missing
  if (!state.emotions.length){ const d = defaultEmotions(); state.emotions = d.list.slice(); state.emotionColors = Object.assign({}, d.colors); }
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
    if (!state.emotions.length){ const d = defaultEmotions(); state.emotions = d.list.slice(); state.emotionColors = Object.assign({}, d.colors); }
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
    state.themes = [];
    state.sizes = [];
    state.entries = {};
    state.pebbleTray = '#edeae4';
    state.pebbleChip = '#edeae4';
    state.ringThickness = 16;
    state.handleDiameter = 16;
    await tryLoadFromServer(state.user);
    if (!state.themes.length) state.themes = loadThemes();
    if (!state.sizes.length) state.sizes = loadSizes();
    if (!state.emotions.length){ const d = defaultEmotions(); state.emotions = d.list.slice(); state.emotionColors = Object.assign({}, d.colors); }
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
      if (Array.isArray(data.themes)) { state.themes = data.themes; }
      if (Array.isArray(data.sizes)) { state.sizes = data.sizes; }
      if (data.entries && typeof data.entries==='object') { state.entries = data.entries; }
      if (Array.isArray(data.emotions)) { state.emotions = data.emotions; }
      if (data.emotionColors && typeof data.emotionColors==='object') { state.emotionColors = data.emotionColors; }
      if (typeof data.pebbleColorTray==='string') { state.pebbleTray = data.pebbleColorTray; }
      if (typeof data.pebbleColorChip==='string') { state.pebbleChip = data.pebbleColorChip; }
      else if (typeof data.pebbleColor==='string') { state.pebbleTray = data.pebbleColor; state.pebbleChip = data.pebbleColor; }
      if (Number.isFinite(data.ringThickness)) { state.ringThickness = data.ringThickness; }
      if (Number.isFinite(data.handleDiameter)) { state.handleDiameter = data.handleDiameter; }
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
