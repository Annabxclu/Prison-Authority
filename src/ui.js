/* ================= UI helpers ================= */
const UI = { view: 'dashboard', modal: null, prof: null, profTab: 'Overview', repTab: 'Daily', dirty: false };
const A = {}; // click actions
const C = {}; // change actions
const TS = {}, TDEF = {};

const tag = c => `<span class="tag c-${c}">${CLS_SHORT[c]}</span>`;
const sevTag = s => `<span class="tag sv-${s}">${s}</span>`;
function bar(v, invert) { const x = invert ? 100 - v : v; const cls = x < 30 ? 'b' : x < 55 ? 'w' : ''; return `<div class="bar ${cls}"><i style="width:${clamp(v)}%"></i></div>`; }
function kpi(l, v, s, cls = '') { return `<div class="card kpi"><div class="l">${l}</div><div class="v ${cls}">${v}</div>${s ? `<div class="s">${s}</div>` : ''}</div>`; }
function btn(label, act, arg, cls = '', dis) { return `<button class="btn ${cls}" data-a="${act}"${arg != null ? ` data-arg="${esc(arg)}"` : ''}${dis ? ' disabled' : ''}>${label}</button>`; }
function seg(name, cur, opts) { return `<div class="seg">${opts.map(([v, l]) => `<button class="${v === cur ? 'on' : ''}" data-a="seg" data-arg="${name}|${v}">${l}</button>`).join('')}</div>`; }
function chk(c, checked, label, arg = '', dis) { return `<label class="chk"><input type="checkbox" data-c="${c}" data-arg="${esc(arg)}"${checked ? ' checked' : ''}${dis ? ' disabled' : ''}> ${label}</label>`; }
function num(c, val, arg = '', min = 0, max = 9999, step = 1, w) { return `<input type="number" data-c="${c}" data-arg="${esc(arg)}" value="${val}" min="${min}" max="${max}" step="${step}"${w ? ` style="width:${w}px"` : ''}>`; }
function sel(c, cur, opts, arg = '') { return `<select data-c="${c}" data-arg="${esc(arg)}">${opts.map(o => { const [v, l] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(v)}"${v == cur ? ' selected' : ''}>${esc(l)}</option>`; }).join('')}</select>`; }
function spark(vals, color = 'var(--acc)') {
  if (vals.length < 2) return '<div class="tiny dim">Not enough data yet — check back after a few days.</div>';
  const mn = Math.min(...vals), mx = Math.max(...vals), r = mx - mn || 1;
  const pts = vals.map((v, i) => `${(i / (vals.length - 1) * 300).toFixed(1)},${(38 - (v - mn) / r * 34).toFixed(1)}`).join(' ');
  return `<svg class="spark" viewBox="0 0 300 40" preserveAspectRatio="none"><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>`;
}
function inmLink(id, name) { return `<a data-a="inmate" data-arg="${id}" style="cursor:pointer">${esc(name || id)}</a>`; }
function relDay(t) { const d = curDay() - curDay(t); return d === 0 ? clockStr(t) : d === 1 ? 'Yesterday' : d + 'd ago'; }

/* ---------- Generic table ---------- */
function tbl(id, rows, cols, opt = {}) {
  TDEF[id] = { rows, cols, opt };
  const st = TS[id] = TS[id] || { q: '', sort: opt.sort != null ? opt.sort : null, dir: opt.dir || 1, page: 0, f: {} };
  let bar = '';
  if (opt.search !== false || opt.filters || opt.tools) {
    bar = `<div class="tbar">${opt.search !== false ? `<input type="text" placeholder="Search…" data-tq="${id}" value="${esc(st.q)}">` : ''}
      ${(opt.filters || []).map((f, k) => `<select data-tf="${id}|${k}"><option value="">${f.l}: All</option>${f.opts.map(o => `<option${st.f[k] === o ? ' selected' : ''}>${esc(o)}</option>`).join('')}</select>`).join('')}
      ${opt.tools || ''}</div>`;
  }
  return bar + `<div id="tb-${id}">${tblBody(id)}</div>`;
}
function tblBody(id) {
  const { rows, cols, opt } = TDEF[id]; const st = TS[id];
  let r = rows;
  (opt.filters || []).forEach((f, k) => { if (st.f[k]) r = r.filter(x => f.fn(x, st.f[k])); });
  if (st.q) { const q = st.q.toLowerCase(); r = r.filter(x => cols.some(c => c.q !== false && String(c.v(x)).toLowerCase().includes(q))); }
  if (st.sort != null && cols[st.sort]) { const c = cols[st.sort]; const f = c.s || c.v; r = r.slice().sort((a, b) => { const x = f(a), y = f(b); return (x > y ? 1 : x < y ? -1 : 0) * st.dir; }); }
  const per = opt.per || 25; const pages = Math.max(1, Math.ceil(r.length / per)); if (st.page >= pages) st.page = pages - 1;
  const slice = r.slice(st.page * per, st.page * per + per);
  if (!rows.length) return `<div class="card center mut small">${opt.empty || 'Nothing here yet.'}</div>`;
  let h = `<div class="twrap"><table><thead><tr>${cols.map((c, k) => `<th class="${c.ns ? '' : 's'} ${c.r ? 'right' : ''}" ${c.ns ? '' : `data-ts="${id}|${k}"`}>${c.l}${st.sort === k ? (st.dir > 0 ? ' ▲' : ' ▼') : ''}</th>`).join('')}</tr></thead><tbody>`;
  for (const x of slice) {
    h += `<tr${opt.row ? ` class="click" data-a="${opt.row}" data-arg="${esc(opt.rowArg(x))}"` : ''}>${cols.map(c => `<td class="${c.r ? 'right' : ''}">${c.h ? c.h(x) : esc(c.v(x))}</td>`).join('')}</tr>`;
  }
  h += `</tbody></table></div>`;
  if (!slice.length) h += `<div class="small mut center mt6">No matches.</div>`;
  h += `<div class="pager">${r.length} record${r.length === 1 ? '' : 's'} · page ${st.page + 1}/${pages}
    <button class="btn sm" data-tp="${id}|-1"${st.page === 0 ? ' disabled' : ''}>‹ Prev</button><button class="btn sm" data-tp="${id}|1"${st.page >= pages - 1 ? ' disabled' : ''}>Next ›</button></div>`;
  return h;
}
function rerenderTable(id) { const el = document.getElementById('tb-' + id); if (el && TDEF[id]) el.innerHTML = tblBody(id); }

/* ---------- Modal & toast ---------- */
function openModal(html, narrow) { UI.modal = true; $('#modalBg').classList.remove('hide'); $('#modalBg').innerHTML = `<div class="modal ${narrow ? 'narrow' : ''}"><button class="mclose" data-a="closeModal">×</button>${html}</div>`; }
function closeModal() { UI.modal = null; UI.prof = null; $('#modalBg').classList.add('hide'); $('#modalBg').innerHTML = ''; }
function confirmBox(title, msg, okLabel, fn, danger) {
  UI._confirm = fn;
  openModal(`<h2>${title}</h2><p class="mut">${msg}</p><div class="row" style="justify-content:flex-end">${btn('Cancel', 'closeModal')}${btn(okLabel, 'confirmOk', null, danger ? 'danger' : 'pri')}</div>`, true);
}
A.confirmOk = () => { const f = UI._confirm; closeModal(); if (f) f(); };
function toast(lvl, msg) {
  const t = document.createElement('div'); t.className = 'toast ' + lvl; t.textContent = msg;
  $('#toasts').appendChild(t); setTimeout(() => t.remove(), 5000);
  while ($('#toasts').children.length > 4) $('#toasts').firstChild.remove();
}
toastHook = (lvl, msg) => { if (document.getElementById('toasts')) toast(lvl, msg); };

/* ---------- Recommendations ---------- */
function issues() {
  const out = []; if (!S) return out;
  const req = requirements();
  const pop = S.inm.length;
  const open = S.inc.filter(x => x.status === 'Open');
  if (S.money < 0) out.push(['bad', `Balance is negative (${fmt$(S.money)}). Staff morale and attendance will fall. Cut costs or admit more funded inmates.`, 'finance']);
  const y = S.hist[S.hist.length - 1];
  if (y && y.inc - y.exp < 0 && S.money > 0) out.push(['warn', `Yesterday ran a deficit of ${fmt$(y.exp - y.inc)}. Review expenses or raise intake to fill empty beds.`, 'finance']);
  if (open.length) out.push([open.some(x => x.sev === 'Critical') ? 'bad' : 'warn', `${open.length} incident${open.length > 1 ? 's need' : ' needs'} a disciplinary decision. Unresolved incidents lapse after 3 days and hurt safety.`, 'security']);
  const offHave = staffCount('Correctional Officer'), offReq = req['Correctional Officer'];
  if (offHave < offReq) out.push(['warn', `Officer shortfall: ${offHave} employed, ${offReq} needed for current occupancy across both shifts. Hire officers in Personnel.`, 'personnel']);
  const cov = computeCoverage(shiftOf(curHour()));
  const thin = S.blocks.filter(b => blockOcc(b) && cov[b.id] < .75);
  if (thin.length && offHave >= offReq) out.push(['warn', `Thin coverage in ${thin.map(b => b.name).join(', ')}. Use "Auto-assign officers" in Personnel.`, 'personnel']);
  ['Medical Staff', 'Kitchen Worker', 'Maintenance Worker', 'Administrator'].forEach(r => { if (staffCount(r) < req[r]) out.push(['warn', `${r}: ${staffCount(r)} employed, ${req[r]} recommended.`, 'personnel']); });
  const use = dailyFoodUse();
  if (pop && S.food < use * 1.5) out.push([S.food < use ? 'bad' : 'warn', `Food inventory covers ${(S.food / Math.max(1, use)).toFixed(1)} days. ${S.settings.autoReorder ? 'Auto-reorder will top up at midnight.' : 'Buy food in Kitchen or enable auto-reorder.'}`, 'kitchen']);
  if (S.queue.length) out.push(['warn', `${S.queue.length} inmates in the pending intake queue. Build cell blocks or lower intake to avoid transfers.`, 'intake']);
  CLASSES.filter(c => S.unlock.classes.includes(c)).forEach(c => { const cap = totalCapacity(c); if (cap && freeBeds(c) / cap < .1 && S.settings.intake[c] > 0) out.push(['info', `${c} housing is ${Math.round((1 - freeBeds(c) / cap) * 100)}% full. Consider building another ${c} block.`, 'housing']); });
  if (pop) {
    const stress = avgNeed('stress'); if (stress > 60) out.push(['warn', `Average stress is high (${Math.round(stress)}). More recreation, free time, better meals or counseling will help.`, 'regimes']);
    const hy = avgNeed('hygiene'); if (hy < 40) out.push(['warn', `Hygiene is low (${Math.round(hy)}). Add shower periods or laundry workers.`, 'regimes']);
    const rec = avgNeed('rec'); if (rec < 35) out.push(['warn', `Recreation needs are unmet (${Math.round(rec)}). Add recreation or free time to the regime.`, 'regimes']);
    const idle = S.inm.filter(i => !i.job && !i.prog).length;
    if (idle / pop > .5 && pop > 10) out.push(['info', `${idle} inmates have neither a job nor a program. Add job positions or program staff to improve behavior and parole outcomes.`, 'employment']);
  }
  const due = S.inm.filter(i => i.hearing).length;
  if (due) out.push(['info', `${due} parole hearing${due > 1 ? 's are' : ' is'} due.`, 'parole']);
  if (S.blocks.some(b => b.status === 'Lockdown')) out.push(['info', `Lockdown in effect: ${S.blocks.filter(b => b.status === 'Lockdown').map(b => b.name).join(', ')}.`, 'housing']);
  return out;
}

/* ================= Views ================= */
const NAV = [
  ['dashboard', 'Dashboard'], ['inmates', 'Inmates'], ['intake', 'Intake'], ['housing', 'Housing'], ['security', 'Security'], ['discipline', 'Discipline'],
  ['personnel', 'Personnel'], ['regimes', 'Regimes'], ['kitchen', 'Kitchen'], ['employment', 'Employment'], ['rehabilitation', 'Rehabilitation'],
  ['healthcare', 'Healthcare'], ['visitors', 'Visitors'], ['parole', 'Parole & Appeals'], ['finance', 'Finance'], ['reports', 'Reports'], ['administration', 'Administration'], ['testing', 'Test Mode']
];
const V = {};

V.dashboard = () => {
  const pop = S.inm.length, cap = totalCapacity();
  const y = S.hist[S.hist.length - 1];
  const open = S.inc.filter(x => x.status === 'Open').length;
  const cov = avgCoverage();
  const sat = pop ? avg(S.inm, satisfaction) : 0;
  const iss = issues();
  let h = `<h1>Dashboard</h1><p class="sub">${esc(S.name)} · ${modeLabel(S.mode)} mode · ${S.pop} facility · Day ${curDay()} (${DOW[dow()]}) · Weather: ${S.weather || 'Clear'}</p>`;
  if (S.speed === 0 && S.t === 360) h += `<div class="alert info">The clock is paused. Press <b>1x</b> (or faster) at the top to start the simulation. First inmates arrive at 08:00.</div>`;
  h += `<div class="grid g4 mb">
    ${kpi('Population', `${pop}<span class="mut small"> / ${cap}</span>`, `${S.queue.length} pending · ${cap ? Math.round(pop / cap * 100) : 0}% occupied`)}
    ${kpi('Balance', fmt$(S.money), y ? `Yesterday ${y.inc - y.exp >= 0 ? '+' : ''}${fmt$(y.inc - y.exp)}` : 'First report at midnight', S.money < 0 ? 'bad' : '')}
    ${kpi('Open incidents', open, `${S.today.inc.Minor + S.today.inc.Moderate + S.today.inc.Major + S.today.inc.Critical} today`, open ? 'warn' : '')}
    ${kpi('Officer coverage', pct(Math.min(1, cov)), `${staffCount('Correctional Officer')} officers employed`, cov < .75 ? 'warn' : '')}
    ${kpi('Satisfaction', pop ? Math.round(sat) : '—', 'Average of all needs')}
    ${kpi('Safety', pop ? Math.round(avgNeed('safety')) : '—', `Stress ${pop ? Math.round(avgNeed('stress')) : '—'}`)}
    ${kpi('Food', `${(S.food / Math.max(1, dailyFoodUse())).toFixed(1)}d`, `${fmtN(S.food)} meals in stock`, S.food < dailyFoodUse() ? 'bad' : '')}
    ${kpi('Last inspection', S.lastInspection ? S.lastInspection.score : '—', S.lastInspection ? `${S.lastInspection.grade} · Day ${S.lastInspection.d}` : 'Monthly, or request one')}
  </div>`;
  h += `<div class="grid g2">`;
  // left column
  h += `<div>`;
  if (S.mode === 'career') h += careerCard(true);
  h += `<div class="card mb"><h3>Action items</h3>${iss.length ? iss.slice(0, 8).map(([l, m, v]) => `<div class="alert ${l}">${esc(m)} <a data-a="nav" data-arg="${v}" style="cursor:pointer">Open ${v} →</a></div>`).join('') : '<div class="alert good">Everything is running smoothly.</div>'}</div>`;
  h += `<div class="card mb"><h3>Capacity by classification</h3><div class="twrap"><table><thead><tr><th>Class</th><th class="right">Housed</th><th class="right">Beds</th><th class="right">Free</th><th class="right">Intake/day</th></tr></thead><tbody>
    ${CLASSES.filter(c => S.unlock.classes.includes(c) || totalCapacity(c)).map(c => `<tr><td>${tag(c)} ${CLS_LABEL[c]}</td><td class="right mono">${S.inm.filter(i => i.cls === c).length}</td><td class="right mono">${totalCapacity(c)}</td><td class="right mono">${freeBeds(c)}</td><td class="right mono">${S.settings.intakeOn ? S.settings.intake[c] : 0}</td></tr>`).join('')}
    </tbody></table></div></div>`;
  h += `<div class="card mb"><h3>Inmate needs</h3>${needBars(S.inm)}</div>`;
  h += `</div>`;
  // right column
  h += `<div>`;
  h += `<div class="card mb"><div class="spread"><h3>Notifications</h3>${btn('Mark all read', 'readAll', null, 'sm')}</div><div class="feed">${S.notes.slice(0, 40).map(n => `<div class="note ${n.lvl}"><div class="t">${stamp(n.t)}</div><div class="m">${n.read ? '' : '<span class="dot" style="background:var(--acc)"></span>'}${esc(n.msg)}</div></div>`).join('') || '<div class="mut small">No notifications.</div>'}</div></div>`;
  const hs = S.hist.slice(-30);
  h += `<div class="card mb"><h3>Last 30 days</h3>
    <div class="small mut">Population</div>${spark(hs.map(x => x.pop))}
    <div class="small mut mt6">Balance</div>${spark(hs.map(x => x.bal), 'var(--good)')}
    <div class="small mut mt6">Incidents per day</div>${spark(hs.map(x => sum(Object.values(x.incidents))), 'var(--bad)')}</div>`;
  h += `</div></div>`;
  return h;
};
function needBars(list) {
  if (!list.length) return '<div class="mut small">No inmates yet.</div>';
  const L = { hunger: 'Hunger', hygiene: 'Hygiene', rec: 'Recreation', health: 'Health', social: 'Social', comfort: 'Comfort', stress: 'Stress', safety: 'Safety' };
  return Object.entries(L).map(([k, l]) => { const v = Math.round(avgNeed(k, list)); return `<div class="needrow"><span class="mut">${l}</span>${bar(v, k === 'stress')}<span class="mono right">${v}</span></div>`; }).join('') + '<div class="tiny dim mt6">Needs are 0–100 where higher is better, except Stress (lower is better).</div>';
}
function needBarsOne(i) {
  const L = { hunger: 'Hunger', hygiene: 'Hygiene', rec: 'Recreation', health: 'Health', social: 'Social', comfort: 'Comfort', stress: 'Stress', safety: 'Safety' };
  return Object.entries(L).map(([k, l]) => { const v = Math.round(i.n[k]); return `<div class="needrow"><span class="mut">${l}</span>${bar(v, k === 'stress')}<span class="mono right">${v}</span></div>`; }).join('');
}
function careerCard(compact) {
  const idx = S.career.idx;
  const list = compact ? CAREER.slice(Math.max(0, idx - 1), idx + 3) : CAREER;
  return `<div class="card mb"><div class="spread"><h3>Career objectives</h3><span class="small mut">${idx}/${CAREER.length} complete</span></div>
    ${list.map((o) => { const k = CAREER.indexOf(o); const done = k < idx; return `<div class="obj ${done ? 'done' : ''} ${k === idx ? 'cur' : ''}"><div class="ck">${done ? '✓' : ''}</div><div><b>${o.t}</b><div class="mut small">${o.d}</div><div class="small ${done ? 'good' : 'info'}">Reward: ${o.reward}</div></div></div>`; }).join('')}
    ${idx >= CAREER.length ? '<div class="alert good mt6">Career complete! Your prison is a flagship facility. Keep playing or start a sandbox.</div>' : ''}</div>`;
}

/* ---------- Inmates ---------- */
V.inmates = () => {
  const cols = [
    { l: 'ID', v: i => i.id, h: i => `<span class="mono">${i.id}</span>` },
    { l: 'Name', v: i => iname(i) },
    { l: 'Age', v: i => i.age, r: 1 },
    { l: 'Class', v: i => i.cls, s: i => CLASSES.indexOf(i.cls), h: i => tag(i.cls) },
    { l: 'Housing', v: i => cellLabel(i) },
    { l: 'Location', v: i => i.loc },
    { l: 'Risk', v: i => i.risk, s: i => ['Low', 'Moderate', 'High', 'Extreme'].indexOf(i.risk), h: i => `<span class="${i.risk === 'Extreme' ? 'bad' : i.risk === 'High' ? 'warn' : ''}">${i.risk}</span>` },
    { l: 'Behavior', v: i => Math.round(i.beh), h: i => `<div class="row" style="gap:6px;flex-wrap:nowrap">${bar(i.beh)}<span class="mono small">${Math.round(i.beh)}</span></div>` },
    { l: 'Status', v: i => i.infirm ? 'Infirmary' : i.disc, h: i => i.infirm ? '<span class="info">Infirmary</span>' : `<span class="${i.disc === 'Solitary' ? 'bad' : i.disc === 'Restricted' ? 'warn' : i.disc === 'Warning' ? 'mut' : 'good'}">${i.disc}</span>` },
    { l: 'Job', v: i => i.job || '—' },
    { l: 'Program', v: i => i.prog || '—' },
    { l: 'Days left', v: i => remaining(i), r: 1, h: i => i.cls === 'DeathRow' && !i.commuted ? '<span class="bad">Death</span>' : `<span class="mono">${remaining(i)}</span>` },
    { l: 'Parole', v: i => i.parole, r: 1, h: i => i.appeal ? (i.appeal.exec ? `<span class="bad">Exec D${i.appeal.exec}</span>` : `<span class="info">Appeal ${i.appeal.stage + 1}/4</span>`) : i.hearing ? '<span class="warn">Due</span>' : `<span class="mono">D${i.parole}</span>` }
  ];
  return `<h1>Inmates</h1><p class="sub">${S.inm.length} inmates in custody · ${S.queue.length} pending admission · ${S.released.length} released records. Click a row to open the inmate's permanent record.</p>` +
    tbl('inm', S.inm, cols, {
      row: 'inmate', rowArg: i => i.id, sort: 0, empty: 'No inmates yet. Start the clock — intake runs daily at 08:00.',
      filters: [
        { l: 'Class', opts: CLASSES, fn: (i, v) => i.cls === v },
        { l: 'Status', opts: ['Good', 'Warning', 'Restricted', 'Solitary', 'Infirmary', 'Hearing due'], fn: (i, v) => v === 'Infirmary' ? i.infirm : v === 'Hearing due' ? !!i.hearing : i.disc === v },
        { l: 'Work', opts: ['Employed', 'Unemployed', 'In a program', 'Idle'], fn: (i, v) => v === 'Employed' ? !!i.job : v === 'Unemployed' ? !i.job : v === 'In a program' ? !!i.prog : !i.job && !i.prog },
        { l: 'Block', opts: S.blocks.map(b => b.name), fn: (i, v) => { const b = getBlock(i.blk); return b && b.name === v; } }
      ]
    }) + `<div class="card mt"><h3>Released & transferred</h3>${tbl('rel', S.released, [
      { l: 'ID', v: r => r.id, h: r => `<span class="mono">${r.id}</span>` }, { l: 'Name', v: r => r.name }, { l: 'Class', v: r => r.cls, h: r => tag(r.cls) },
      { l: 'Admitted', v: r => r.adm, h: r => 'D' + r.adm }, { l: 'Left', v: r => r.out, h: r => 'D' + r.out }, { l: 'Reason', v: r => r.why, h: r => `<span class="${r.why === 'Escaped' ? 'bad' : r.why === 'Paroled' ? 'good' : ''}">${r.why}</span>` },
      { l: 'Served', v: r => r.served, r: 1, h: r => `${r.served}/${r.sent}d` }, { l: 'Certificates', v: r => r.certs, r: 1 }, { l: 'Incidents', v: r => r.incidents, r: 1 }
    ], { per: 10, empty: 'No releases yet.' })}</div>`;
};

function openInmate(id) {
  let i = getInm(id); let queued = false;
  if (!i) { i = S.queue.find(x => x.id === id); queued = !!i; }
  if (!i) { const r = S.released.find(x => x.id === id); if (r) openModal(`<h2>${esc(r.name)} <span class="mono mut">${r.id}</span></h2><p class="mut">This inmate left custody on Day ${r.out} (${r.why}). Served ${r.served} of ${r.sent} days, earned ${r.certs} certificates, ${r.incidents} incidents on record.</p>`, true); return; }
  UI.prof = id; renderProfile(i, queued);
}
function renderProfile(i, queued) {
  const tabs = ['Overview', 'Needs', 'Work & programs', 'Account', 'Relationships', 'History'];
  const T = UI.profTab;
  let h = `<div class="spread" style="padding-right:30px"><div><h2 style="margin:0">${esc(iname(i))} <span class="mono mut">${i.id}</span></h2>
    <div class="small mut">${tag(i.cls)} ${CLS_LABEL[i.cls]} · ${i.g} · Age ${i.age} · ${queued ? '<span class="warn">Pending intake</span>' : esc(cellLabel(i))} · ${esc(i.loc)}</div></div></div>`;
  h += `<div class="tabs">${tabs.map(t => `<button class="${t === T ? 'on' : ''}" data-a="ptab" data-arg="${t}">${t}</button>`).join('')}</div>`;
  if (T === 'Overview') {
    const incs = S.inc.filter(x => x.who === i.id || x.others.includes(i.id));
    h += `<div class="grid g2"><div><h3>Identification</h3><div class="kv">
      <div>Inmate ID</div><div class="mono">${i.id}</div><div>Name</div><div>${esc(iname(i))}</div><div>Age</div><div>${i.age}</div><div>Gender</div><div>${i.g}</div>
      <div>Admitted</div><div>Day ${i.adm}</div><div>Location</div><div>${esc(i.loc)}</div></div>
      <h3 class="mt">Criminal history</h3><div class="kv">
      <div>Charges</div><div style="white-space:normal">${i.charges.map(esc).join('<br>')}</div><div>Offense severity</div><div>${SEV_LABEL[i.sev]} (${i.sev}/5)</div>
      <div>Prior convictions</div><div>${i.priors}</div><div>Sentence</div><div>${sentenceStr(i)}</div><div>Time served</div><div>${served(i)} days</div>
      ${i.appeal ? `<div>Appeal stage</div><div>${i.appeal.exec ? `<span class="bad">Execution scheduled Day ${i.appeal.exec}</span>` : `${APPEAL_STAGES[i.appeal.stage]} — hearing Day ${i.appeal.next}`}</div><div>Appeal odds</div><div>${Math.round(appealOdds(i) * 100)}% at this stage</div>` : `<div>Remaining</div><div>${remaining(i)} days (release Day ${i.release})</div><div>Parole eligibility</div><div>Day ${i.parole}${i.hearing ? ' — <span class="warn">hearing due</span>' : ''}</div>
      <div>Parole outlook</div><div>${paroleScore(i)}/100</div>`}</div>
      ${i.appeal && i.appeal.log.length ? `<h3 class="mt">Appeal record</h3>${i.appeal.log.map(x => `<div class="small">Day ${x.d}: ${esc(x.x)}</div>`).join('')}` : ''}</div>
      <div><h3>Security</h3><div class="kv">
      <div>Classification</div><div>${tag(i.cls)} ${CLS_LABEL[i.cls]}</div>${i.pc ? `<div>PC reason</div><div class="info">${esc(i.pc)}</div>` : ''}${i.dx ? `<div>Diagnosis</div><div class="info">${esc(i.dx)}</div><div>Psychiatric stability</div><div>${Math.round(i.psych)}/100 ${i.psych < 35 ? '<span class="bad">unstable</span>' : i.psych < 55 ? '<span class="warn">fragile</span>' : '<span class="good">stable</span>'}</div>` : ''}${i.pcRequest ? `<div>PC request</div><div class="warn">${esc(i.pcRequest.why)} (Day ${i.pcRequest.d})</div>` : ''}<div>Block / cell</div><div>${esc(cellLabel(i))}</div><div>Risk</div><div>${i.risk}</div>
      <div>Behavior score</div><div>${Math.round(i.beh)}/100</div><div>Disciplinary</div><div>${i.disc}${i.discUntil > curDay() ? ` until Day ${i.discUntil}` : ''}</div>
      <div>Incidents</div><div>${i.incCount}</div><div>Personality</div><div>${i.traits.join(', ')}</div><div>Affiliation</div><div>${i.gang || 'None known'}</div></div>`;
    if (!queued) {
      const spots = [];
      S.blocks.filter(b => b.cls === i.cls && (b.status === 'Open' || b.status === 'Lockdown')).forEach(b => b.cells.forEach(c => { if (c.occ.length < c.beds && !(b.id === i.blk && c.n === i.cell)) spots.push([b.id + ':' + c.n, `${b.name} · Cell ${c.n} (${c.occ.length}/${c.beds})`]); }));
      h += `<h3 class="mt">Actions</h3>
        <div class="field"><label class="f">Move to cell</label><div class="row">${spots.length ? sel('pMoveSel', '', [['', 'Choose a free bed…']].concat(spots.slice(0, 300))) : '<span class="small mut">No free beds in this classification.</span>'}</div></div>
        ${!['Protective', 'DeathRow', 'Insane'].includes(i.cls) && S.unlock.classes.includes('Protective') ? `<div class="field"><label class="f">Protective custody</label><div class="row">${btn('Transfer to protective custody', 'pcApprove', i.id, 'sm')}<span class="tiny dim">${freeBeds('Protective')} PC beds free</span></div></div>` : ''}
        <div class="field"><label class="f">Reclassify</label><div class="row">${sel('pReclass', i.cls, S.unlock.classes.map(c => [c, CLS_LABEL[c]]))}<span class="tiny dim">Moves to a free bed in the new classification.</span></div></div>
        <div class="field"><label class="f">Disciplinary sanction</label><div class="row">${sel('pSanctionSel', UI.pSan || 'Verbal warning', Object.keys(SANCTIONS).filter(s => s !== 'Dismiss'))}${btn('Apply', 'pSanction', i.id, 'sm')}</div></div>`;
    }
    h += `</div></div>`;
    if (incs.length) h += `<h3 class="mt">Incident record</h3><div class="twrap"><table><tbody>${incs.slice(0, 12).map(x => `<tr><td class="mono small">${x.id}</td><td>${stamp(x.t)}</td><td>${x.type}</td><td>${x.sev === 'Positive' ? '<span class="good">Positive</span>' : sevTag(x.sev)}</td><td>${esc(x.action || 'Open')}</td></tr>`).join('')}</tbody></table></div>`;
  } else if (T === 'Needs') {
    h += `<div class="grid g2"><div>${needBarsOne(i)}</div><div class="small mut"><p>Satisfaction: <b class="mono" style="color:var(--txt)">${Math.round(satisfaction(i))}</b></p><p>Needs change each hour based on the regime for ${i.cls} inmates, cell quality (Tier ${getBlock(i.blk) ? getBlock(i.blk).tier : '—'}), meals, staffing and relationships.</p><p>Low needs raise stress; high stress and low safety raise the chance of incidents.</p></div></div>`;
  } else if (T === 'Work & programs') {
    const jobOpts = [['', 'No job']].concat(JOB_NAMES.filter(j => (jobEligible(i, j) && jobFilled(j) < S.jobs[j].pos) || i.job === j).map(j => [j, `${j} (${jobFilled(j)}/${S.jobs[j].pos})`]));
    const progOpts = [['', 'Not enrolled']].concat(PROG_NAMES.filter(p => (progEligible(i, p) && progEnrolled(p) < S.progs[p].cap) || i.prog === p).map(p => [p, `${p} (${progEnrolled(p)}/${S.progs[p].cap})`]));
    h += `<div class="grid g2"><div><h3>Employment</h3>${queued ? '<p class="mut small">Available after admission.</p>' : `<div class="field">${sel('pJob', i.job || '', jobOpts)}</div>`}
      <div class="kv"><div>Current position</div><div>${i.job || '—'}</div><div>Department</div><div>${i.job ? (i.job === 'Kitchen' ? 'Food Services' : i.job === 'Workshop' ? 'Industries' : 'Facilities') : '—'}</div><div>Started</div><div>${i.job ? 'Day ' + i.jobSince : '—'}</div><div>Wage</div><div>${i.job ? '$' + S.jobs[i.job].wage.toFixed(2) + '/hr' : '—'}</div><div>Total earnings</div><div>${fmt$(i.earn)}</div></div>
      <h3 class="mt">Employment history</h3>${i.jobHist.length ? i.jobHist.map(j => `<div class="small">${j.j}: Day ${j.start} – ${j.end ? 'Day ' + j.end : 'present'}</div>`).join('') : '<div class="small mut">None</div>'}</div>
      <div><h3>Rehabilitation</h3>${queued ? '' : `<div class="field">${sel('pProg', i.prog || '', progOpts)}</div>`}
      ${i.prog ? `<div class="small">${i.prog}: ${Math.round(i.progHrs)}/${PROGRAMS[i.prog].hrs} hours</div>${bar(i.progHrs / PROGRAMS[i.prog].hrs * 100)}<div class="tiny dim mt6">Enrolled Day ${i.progStart}. Attends during Rehabilitation periods in the regime.</div>` : ''}
      <h3 class="mt">Certificates</h3>${i.certs.length ? i.certs.map(c => `<div class="small good">✓ ${PROGRAMS[c].cert}</div>`).join('') : '<div class="small mut">None yet</div>'}
      <h3 class="mt">Program history</h3>${i.progHist.length ? i.progHist.map(p => `<div class="small">${p.p}: ${p.done ? '<span class="good">Completed</span>' : 'Withdrew'} · ${p.hrs}h · Day ${p.start}–${p.end}</div>`).join('') : '<div class="small mut">None</div>'}</div></div>`;
  } else if (T === 'Account') {
    h += `<div class="grid g2"><div class="kv"><div>Current balance</div><div class="mono">${fmt$(i.bal)}</div><div>Job earnings (total)</div><div class="mono">${fmt$(i.earn)}</div></div>
      <div><h3>Financial history</h3>${i.tx.length ? `<div class="twrap"><table><tbody>${i.tx.map(t => `<tr><td>Day ${t.d}</td><td>${esc(t.x)}</td><td class="right mono ${t.a < 0 ? 'bad' : 'good'}">${t.a < 0 ? '-' : '+'}$${Math.abs(t.a).toFixed(2)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="small mut">No deposits or purchases yet. Wages are credited hourly while working.</div>'}</div></div>`;
  } else if (T === 'Relationships') {
    const show = (ids, cls) => ids.length ? ids.map(id => { const x = getInm(id); return x ? `<div class="small ${cls}">${inmLink(x.id, iname(x))} <span class="dim">· ${x.id} · ${esc(cellLabel(x))}${x.gang ? ' · ' + x.gang : ''}</span></div>` : ''; }).join('') : '<div class="small mut">None</div>';
    h += `<div class="grid g2"><div><h3>Friendships & alliances</h3>${show(i.friends, 'good')}</div><div><h3>Rivalries</h3>${show(i.rivals, 'bad')}</div></div>
      <h3 class="mt">Group affiliation</h3><div class="small">${i.gang ? `${i.gang} — ${S.inm.filter(x => x.gang === i.gang).length} known members in custody` : 'None known'}</div>
      <p class="tiny dim mt">Rivals housed in the same block lower safety and raise the chance of fights. Move one to another block to separate them.</p>`;
  } else if (T === 'History') {
    h += i.hist.map(x => `<div class="note"><div class="t">${stamp(x.t)}</div><div class="m">${esc(x.x)}</div></div>`).join('');
  }
  openModal(h);
}
A.inmate = id => { UI.profTab = 'Overview'; openInmate(id); };
A.ptab = t => { UI.profTab = t; openInmate(UI.prof); };
C.pMoveSel = v => { if (!v) return; const i = getInm(UI.prof); const [bid, n] = v.split(':'); const b = getBlock(bid); const c = b && b.cells.find(c => c.n === +n); if (i && c && c.occ.length < c.beds) { place(i, b, c); ihist(i, `Moved to ${cellLabel(i)}.`); dirty(); toast('good', `${iname(i)} moved to ${cellLabel(i)}.`); } openInmate(UI.prof); };
C.pReclass = v => { const i = getInm(UI.prof); if (!i || v === i.cls) return; if (v === 'DeathRow' || (i.cls === 'DeathRow' && !i.commuted)) { toast('bad', 'Death sentences are set by the courts — inmates cannot be moved on or off death row administratively.'); openInmate(UI.prof); return; } if (v === 'Insane' && i.psych == null) { i.psych = 40; i.dx = pick(INSANE_DX); } const spot = findBed(v); if (!spot) { toast('bad', `No free ${v} beds. Build or expand a ${v} block first.`); openInmate(UI.prof); return; } const old = i.cls; i.cls = v; place(i, spot.b, spot.c); i.parole = i.start + Math.ceil(i.sent * PAROLE_FRAC[v]); ihist(i, `Reclassified ${old} → ${v}. Moved to ${cellLabel(i)}.`); if (i.job && !jobEligible(i, i.job)) setJob(i, null); dirty(); openInmate(UI.prof); };
C.pSanctionSel = v => { UI.pSan = v; };
A.pSanction = id => { const i = getInm(id); if (!i) return; const s = UI.pSan || 'Verbal warning'; const inc = incident(i, 'Administrative sanction', `Sanction issued by administration: ${s}.`, 'Minor', getBlock(i.blk)); applySanction(inc, s); dirty(); toast('info', `${s} applied to ${iname(i)}.`); openInmate(id); };
C.pJob = v => { const i = getInm(UI.prof); if (!i) return; setJob(i, v || null); dirty(); openInmate(UI.prof); };
C.pProg = v => { const i = getInm(UI.prof); if (!i) return; setProg(i, v || null); dirty(); openInmate(UI.prof); };

/* ---------- Intake ---------- */
V.intake = () => {
  const T = curHour() >= 8 ? S.today.intake : (S.yday ? S.yday.intake : S.today.intake);
  const recv = sum(Object.values(T.recv));
  const cls = CLASSES.filter(c => S.unlock.classes.includes(c));
  let h = `<h1>Intake</h1><p class="sub">Inmates arrive automatically at 08:00 each day. Each is given an ID, identity, charges and sentence, classified, and assigned to an appropriate free bed. Overcrowding is never allowed.</p>`;
  h += `<div class="grid g2 mb"><div class="card"><h3>Daily intake allowance</h3>
    <div class="field">${chk('intakeOn', S.settings.intakeOn, 'Automatic intake enabled')}</div>
    <div class="twrap"><table><thead><tr><th>Classification</th><th class="right">Per day</th><th class="right">Free beds</th></tr></thead><tbody>
    ${cls.map(c => `<tr><td>${tag(c)} ${CLS_LABEL[c]}</td><td class="right">${num('intakeN', S.settings.intake[c], c, 0, 100, .1)}</td><td class="right mono">${freeBeds(c)}</td></tr>`).join('')}
    </tbody></table></div>
    <div class="field mt"><label class="f">When no suitable bed is available</label>${seg('overflow', S.settings.overflow, [['queue', 'Hold in pending queue'], ['reject', 'Redirect to other facilities']])}</div>
    <div class="row small mut">Queue limit ${num('queueMax', S.settings.queueMax, '', 0, 500, 1, 70)} · transfer after ${num('queueDays', S.settings.queueDays, '', 1, 30, 1, 60)} days waiting</div>
    <div class="tiny dim mt6">Decimals mean a chance per day: 0.2 = one admission roughly every five days.</div>
    <div class="alert info mt">Processing capacity: <b>${intakeCapacity()}</b> admissions/day (15 base + 25 per Administrator present). Total requested: ${sum(cls, c => S.settings.intake[c])}/day.</div></div>
    <div class="card"><h3>${curHour() >= 8 ? "Today's" : "Yesterday's"} intake summary</h3>
    <div class="grid g2"><div>${kpi('Received', recv)}</div><div>${kpi('Pending queue', S.queue.length)}</div></div>
    <div class="kv mt">${cls.map(c => `<div>${c}</div><div class="mono">${T.recv[c] || 0}</div>`).join('')}
      <div>Admitted from queue</div><div class="mono">${T.fromQueue}</div><div>Placed in queue</div><div class="mono">${T.queued}</div>
      <div>Redirected</div><div class="mono">${T.rejected}</div><div>Transferred out</div><div class="mono">${(S.today.intake.transferred || 0)}</div>
      <div>Beds remaining</div><div class="mono">${cls.map(c => CLS_SHORT[c] + ' ' + freeBeds(c)).join(' · ')}</div></div>
    ${T.limited.length ? `<div class="alert mt">Limitations: ${T.limited.map(x => x === 'processing' ? 'processing capacity reached' : `no ${x} beds`).join(', ')}.</div>` : ''}</div></div>`;
  h += `<div class="card mb"><h3>Pending intake queue</h3>${tbl('queue', S.queue, [
    { l: 'ID', v: i => i.id, h: i => `<span class="mono">${i.id}</span>` }, { l: 'Name', v: i => iname(i) }, { l: 'Class', v: i => i.cls, h: i => tag(i.cls) },
    { l: 'Charges', v: i => i.charges[0] }, { l: 'Sentence', v: i => i.sent, r: 1, h: i => i.sent + 'd' }, { l: 'Waiting', v: i => curDay() - i.queued, r: 1, h: i => `${curDay() - i.queued}d` }
  ], { row: 'inmate', rowArg: i => i.id, per: 10, empty: 'Queue is empty.' })}</div>`;
  const arr = S.arrivals.map(getInm).filter(Boolean);
  h += `<div class="card"><h3>Recent admissions</h3>${tbl('arr', arr, [
    { l: 'ID', v: i => i.id, h: i => `<span class="mono">${i.id}</span>` }, { l: 'Name', v: i => iname(i) }, { l: 'Class', v: i => i.cls, h: i => tag(i.cls) },
    { l: 'Admitted', v: i => i.adm, h: i => 'Day ' + i.adm }, { l: 'Assigned', v: i => cellLabel(i) }, { l: 'Charges', v: i => i.charges.join(', ') }, { l: 'Risk', v: i => i.risk }
  ], { row: 'inmate', rowArg: i => i.id, per: 10, search: false, empty: 'No admissions yet.' })}</div>`;
  return h;
};
C.intakeOn = (v, el) => { S.settings.intakeOn = el.checked; dirty(); };
C.intakeN = (v, el, c) => { S.settings.intake[c] = Math.round(clamp(parseFloat(v) || 0, 0, 100) * 10) / 10; dirty(); };
C.queueMax = v => { S.settings.queueMax = clamp(parseInt(v) || 0, 0, 500); dirty(); };
C.queueDays = v => { S.settings.queueDays = clamp(parseInt(v) || 1, 1, 30); dirty(); };

/* ---------- Housing ---------- */
V.housing = () => {
  const cls = S.unlock.classes;
  let h = `<h1>Housing</h1><p class="sub">Capacity is the number of approved, usable beds. Total: ${totalCapacity()} beds, ${S.inm.length} occupied.</p>`;
  h += `<div class="grid g4 mb">${CLASSES.filter(c => cls.includes(c) || totalCapacity(c)).map(c => kpi(CLS_LABEL[c], `${S.inm.filter(i => i.cls === c).length}<span class="mut small"> / ${totalCapacity(c)}</span>`, `${freeBeds(c)} free beds`)).join('')}</div>`;
  h += `<div class="blocks mb">`;
  for (const b of S.blocks) {
    const cap = blockCap(b), occ = blockOcc(b);
    const offD = S.staff.filter(s => s.assign === b.id && s.shift === 'Day').length, offN = S.staff.filter(s => s.assign === b.id && s.shift === 'Night').length;
    const cov = computeCoverage(shiftOf(curHour()))[b.id];
    h += `<div class="card"><div class="spread"><div><b>${esc(b.name)}</b> ${tag(b.cls)}</div><span class="small ${b.status === 'Open' ? 'good' : b.status === 'Lockdown' ? 'bad' : 'warn'}">${b.status}${b.status === 'Construction' ? ` (${b.buildLeft}d)` : ''}</span></div>
      <div class="small mut mt6">Tier ${b.tier} · ${TIERS[b.tier].name} · ${b.cells.length} cells × ${b.cells[0] ? b.cells[0].beds : 0} bed${b.cells[0] && b.cells[0].beds > 1 ? 's' : ''}${b.upgrade ? ` · <span class="warn">upgrading to Tier ${b.upgrade.to} (${b.upgrade.left}d)</span>` : ''}</div>
      <div class="row mt6" style="flex-wrap:nowrap"><div class="grow">${bar(cap ? occ / cap * 100 : 0)}</div><span class="mono small">${occ}/${cap}</span></div>
      ${b.cells.length <= 160 ? `<div class="cells">${b.cells.map(c => `<div class="cell ${c.occ.length >= c.beds ? 'f' : c.occ.length ? 'p' : ''}" title="Cell ${c.n}: ${c.occ.length}/${c.beds}"></div>`).join('')}</div>` : ''}
      <div class="kv small mt"><div>Officers</div><div>${offD} day · ${offN} night${occ ? ` · coverage ${cov != null ? pct(Math.min(1, cov)) : '—'}` : ''}</div>
      <div>Contraband level</div><div>${Math.round(b.contraband)}</div><div>Incident heat</div><div>${b.incidents.toFixed(1)}</div>
      <div>Daily utilities</div><div>${fmt$(cap * TIERS[b.tier].util)}</div></div>
      <div class="row mt">${btn('Cells', 'cells', b.id, 'sm')}${b.status !== 'Construction' ? btn(b.status === 'Lockdown' ? 'Lift lockdown' : 'Lockdown', 'lockdown', b.id, 'sm' + (b.status === 'Lockdown' ? ' pri' : '')) : ''}
      ${b.tier < (S.unlock.tier3 ? 3 : 2) && !b.upgrade && b.status !== 'Construction' ? btn(`Upgrade to T${b.tier + 1} (${fmt$(upgradeCost(b))})`, 'upgrade', b.id, 'sm') : ''}
      ${btn('Rename', 'renameBlock', b.id, 'sm')}${b.status !== 'Construction' ? btn(b.status === 'Closed' ? 'Reopen' : 'Close', 'closeBlock', b.id, 'sm') : ''}</div></div>`;
  }
  h += `</div>`;
  h += `<div class="card mb"><div class="spread"><div><h3 style="margin:0">Exercise yards</h3><div class="small mut mt6">${S.yards} yard${S.yards === 1 ? '' : 's'} · ${S.yards * YARD_CAP} inmates at once · weather today: ${S.weather}</div></div>${btn(`Build yard (${fmt$(YARD_COST)})`, 'buildYard', null, 'pri')}</div>
    <div class="small mt6">Peak yard use: ${(() => { let m = 0, at = 0; for (let hr = 0; hr < 24; hr++) { const u = S.inm.filter(i => S.sched[i.cls][hr] === 'Yard').length; if (u > m) { m = u; at = hr; } } return m ? `${m} inmates at ${String(at).padStart(2, '0')}:00` : 'no yard time scheduled'; })()}. Yards cost $150/day each to maintain.</div></div>`;
  const f = UI.build = UI.build || { name: nextBlockName(), cls: cls[0], tier: 1, cells: 20, beds: BEDS_PER_CELL[cls[0]] };
  if (!cls.includes(f.cls)) f.cls = cls[0];
  h += `<div class="card"><h3>Build a new cell block</h3><div class="grid g4">
    <div class="field"><label class="f">Name</label><input type="text" data-c="bName" value="${esc(f.name)}" style="width:100%"></div>
    <div class="field"><label class="f">Classification</label>${sel('bCls', f.cls, cls.map(c => [c, CLS_LABEL[c]]))}</div>
    <div class="field"><label class="f">Cell tier</label>${sel('bTier', f.tier, [[1, 'Tier 1 – Basic'], [2, 'Tier 2 – Standard']].concat(S.unlock.tier3 ? [[3, 'Tier 3 – Premium']] : []))}</div>
    <div class="field"><label class="f">Cells × beds per cell</label><div class="row" style="flex-wrap:nowrap">${num('bCells', f.cells, '', 1, 200, 1, 70)} × ${sel('bBeds', f.beds, [[1, '1'], [2, '2'], [4, '4 (dorm)']])}</div></div></div>
    <div class="spread"><div class="small mut" id="buildInfo">${buildInfo()}</div>${btn('Build block', 'build', null, 'pri')}</div>
    <div class="tiny dim mt6">${Object.entries(TIERS).map(([k, t]) => `Tier ${k}: ${t.desc}`).join(' · ')}. Construction takes 2 days. ${S.mode === 'career' && !S.unlock.tier3 ? 'Tier 3 unlocks through career objectives.' : ''}</div></div>`;
  return h;
};
function nextBlockName() { let k = 0; while (S.blocks.some(b => b.name === String.fromCharCode(65 + k) + ' Block')) k++; return String.fromCharCode(65 + Math.min(k, 25)) + ' Block'; }
function buildCost(f) { return f.cells * (CELL_BASE_COST[f.cls] * (f.beds === 1 ? 1 : f.beds === 2 ? 1.5 : 2.4) + TIERS[f.tier].cellCost) + 15000; }
function buildInfo() { const f = UI.build; const c = buildCost(f); return `${f.cells * f.beds} beds · Cost <b class="${c > S.money ? 'bad' : ''}">${fmt$(c)}</b> · Utilities ${fmt$(f.cells * f.beds * TIERS[f.tier].util)}/day · Needs ~${Math.ceil(f.cells * f.beds / OFFICER_RATIO[f.cls] * 1.5)} officers`; }
function upgradeCost(b) { return b.cells.length * (TIERS[b.tier + 1].cellCost - TIERS[b.tier].cellCost) * 1.2 + 5000; }
const updBuild = () => { const el = $('#buildInfo'); if (el) el.innerHTML = buildInfo(); };
C.bName = v => { UI.build.name = v.slice(0, 30); };
C.bCls = v => { UI.build.cls = v; UI.build.beds = BEDS_PER_CELL[v]; render(); };
C.bTier = v => { UI.build.tier = +v; updBuild(); };
C.bCells = v => { UI.build.cells = clamp(parseInt(v) || 1, 1, 200); updBuild(); };
C.bBeds = v => { UI.build.beds = +v; updBuild(); };
A.build = () => {
  const f = UI.build; const cost = buildCost(f);
  if (!f.name.trim()) return toast('bad', 'Give the block a name.');
  if (cost > S.money) return toast('bad', `Not enough funds: ${fmt$(cost)} needed.`);
  confirmBox('Build cell block', `Build <b>${esc(f.name)}</b> (${f.cls}, Tier ${f.tier}, ${f.cells * f.beds} beds) for <b>${fmt$(cost)}</b>? Construction takes 2 days.`, 'Build', () => {
    addBlock(f.name.trim(), f.cls, f.cells, f.beds, f.tier, false);
    money(-cost, 'Construction', `Construct ${f.name} (${f.cells * f.beds} beds)`);
    S.stats.blocksBuilt++; note('info', `Construction started on ${f.name}.`); UI.build = null; dirty(); render();
  });
};
A.buildYard = () => { if (S.money < YARD_COST) return toast('bad', `Not enough funds: ${fmt$(YARD_COST)} needed.`); confirmBox('Build exercise yard', `Build another outdoor exercise yard for ${fmt$(YARD_COST)}? It adds room for ${YARD_CAP} inmates at a time.`, 'Build', () => { money(-YARD_COST, 'Construction', 'Exercise yard'); S.yards++; note('good', `New exercise yard opened. Yard capacity is now ${S.yards * YARD_CAP}.`); dirty(); render(); }); };
A.lockdown = id => { const b = getBlock(id); b.status = b.status === 'Lockdown' ? 'Open' : 'Lockdown'; note(b.status === 'Lockdown' ? 'warn' : 'info', `${b.name}: lockdown ${b.status === 'Lockdown' ? 'imposed' : 'lifted'}.`); if (b.status === 'Lockdown') { b.contraband = clamp(b.contraband - 10); b.incidents = Math.max(0, b.incidents - 2); } dirty(); render(); };
A.upgrade = id => { const b = getBlock(id); const c = upgradeCost(b); if (c > S.money) return toast('bad', `Not enough funds: ${fmt$(c)} needed.`); confirmBox('Upgrade cells', `Upgrade all ${b.cells.length} cells in ${esc(b.name)} to Tier ${b.tier + 1} (${TIERS[b.tier + 1].name}) for ${fmt$(c)}? Utilities rise to ${fmt$(blockCap(b) * TIERS[b.tier + 1].util)}/day. Takes 1 day.`, 'Upgrade', () => { money(-c, 'Construction', `Upgrade ${b.name} to Tier ${b.tier + 1}`); b.upgrade = { to: b.tier + 1, left: 1 }; dirty(); render(); }); };
A.renameBlock = id => { const b = getBlock(id); UI._rn = id; openModal(`<h2>Rename block</h2><input type="text" id="rnIn" value="${esc(b.name)}" style="width:100%"><div class="row mt" style="justify-content:flex-end">${btn('Cancel', 'closeModal')}${btn('Save', 'renameOk', null, 'pri')}</div>`, true); };
A.renameOk = () => { const v = $('#rnIn').value.trim().slice(0, 30); if (v) { getBlock(UI._rn).name = v; dirty(); } closeModal(); render(); };
A.closeBlock = id => { const b = getBlock(id); if (b.status === 'Closed') { b.status = 'Open'; render(); return; } if (blockOcc(b)) return toast('bad', 'Move all inmates out before closing a block.'); b.status = 'Closed'; S.staff.forEach(s => { if (s.assign === id) s.assign = null; }); dirty(); render(); };
A.cells = id => {
  const b = getBlock(id);
  let h = `<h2>${esc(b.name)} — cells</h2><p class="small mut">${b.cls} · Tier ${b.tier} · ${blockOcc(b)}/${blockCap(b)} beds occupied</p><div class="twrap"><table><thead><tr><th>Cell</th><th>Beds</th><th>Occupants</th></tr></thead><tbody>`;
  b.cells.forEach(c => { h += `<tr><td class="mono">${c.n}</td><td class="mono">${c.occ.length}/${c.beds}</td><td style="white-space:normal">${c.occ.map(id => { const i = getInm(id); return i ? inmLink(i.id, `${iname(i)} (${i.id})`) : id; }).join(', ') || '<span class="dim">Empty</span>'}</td></tr>`; });
  openModal(h + '</tbody></table></div>');
};

/* ---------- Security ---------- */
V.security = () => {
  const open = S.inc.filter(x => x.status === 'Open');
  const shift = shiftOf(curHour()); const covD = computeCoverage('Day'), covN = computeCoverage('Night');
  let h = `<h1>Security</h1><p class="sub">Incidents are generated from inmate personality, needs, relationships, staffing and conditions. Moderate and higher incidents may need a disciplinary decision.</p>`;
  h += `<div class="card mb"><h3>Incidents awaiting action (${open.length})</h3>${open.length ? `<div class="twrap"><table><thead><tr><th>ID</th><th>When</th><th>Severity</th><th>Type</th><th>Inmate</th><th>Details</th><th>Decision</th></tr></thead><tbody>
    ${open.map(x => `<tr><td class="mono small">${x.id}</td><td class="small">${stamp(x.t)}</td><td>${sevTag(x.sev)}</td><td>${x.type}</td><td>${x.who ? inmLink(x.who, x.whoName) : '—'}</td><td style="white-space:normal;min-width:220px" class="small">${esc(x.desc)}</td>
    <td><div class="row" style="flex-wrap:nowrap">${sel('incSel', UI['inc_' + x.id] || standardSanction(x), Object.keys(SANCTIONS), x.id)}${btn('Apply', 'incApply', x.id, 'sm pri')}</div></td></tr>`).join('')}</tbody></table></div>
    <div class="row mt">${btn('Apply standard sanctions to all', 'incAll', null, 'sm')}<span class="tiny dim">${Object.entries(SANCTIONS).map(([k, v]) => `${k}: ${v.d}`).join(' · ')}</span></div>` : '<div class="alert good">No incidents awaiting action.</div>'}</div>`;
  const pcr = S.inm.filter(i => i.pcRequest);
  if (pcr.length) h += `<div class="card mb"><h3>Protective custody requests (${pcr.length})</h3><div class="twrap"><table><thead><tr><th>Inmate</th><th>Class</th><th>Reason</th><th class="right">Safety</th><th class="right">Rivals in block</th><th>Requested</th><th></th></tr></thead><tbody>
    ${pcr.map(i => `<tr><td>${inmLink(i.id, iname(i))} <span class="mono tiny dim">${i.id}</span></td><td>${tag(i.cls)}</td><td style="white-space:normal">${esc(i.pcRequest.why)}</td><td class="right mono">${Math.round(i.n.safety)}</td><td class="right mono">${i.rivals.filter(r => { const x = getInm(r); return x && x.blk === i.blk; }).length}</td><td>Day ${i.pcRequest.d}</td><td><div class="row" style="flex-wrap:nowrap">${btn('Approve transfer', 'pcApprove', i.id, 'sm pri')}${btn('Deny', 'pcDeny', i.id, 'sm')}</div></td></tr>`).join('')}</tbody></table></div>
    <p class="tiny dim mt6">${freeBeds('Protective')} protective custody beds free. Unanswered requests expire after 5 days, and the inmate's stress rises.</p></div>`;
  h += `<div class="grid g2 mb"><div class="card"><h3>Security policies</h3>
    <div class="field"><label class="f">Automatic handling with standard sanctions</label>${seg('autoHandle', S.settings.autoHandle, [['minor', 'Minor only'], ['moderate', 'Minor + moderate'], ['all', 'All incidents']])}</div>
    <div class="field"><label class="f">Cell searches (cost per inmate per search: $2 daily / $4 weekly)</label>${seg('searches', S.settings.searches, [['off', 'Off'], ['weekly', 'Weekly (Mon)'], ['daily', 'Daily']])}</div>
    <div class="field"><label class="f">Visitor screening</label>${seg('screening', S.settings.screening, [['none', 'Minimal'], ['standard', 'Standard'], ['strict', 'Strict']])}</div>
    <p class="tiny dim">Searches reduce contraband (which raises incident risk) but add stress. Lockdowns can be set per block in Housing.</p></div>
    <div class="card"><h3>Last 7 days</h3>${(() => { const l = S.hist.slice(-7); const t = { Minor: 0, Moderate: 0, Major: 0, Critical: 0 }; l.forEach(x => { for (const k in t) t[k] += x.incidents[k]; }); return `<div class="grid g2">${Object.entries(t).map(([k, v]) => kpi(k, v, '', k === 'Critical' && v ? 'bad' : '')).join('')}</div><div class="small mut mt">Escapes: ${sum(l, x => x.escapes)} · Contraband finds: ${sum(l, x => x.contraband)} · Commendations: ${sum(l, x => x.positive)}</div>`; })()}</div></div>`;
  h += `<div class="card mb"><h3>Officer coverage by block (current shift: ${shift})</h3><div class="twrap"><table><thead><tr><th>Block</th><th>Class</th><th class="right">Inmates</th><th class="right">Day req/assigned</th><th class="right">Night req/assigned</th><th class="right">Coverage D / N</th><th>Status</th><th></th></tr></thead><tbody>
    ${S.blocks.filter(b => b.status !== 'Construction').map(b => `<tr><td>${esc(b.name)}</td><td>${tag(b.cls)}</td><td class="right mono">${blockOcc(b)}</td>
    <td class="right mono">${officersRequired(b, 'Day')} / ${S.staff.filter(s => s.assign === b.id && s.shift === 'Day').length}</td><td class="right mono">${officersRequired(b, 'Night')} / ${S.staff.filter(s => s.assign === b.id && s.shift === 'Night').length}</td>
    <td class="right mono ${Math.min(covD[b.id] || 0, covN[b.id] || 0) < .75 && blockOcc(b) ? 'warn' : ''}">${blockOcc(b) ? pct(Math.min(1, covD[b.id] || 0)) + ' / ' + pct(Math.min(1, covN[b.id] || 0)) : '—'}</td><td class="${b.status === 'Lockdown' ? 'bad' : ''}">${b.status}</td><td>${btn(b.status === 'Lockdown' ? 'Lift' : 'Lockdown', 'lockdown', b.id, 'sm')}</td></tr>`).join('')}
    </tbody></table></div><div class="row mt">${btn('Auto-assign officers', 'autoOff', null, 'sm')}<span class="tiny dim">Required officers: 1 per ${Object.entries(OFFICER_RATIO).map(([k, v]) => `${v} ${k}`).join(', ')} inmates on day shift; half that at night. Below 50% coverage, activities are cancelled.</span></div></div>`;
  h += `<div class="card"><h3>Incident log</h3>${tbl('incs', S.inc, [
    { l: 'ID', v: x => x.id, h: x => `<span class="mono small">${x.id}</span>` }, { l: 'When', v: x => x.t, h: x => `<span class="small">${stamp(x.t)}</span>` },
    { l: 'Severity', v: x => x.sev, s: x => ['Positive', 'Minor', 'Moderate', 'Major', 'Critical'].indexOf(x.sev), h: x => x.sev === 'Positive' ? '<span class="tag good">Positive</span>' : sevTag(x.sev) },
    { l: 'Type', v: x => x.type }, { l: 'Inmate', v: x => x.whoName, h: x => x.who ? inmLink(x.who, x.whoName) : '—' }, { l: 'Block', v: x => x.blkName },
    { l: 'Details', v: x => x.desc, h: x => `<span class="small" style="white-space:normal;display:inline-block;min-width:240px">${esc(x.desc)}</span>` }, { l: 'Outcome', v: x => x.action || 'Open' }
  ], { sort: 1, dir: -1, per: 15, empty: 'No incidents recorded yet.', filters: [
    { l: 'Severity', opts: ['Minor', 'Moderate', 'Major', 'Critical', 'Positive'], fn: (x, v) => x.sev === v },
    { l: 'Type', opts: ['Argument', 'Refusal to follow instructions', 'Fight', 'Property damage', 'Contraband', 'Assault on staff', 'Attempted escape', 'Escape', 'Assault on protective custody', 'Medical emergency', 'Staff shortage', 'Positive behavior', 'Administrative sanction'], fn: (x, v) => x.type === v },
    { l: 'Status', opts: ['Open', 'Closed', 'Recorded'], fn: (x, v) => x.status === v }] })}</div>`;
  return h;
};
A.pcApprove = id => { const i = getInm(id); if (!i) return; if (!S.unlock.classes.includes('Protective')) return toast('bad', 'Protective Custody is not unlocked yet.'); if (!transferToPC(i)) return toast('bad', 'No free Protective Custody beds. Build a PC unit in Housing.'); toast('good', `${iname(i)} moved to protective custody.`); dirty(); if (UI.prof) openInmate(id); else render(); };
A.pcDeny = id => { const i = getInm(id); if (!i) return; i.pcRequest = null; i.n.stress = clamp(i.n.stress + 8); ihist(i, 'Protective custody request denied.'); dirty(); render(); };
C.incSel = (v, el, id) => { UI['inc_' + id] = v; };
A.incApply = id => { const x = S.inc.find(x => x.id === id); if (!x || x.status !== 'Open') return; const s = UI['inc_' + id] || standardSanction(x); applySanction(x, s); dirty(); toast('info', `${x.id}: ${s}.`); render(); };
A.incAll = () => { S.inc.filter(x => x.status === 'Open').forEach(x => applySanction(x, standardSanction(x))); dirty(); render(); };
A.autoOff = () => { autoAssignOfficers(); dirty(); render(); };

/* ---------- Personnel ---------- */
V.personnel = () => {
  const req = requirements();
  let h = `<h1>Personnel</h1><p class="sub">${S.staff.length} employees · payroll ${fmt$(sum(S.staff, s => s.sal / 365))}/day. Staffing shortages reduce safety, service quality and capacity.</p>`;
  h += `<div class="grid g2 mb"><div class="card"><h3>Staffing requirements</h3><div class="twrap"><table><thead><tr><th>Role</th><th class="right">Employed</th><th class="right">Needed</th><th>Purpose</th></tr></thead><tbody>
    ${ROLE_NAMES.map(r => { const have = staffCount(r), need = req[r] || 0; return `<tr><td>${r}</td><td class="right mono ${have < need ? 'warn' : ''}">${have}</td><td class="right mono">${need}</td><td class="small mut" style="white-space:normal">${ROLE_HELP[r]}</td></tr>`; }).join('')}
    </tbody></table></div><div class="row mt">${btn('Auto-assign officers', 'autoOff', null, 'sm')}${btn('Hire to meet needs', 'hireNeeds', null, 'sm')}</div></div>
    <div class="card"><div class="spread"><h3>Job applicants</h3><span class="tiny dim">New applicants every 2 days · signing cost $500</span></div><div class="twrap"><table><thead><tr><th>Name</th><th>Role</th><th class="right">Exp</th><th class="right">Perf</th><th class="right">Salary</th><th></th></tr></thead><tbody>
    ${S.cands.map(c => `<tr><td>${esc(c.fn + ' ' + c.ln)}</td><td>${c.role}</td><td class="right mono">${c.exp}y</td><td class="right mono">${c.perf}</td><td class="right mono">${fmt$(c.sal)}</td><td>${btn('Hire', 'hire', c.id, 'sm pri')}</td></tr>`).join('') || '<tr><td colspan=6 class="mut">No applicants right now.</td></tr>'}
    </tbody></table></div>
    <div class="row mt">${sel('quickRole', UI.quickRole || 'Correctional Officer', ROLE_NAMES)}${btn('Advertise & hire', 'quickHire', null, 'sm')}<span class="tiny dim">Hires an entry-level candidate immediately ($1,500 recruitment)</span></div></div></div>`;
  const blockOpts = [['', 'Floating (unassigned)']].concat(S.blocks.filter(b => b.status !== 'Construction' && b.status !== 'Closed').map(b => [b.id, b.name]));
  h += `<div class="card">${tbl('staff', S.staff, [
    { l: 'ID', v: s => s.id, h: s => `<span class="mono">${s.id}</span>` }, { l: 'Name', v: s => s.fn + ' ' + s.ln }, { l: 'Position', v: s => s.role }, { l: 'Department', v: s => s.dept },
    { l: 'Salary', v: s => s.sal, r: 1, h: s => `<span class="mono">${fmt$(s.sal)}</span>` }, { l: 'Exp', v: s => s.exp, r: 1, h: s => s.exp + 'y' },
    { l: 'Performance', v: s => Math.round(s.perf), h: s => `<div class="row" style="gap:6px;flex-wrap:nowrap">${bar(s.perf)}<span class="mono small">${Math.round(s.perf)}</span></div>` },
    { l: 'Morale', v: s => Math.round(s.morale), r: 1 },
    { l: 'Shift', v: s => s.shift, ns: 1, h: s => sel('stShift', s.shift, [['Day', 'Day 06–18'], ['Night', 'Night 18–06']], s.id) },
    { l: 'Assignment', v: s => s.assign ? (getBlock(s.assign) || {}).name : '', ns: 1, h: s => s.role === 'Correctional Officer' ? sel('stAssign', s.assign || '', blockOpts, s.id) : `<span class="mut small">${s.dept}</span>` },
    { l: '', v: () => '', ns: 1, q: false, h: s => btn('Dismiss', 'fire', s.id, 'sm danger') }
  ], { sort: 2, per: 20, empty: 'No employees. Hire staff from the applicants above.', filters: [{ l: 'Role', opts: ROLE_NAMES, fn: (s, v) => s.role === v }, { l: 'Shift', opts: ['Day', 'Night'], fn: (s, v) => s.shift === v }] })}</div>`;
  return h;
};
const ROLE_HELP = {
  'Correctional Officer': 'Supervise blocks on day/night shifts', 'Warden': 'Boosts staff morale and attendance', 'Administrator': '+25 intake processing per day',
  'Medical Staff': 'Treat up to 6 patients/hour; 1 per 40 inmates', 'Psychologist': 'Runs Anger Management & Counseling', 'Teacher': 'Runs Education & Vocational Training',
  'Psychiatrist': 'Treats criminally insane & death row inmates; daily rounds stabilize 15 patients',
  'Kitchen Worker': 'Serves ~40 meals per sitting', 'Maintenance Worker': '1 per 75 beds; shortages raise costs', 'Rehabilitation Specialist': 'Runs Life Skills & Substance Recovery'
};
A.hire = id => { const c = S.cands.find(x => x.id === id); if (!c) return; if (S.money < 500) return toast('bad', 'Not enough funds.'); S.cands = S.cands.filter(x => x !== c); c.hired = curDay(); c.present = true; S.staff.push(c); money(-500, 'Administration', `Hire ${c.role} ${c.fn} ${c.ln}`); if (c.role === 'Correctional Officer') assignNewOfficer(c); note('info', `Hired ${c.role} ${c.fn} ${c.ln}.`); dirty(); render(); };
C.quickRole = v => { UI.quickRole = v; };
A.quickHire = () => { const r = UI.quickRole || 'Correctional Officer'; if (S.money < 1500) return toast('bad', 'Not enough funds.'); const s = genStaff(r, ri(0, 3)); S.staff.push(s); money(-1500, 'Administration', `Recruit ${r}`); if (r === 'Correctional Officer') assignNewOfficer(s); toast('good', `Hired ${r} ${s.fn} ${s.ln}.`); dirty(); render(); };
A.hireNeeds = () => {
  const req = requirements(); let n = 0, cost = 0;
  for (const r of ROLE_NAMES) { const gap = (req[r] || 0) - staffCount(r); for (let k = 0; k < gap; k++) { if (S.money - cost < 1500) break; const s = genStaff(r, ri(0, 4)); S.staff.push(s); cost += 1500; n++; if (r === 'Correctional Officer') assignNewOfficer(s); } }
  if (!n) return toast('info', 'Staffing already meets current requirements.');
  money(-cost, 'Administration', `Recruitment drive: ${n} hires`); toast('good', `Hired ${n} employees.`); dirty(); render();
};
function assignNewOfficer(o) {
  // put into the block/shift with the biggest deficit
  let best = null, gap = -99;
  for (const b of S.blocks.filter(b => b.status === 'Open' || b.status === 'Lockdown')) for (const sh of ['Day', 'Night']) {
    const basis = Math.max(blockOcc(b), blockCap(b)); let r = Math.ceil(basis / OFFICER_RATIO[b.cls]); if (sh === 'Night') r = Math.max(1, Math.ceil(r / 2));
    const g = r - S.staff.filter(s => s.assign === b.id && s.shift === sh && s !== o).length; if (g > gap) { gap = g; best = [b.id, sh]; }
  }
  if (best) { o.assign = best[0]; o.shift = best[1]; }
}
A.fire = id => { const s = S.staff.find(x => x.id === id); confirmBox('Dismiss employee', `Dismiss ${s.role} ${esc(s.fn + ' ' + s.ln)}? Severance is two weeks' salary (${fmt$(s.sal / 26)}).`, 'Dismiss', () => { S.staff = S.staff.filter(x => x !== s); money(-s.sal / 26, 'Payroll', `Severance ${s.fn} ${s.ln}`); dirty(); render(); }, true); };
C.stShift = (v, el, id) => { const s = S.staff.find(x => x.id === id); if (s) { s.shift = v; dirty(); } };
C.stAssign = (v, el, id) => { const s = S.staff.find(x => x.id === id); if (s) { s.assign = v || null; dirty(); } };

/* ---------- Regimes ---------- */
V.regimes = () => {
  const cls = S.unlock.classes;
  let h = `<h1>Regimes</h1><p class="sub">Daily schedules by security classification, hour by hour. Activities run only when staffing allows: below 50% officer coverage, out-of-cell activities are cancelled.</p>
    <div class="alert info">Yard: ${S.yards} exercise yard${S.yards === 1 ? '' : 's'} holding ${S.yards * YARD_CAP} inmates at once. Today's weather: <b>${S.weather}</b> (rain reduces yard benefits; storms move yard time indoors). Keep Protective Custody's yard time separate from everyone else. ${btn('Manage yards', 'nav', 'housing', 'sm')}</div>`;
  h += `<div class="row mb">${btn('Reset all to default', 'schedReset', null, 'sm')}${sel('schedCopyFrom', UI.copyFrom || cls[0], cls)}${btn('Copy to all classifications', 'schedCopy', null, 'sm')}
    <span class="tiny dim">Legend: ${ACT_NAMES.map(a => `<span class="dot" style="background:${ACTS[a].c}"></span>${ACTS[a].l}`).join(' &nbsp; ')}</span></div>`;
  h += `<div class="sched">`;
  for (const c of cls) {
    const s = S.sched[c]; const w = schedWarnings(c);
    h += `<div class="col"><div class="spread mb"><b>${tag(c)} ${CLS_LABEL[c]}</b><span class="tiny mut">${S.inm.filter(i => i.cls === c).length} inmates</span></div>
      ${s.map((a, hr) => `<div class="srow"><span class="mono small mut">${String(hr).padStart(2, '0')}:00</span><select data-c="sched" data-arg="${c}|${hr}" style="border-left-color:${ACTS[a].c}">${ACT_NAMES.map(x => `<option value="${x}"${x === a ? ' selected' : ''}>${ACTS[x].l}</option>`).join('')}</select></div>`).join('')}
      <div class="mt6">${w.map(x => `<div class="alert ${x[0]}" style="font-size:12px">${x[1]}</div>`).join('') || '<div class="alert good" style="font-size:12px">Schedule checks passed.</div>'}</div></div>`;
  }
  return h + `</div>`;
};
function schedWarnings(c) {
  const s = S.sched[c]; const n = a => s.filter(x => x === a).length; const out = [];
  const pop = S.inm.filter(i => i.cls === c).length;
  if (n('Meal') < 3) out.push(['bad', `Only ${n('Meal')} meal period${n('Meal') === 1 ? '' : 's'}. Inmates need 3 meals a day.`]);
  if (n('Meal') > 4) out.push(['warn', `${n('Meal')} meal periods will raise food costs.`]);
  if (n('Sleep') < 6) out.push(['warn', `Only ${n('Sleep')} hours of sleep — stress will rise.`]);
  if (!n('Shower')) out.push(['warn', 'No shower period: hygiene will fall.']);
  if (!n('Recreation') && !n('Free') && !n('Yard')) out.push(['warn', 'No yard, recreation or free time: recreation and social needs will collapse.']);
  if (!n('Yard')) out.push(['info', 'No yard time: inmates never go outdoors. Yard is the best activity for recreation and stress.']);
  s.forEach((a, hr) => { if (a !== 'Yard') return; const using = S.inm.filter(i => S.sched[i.cls][hr] === 'Yard').length; const cap = (S.yards || 0) * YARD_CAP; if (using > cap) out.push(['bad', `${String(hr).padStart(2, '0')}:00 yard: ${using} inmates scheduled, capacity ${cap}. Stagger times or build another yard.`]); if (c === 'Protective' && CLASSES.some(k => k !== 'Protective' && S.sched[k][hr] === 'Yard' && S.inm.some(i => i.cls === k))) out.push(['bad', `${String(hr).padStart(2, '0')}:00: Protective Custody shares the yard with general population — PC inmates will be attacked.`]); if (c !== 'Protective' && S.sched.Protective[hr] === 'Yard' && S.inm.some(i => i.cls === 'Protective') && pop) out.push(['bad', `${String(hr).padStart(2, '0')}:00: yard time overlaps with Protective Custody.`]); });
  if (n('Work')) { const posts = sum(JOB_NAMES.filter(j => S.unlock.jobs[j] && S.jobs[j].on && S.jobs[j].elig.includes(c)), j => S.jobs[j].pos); if (!posts) out.push(['warn', `Employment hours scheduled but no jobs accept ${c} inmates.`]); }
  if (n('Rehab')) { const progs = PROG_NAMES.filter(p => S.unlock.progs[p] && S.progs[p].on && S.progs[p].elig.includes(c)); const seats = sum(progs, progSeats); if (!seats) out.push(['warn', 'Rehabilitation hours scheduled but no program staff are available.']); else { const enr = S.inm.filter(i => i.prog && progs.includes(i.prog)).length; if (enr > seats) out.push(['info', `Program rooms: ${seats} seats/hour shared across classifications, ${enr} enrolled.`]); } }
  if (n('Visits') && !S.settings.visitDays.some(Boolean)) out.push(['info', 'Visitation scheduled but no visiting days are set (Visitors page).']);
  if (n('Meal') && pop) { const kc = kitchenCapacity(); let worst = 0; s.forEach((a, hr) => { if (a === 'Meal') worst = Math.max(worst, S.inm.filter(i => S.sched[i.cls][hr] === 'Meal').length); }); if (kc < worst) out.push(['bad', `Kitchen serves ${kc} per sitting but up to ${worst} inmates eat together at this classification's meal times. Stagger meals or add kitchen staff.`]); }
  return out;
}
C.sched = (v, el, arg) => { const [c, hr] = arg.split('|'); S.sched[c][+hr] = v; el.style.borderLeftColor = ACTS[v].c; dirty(); render(); };
C.schedCopyFrom = v => { UI.copyFrom = v; };
A.schedReset = () => { CLASSES.forEach(c => S.sched[c] = defaultSchedule(c)); dirty(); render(); };
A.schedCopy = () => { const f = UI.copyFrom || S.unlock.classes[0]; CLASSES.forEach(c => { if (c !== f) S.sched[c] = S.sched[f].slice(); }); dirty(); render(); };

/* ---------- Kitchen ---------- */
V.kitchen = () => {
  const use = dailyFoodUse(); const kc = kitchenCapacity(); const y = S.hist[S.hist.length - 1];
  const kw = staffCount('Kitchen Worker'), ki = jobFilled('Kitchen');
  // largest single sitting across hours
  let maxSit = 0; for (let h = 0; h < 24; h++) { const n = S.inm.filter(i => S.sched[i.cls][h] === 'Meal').length; if (n > maxSit) maxSit = n; }
  let h = `<h1>Kitchen & food services</h1><p class="sub">Food consumption scales with the number of inmates eating at each meal period. Kitchen capacity limits how many can be served per sitting.</p>`;
  h += `<div class="grid g4 mb">${kpi('Food inventory', fmtN(S.food), `${(S.food / Math.max(1, use)).toFixed(1)} days at ${fmtN(use)} meals/day`, S.food < use ? 'bad' : '')}
    ${kpi('Capacity per sitting', fmtN(kc), `Largest sitting: ${maxSit}`, kc < maxSit ? 'bad' : '')}${kpi('Meal cost', '$' + mealCost().toFixed(2), `${S.settings.mealQuality} quality`)}
    ${kpi('Yesterday', y ? fmtN(y.meals) : '—', y ? `${y.short} meals missed` : 'No data yet', y && y.short ? 'bad' : '')}</div>`;
  h += `<div class="grid g2 mb"><div class="card"><h3>Purchasing</h3>
    <div class="row mb">${btn(`+1 day (${fmtN(use)})`, 'buyFood', use, 'sm')}${btn(`+7 days (${fmtN(use * 7)})`, 'buyFood', use * 7, 'sm')}${btn('+500 meals', 'buyFood', 500, 'sm')}${btn('+2,000 meals', 'buyFood', 2000, 'sm')}</div>
    <div class="field">${chk('autoReorder', S.settings.autoReorder, 'Automatic reorder at midnight when below 2 days of stock')}</div>
    <div class="row small mut">Reorder up to ${sel('reorderDays', S.settings.reorderDays, [[3, '3 days'], [5, '5 days'], [7, '7 days'], [14, '14 days']])} of stock</div>
    <div class="field mt"><label class="f">Meal quality</label>${seg('mealQuality', S.settings.mealQuality, [['Basic', 'Basic $2.00'], ['Standard', 'Standard $2.80'], ['Quality', 'Quality $4.00']])}</div>
    <p class="tiny dim">Better meals satisfy hunger more and raise comfort. Basic meals save money but lower satisfaction.</p></div>
    <div class="card"><h3>Kitchen staffing</h3><div class="kv"><div>Kitchen workers</div><div>${kw} employed · ${staffCount('Kitchen Worker', true)} present (≈40 meals each)</div>
    <div>Inmate kitchen jobs</div><div>${ki} / ${S.jobs.Kitchen.pos} (15 meals each)</div><div>Total per sitting</div><div>${kc}</div>
    <div>Meal periods/day</div><div>${CLASSES.filter(c => S.unlock.classes.includes(c)).map(c => `${CLS_SHORT[c]} ${S.sched[c].filter(a => a === 'Meal').length}`).join(' · ')}</div>
    <div>Food cost/day</div><div>${fmt$(use * mealCost())}</div></div>
    ${kc < maxSit ? `<div class="alert bad mt">Kitchen cannot serve the largest sitting (${maxSit}). Hire kitchen workers, add inmate kitchen jobs, or stagger meal times between classifications in Regimes.</div>` : ''}</div></div>`;
  const hs = S.hist.slice(-30);
  h += `<div class="card"><h3>Meals served (30 days)</h3>${spark(hs.map(x => x.meals), 'var(--good)')}<div class="small mut mt6">Missed meals</div>${spark(hs.map(x => x.short), 'var(--bad)')}</div>`;
  return h;
};
A.buyFood = n => { n = +n; const c = n * mealCost(); if (c > S.money) return toast('bad', `Not enough funds (${fmt$(c)}).`); buyFood(n); toast('good', `Purchased ${fmtN(n)} meals for ${fmt$(c)}.`); dirty(); render(); };
C.autoReorder = (v, el) => { S.settings.autoReorder = el.checked; dirty(); };
C.reorderDays = v => { S.settings.reorderDays = +v; dirty(); };

/* ---------- Employment ---------- */
V.employment = () => {
  const emp = S.inm.filter(i => i.job);
  let h = `<h1>Inmate employment</h1><p class="sub">${emp.length} of ${S.inm.length} inmates employed. Work happens during Employment periods in the regime. Employment improves behavior, satisfaction and parole outcomes.</p>`;
  h += `<div class="card mb"><div class="twrap"><table><thead><tr><th>Job</th><th>Effect</th><th>Open</th><th class="right">Positions</th><th class="right">Filled</th><th class="right">Wage/hr</th><th>Eligible classifications</th></tr></thead><tbody>
    ${JOB_NAMES.map(j => { const c = S.jobs[j], lock = !S.unlock.jobs[j]; return `<tr${lock ? ' style="opacity:.5"' : ''}><td><b>${j}</b>${lock ? ' <span class="tiny warn">locked</span>' : ''}</td><td class="small mut" style="white-space:normal;min-width:180px">${JOBS[j].desc}</td>
      <td>${chk('jobOn', c.on, '', j, lock)}</td><td class="right">${num('jobPos', c.pos, j, 0, 200, 1, 64)}</td><td class="right mono">${jobFilled(j)}</td><td class="right">${num('jobWage', c.wage.toFixed(2), j, 0, 10, .05, 70)}</td>
      <td>${CLASSES.map(k => chk('jobElig', c.elig.includes(k), CLS_SHORT[k], j + '|' + k, lock)).join('')}</td></tr>`; }).join('')}
    </tbody></table></div><div class="row mt">${chk('autoJobs', S.settings.autoJobs, 'Automatically assign jobs to eligible inmates')}${btn('Fill open positions now', 'fillJobs', null, 'sm')}${btn('Unassign all', 'clearJobs', null, 'sm')}
    <span class="tiny dim">Wage bill yesterday: ${S.hist.length ? fmt$(S.hist[S.hist.length - 1].expBy['Inmate wages'] || 0) : '—'}</span></div></div>`;
  h += `<div class="card">${tbl('emp', emp, [
    { l: 'ID', v: i => i.id, h: i => `<span class="mono">${i.id}</span>` }, { l: 'Name', v: i => iname(i) }, { l: 'Class', v: i => i.cls, h: i => tag(i.cls) },
    { l: 'Job', v: i => i.job }, { l: 'Since', v: i => i.jobSince, h: i => 'Day ' + i.jobSince }, { l: 'Earnings', v: i => i.earn, r: 1, h: i => fmt$(i.earn) }, { l: 'Balance', v: i => i.bal, r: 1, h: i => fmt$(i.bal) }
  ], { row: 'inmate', rowArg: i => i.id, empty: 'No inmates employed yet.', filters: [{ l: 'Job', opts: JOB_NAMES, fn: (i, v) => i.job === v }] })}</div>`;
  return h;
};
C.jobOn = (v, el, j) => { S.jobs[j].on = el.checked; if (!el.checked) S.inm.filter(i => i.job === j).forEach(i => setJob(i, null)); dirty(); render(); };
C.jobPos = (v, el, j) => { S.jobs[j].pos = clamp(parseInt(v) || 0, 0, 200); S.inm.filter(i => i.job === j).slice(S.jobs[j].pos).forEach(i => setJob(i, null)); dirty(); render(); };
C.jobWage = (v, el, j) => { S.jobs[j].wage = clamp(parseFloat(v) || 0, 0, 10); dirty(); };
C.jobElig = (v, el, arg) => { const [j, k] = arg.split('|'); const e = S.jobs[j].elig; if (el.checked) { if (!e.includes(k)) e.push(k); } else { S.jobs[j].elig = e.filter(x => x !== k); S.inm.filter(i => i.job === j && i.cls === k).forEach(i => setJob(i, null)); } dirty(); };
C.autoJobs = (v, el) => { S.settings.autoJobs = el.checked; dirty(); };
A.fillJobs = () => { let n = 0; shuffle(S.inm.slice()).sort((a, b) => b.beh - a.beh).forEach(i => { if (tryAssignJob(i)) n++; }); toast('good', `${n} inmates assigned to jobs.`); dirty(); render(); };
A.clearJobs = () => { S.inm.filter(i => i.job).forEach(i => setJob(i, null)); dirty(); render(); };

/* ---------- Rehabilitation ---------- */
V.rehabilitation = () => {
  const enr = S.inm.filter(i => i.prog);
  const wait = S.inm.filter(i => !i.prog && i.progWant);
  let h = `<h1>Rehabilitation programs</h1><p class="sub">${enr.length} inmates enrolled · ${wait.length} on waitlists · ${S.stats.completions} programs completed. Sessions run during Rehabilitation periods; each staff member can teach a set number of inmates per hour.</p>`;
  h += `<div class="card mb"><div class="spread"><div><h3 style="margin:0">Who chooses programs?</h3><div class="small mut mt6">${S.settings.progChoice === 'admin' ? 'Administration places inmates in the program it thinks they need.' : 'Inmates apply for programs themselves, based on their personality, charges, stress and release date. If their first choice is full they join its waitlist (cooperative inmates may settle for a second choice). Rebellious inmates sometimes refuse or drop out.'}</div></div>${seg('progChoice', S.settings.progChoice || 'inmate', [['inmate', 'Inmates choose'], ['admin', 'Administration assigns']])}</div></div>`;
  h += `<div class="card mb"><div class="twrap"><table><thead><tr><th>Program</th><th>Run by</th><th class="right">Staff</th><th class="right">Seats/hr</th><th class="right">Enrolled</th><th class="right">Max enrol</th><th class="right">Hours</th><th class="right">Done</th><th>Open</th><th>Eligible</th></tr></thead><tbody>
    ${PROG_NAMES.map(p => { const P = PROGRAMS[p], c = S.progs[p], lock = !S.unlock.progs[p]; const seats = progSeats(p), e = progEnrolled(p); return `<tr${lock ? ' style="opacity:.5"' : ''}><td><b>${p}</b>${lock ? ' <span class="tiny warn">locked</span>' : ''}<div class="tiny dim">${P.cert}</div></td><td class="small">${P.role}</td><td class="right mono ${!staffCount(P.role) ? 'warn' : ''}">${staffCount(P.role)}</td>
      <td class="right mono">${seats}</td><td class="right mono ${e > seats ? 'warn' : ''}">${e}</td><td class="right">${num('progCap', c.cap, p, 0, 500, 1, 64)}</td><td class="right mono">${P.hrs}</td><td class="right mono">${c.completions}</td>
      <td>${chk('progOn', c.on, '', p, lock)}</td><td>${CLASSES.map(k => chk('progElig', c.elig.includes(k), CLS_SHORT[k], p + '|' + k, lock)).join('')}</td></tr>`; }).join('')}
    </tbody></table></div><div class="row mt">${chk('autoEnroll', S.settings.autoEnroll, 'Automatically enroll eligible inmates')}${btn('Enroll eligible inmates now', 'fillProgs', null, 'sm')}
    <span class="tiny dim">Completion earns a certificate, improves behavior, and strengthens the parole case. Anger Management can turn Aggressive inmates Calm.</span></div></div>`;
  h += `<div class="card">${tbl('enr', enr, [
    { l: 'ID', v: i => i.id, h: i => `<span class="mono">${i.id}</span>` }, { l: 'Name', v: i => iname(i) }, { l: 'Class', v: i => i.cls, h: i => tag(i.cls) }, { l: 'Program', v: i => i.prog },
    { l: 'Progress', v: i => i.progHrs / PROGRAMS[i.prog].hrs, h: i => `<div class="row" style="gap:6px;flex-wrap:nowrap">${bar(i.progHrs / PROGRAMS[i.prog].hrs * 100)}<span class="mono small">${Math.round(i.progHrs)}/${PROGRAMS[i.prog].hrs}h</span></div>` },
    { l: 'Enrolled', v: i => i.progStart, h: i => 'Day ' + i.progStart }, { l: 'Why', v: i => i.progWhy || '', h: i => `<span class="small mut">${esc(i.progWhy || '')}</span>` }, { l: 'Certificates', v: i => i.certs.length, r: 1 }
  ], { row: 'inmate', rowArg: i => i.id, empty: 'Nobody enrolled. Hire teachers, psychologists, psychiatrists or rehabilitation specialists, and schedule Rehabilitation periods.', filters: [{ l: 'Program', opts: PROG_NAMES, fn: (i, v) => i.prog === v }] })}</div>`;
  if (wait.length) h += `<div class="card mt"><h3>Waitlists</h3>${tbl('wait', wait, [
    { l: 'ID', v: i => i.id, h: i => `<span class="mono">${i.id}</span>` }, { l: 'Name', v: i => iname(i) }, { l: 'Class', v: i => i.cls, h: i => tag(i.cls) }, { l: 'Wants', v: i => i.progWant }, { l: 'Why', v: i => i.progWhy || '' },
    { l: '', v: () => '', ns: 1, q: false, h: i => btn('Enroll now', 'enrollWant', i.id, 'sm') }
  ], { row: 'inmate', rowArg: i => i.id, per: 10, filters: [{ l: 'Program', opts: PROG_NAMES, fn: (i, v) => i.progWant === v }] })}<p class="tiny dim mt6">Enrolling over capacity means some sessions will have more inmates than seats. Hire the staff shown in the table above to expand programs.</p></div>`;
  return h;
};
A.enrollWant = id => { const i = getInm(id); if (i && i.progWant) { setProg(i, i.progWant, `${i.progWhy} (placed by administration)`); dirty(); render(true); } };
C.progCap = (v, el, p) => { S.progs[p].cap = clamp(parseInt(v) || 0, 0, 500); dirty(); };
C.progOn = (v, el, p) => { S.progs[p].on = el.checked; if (!el.checked) S.inm.filter(i => i.prog === p).forEach(i => setProg(i, null)); dirty(); render(); };
C.progElig = (v, el, arg) => { const [p, k] = arg.split('|'); const e = S.progs[p].elig; if (el.checked) { if (!e.includes(k)) e.push(k); } else S.progs[p].elig = e.filter(x => x !== k); dirty(); };
C.autoEnroll = (v, el) => { S.settings.autoEnroll = el.checked; dirty(); };
A.fillProgs = () => { let n = 0; S.inm.forEach(i => { if (tryEnroll(i)) n++; }); toast('good', `${n} inmates enrolled.`); dirty(); render(); };

/* ---------- Healthcare ---------- */
V.healthcare = () => {
  const inf = S.inm.filter(i => i.infirm);
  const l7 = S.inc.filter(x => x.type === 'Medical emergency' && curDay() - curDay(x.t) < 7).length;
  let h = `<h1>Healthcare</h1><p class="sub">Inmates with health below 35 are admitted to the infirmary and discharged at 70. Each medical staff member present can treat 6 patients per hour.</p>`;
  h += `<div class="grid g4 mb">${kpi('Average health', S.inm.length ? Math.round(avgNeed('health')) : '—')}${kpi('In infirmary', inf.length, `Capacity ${staffCount('Medical Staff', true) * 6}/hr`)}
    ${kpi('Medical staff', staffCount('Medical Staff'), `${requirements()['Medical Staff']} recommended`, staffCount('Medical Staff') < requirements()['Medical Staff'] ? 'warn' : '')}${kpi('Emergencies (7d)', l7)}</div>`;
  h += `<div class="card mb"><h3>Infirmary</h3>${tbl('inf', inf, [
    { l: 'ID', v: i => i.id, h: i => `<span class="mono">${i.id}</span>` }, { l: 'Name', v: i => iname(i) }, { l: 'Age', v: i => i.age, r: 1 }, { l: 'Class', v: i => i.cls, h: i => tag(i.cls) },
    { l: 'Health', v: i => Math.round(i.n.health), h: i => `<div class="row" style="gap:6px;flex-wrap:nowrap">${bar(i.n.health)}<span class="mono small">${Math.round(i.n.health)}</span></div>` }, { l: 'Condition', v: i => i.sick ? 'Illness / injury' : 'Poor health' }
  ], { row: 'inmate', rowArg: i => i.id, search: false, empty: 'The infirmary is empty.' })}</div>`;
  const ci = S.inm.filter(i => i.psych != null);
  if (ci.length || S.unlock.classes.includes('Insane')) h += `<div class="card mb"><h3>Psychiatric care</h3><p class="small mut">Criminally insane inmates lose psychiatric stability every day. Each Psychiatrist present does daily rounds for 15 patients (lowest stability first), and Psychiatric Treatment sessions add more. Unstable inmates (below 35) have far more incidents, especially psychotic episodes. Psychiatrists: <b>${staffCount('Psychiatrist')}</b> (${requirements()['Psychiatrist']} recommended).</p>${tbl('psy', ci, [
    { l: 'ID', v: i => i.id, h: i => `<span class="mono">${i.id}</span>` }, { l: 'Name', v: i => iname(i) }, { l: 'Diagnosis', v: i => i.dx || '' },
    { l: 'Stability', v: i => Math.round(i.psych), h: i => `<div class="row" style="gap:6px;flex-wrap:nowrap">${bar(i.psych)}<span class="mono small">${Math.round(i.psych)}</span></div>` },
    { l: 'In treatment', v: i => i.prog === 'Psychiatric Treatment' ? 'Yes' : 'No' }, { l: 'Incidents', v: i => i.incCount, r: 1 }
  ], { row: 'inmate', rowArg: i => i.id, sort: 3, per: 10, empty: 'No criminally insane inmates.' })}</div>`;
  const low = S.inm.filter(i => !i.infirm).sort((a, b) => a.n.health - b.n.health).slice(0, 15);
  h += `<div class="card"><h3>Lowest health (not admitted)</h3>${tbl('lowh', low, [
    { l: 'ID', v: i => i.id, h: i => `<span class="mono">${i.id}</span>` }, { l: 'Name', v: i => iname(i) }, { l: 'Age', v: i => i.age, r: 1 },
    { l: 'Health', v: i => Math.round(i.n.health), r: 1 }, { l: 'Hunger', v: i => Math.round(i.n.hunger), r: 1 }, { l: 'Hygiene', v: i => Math.round(i.n.hygiene), r: 1 }, { l: '', v: () => '', ns: 1, h: i => btn('Admit', 'admitInf', i.id, 'sm') }
  ], { search: false, per: 15, empty: 'No inmates.' })}</div>`;
  return h;
};
A.admitInf = id => { const i = getInm(id); if (i) { i.infirm = true; ihist(i, 'Admitted to infirmary by administration.'); money(-150, 'Healthcare', `Assessment ${i.id}`); dirty(); render(); } };

/* ---------- Visitors ---------- */
V.visitors = () => {
  const y = S.hist[S.hist.length - 1];
  const l7 = S.hist.slice(-7);
  let h = `<h1>Visitors</h1><p class="sub">Visits happen during Visitation periods in the regime, on the days you allow. Visits raise social needs and reduce stress, and some families deposit money — but visitors can smuggle contraband.</p>`;
  h += `<div class="grid g4 mb">${kpi('Visits yesterday', y ? y.visits : '—')}${kpi('Visits (7 days)', sum(l7, x => x.visits))}${kpi('Contraband (7 days)', sum(l7, x => x.contraband))}${kpi('Visiting today', S.settings.visitDays[dow()] ? 'Yes' : 'No')}</div>`;
  h += `<div class="grid g2"><div class="card"><h3>Visiting days</h3><div class="row">${DOW.map((d, k) => chk('visitDay', S.settings.visitDays[k], d, k)).join('')}</div>
    <h3 class="mt">Screening</h3>${seg('screening', S.settings.screening, [['none', 'Minimal'], ['standard', 'Standard'], ['strict', 'Strict']])}
    <p class="tiny dim">Strict screening cuts smuggling sharply but visits are less satisfying. Minimal screening lets much more contraband in.</p></div>
    <div class="card"><h3>Visitation periods in regimes</h3><div class="kv">${S.unlock.classes.map(c => `<div>${c}</div><div>${S.sched[c].map((a, hr) => a === 'Visits' ? String(hr).padStart(2, '0') + ':00' : null).filter(Boolean).join(', ') || '<span class="mut">None scheduled</span>'}</div>`).join('')}</div>
    <div class="row mt">${btn('Edit regimes', 'nav', 'regimes', 'sm')}</div></div></div>`;
  return h;
};
C.visitDay = (v, el, k) => { S.settings.visitDays[+k] = el.checked; dirty(); };

/* ---------- Parole ---------- */
V.parole = () => {
  const due = S.inm.filter(i => i.hearing);
  const soon = S.inm.filter(i => !i.hearing && i.parole - curDay() <= 14).sort((a, b) => a.parole - b.parole);
  let h = `<h1>Parole & Appeals</h1><p class="sub">Inmates become eligible for parole after serving a share of their sentence (${Object.entries(PAROLE_FRAC).filter(([k, v]) => v).map(([k, v]) => `${CLS_LABEL[k]} ${Math.round(v * 100)}%`).join(', ')}). Criminally insane inmates also need psychiatric stability. Death row inmates are never paroled — they go through the appeals process instead. The board weighs behavior, discipline, programs and employment. Approved inmates are released; others are reviewed again later.</p>`;
  h += deathRowCard();
  h += `<div class="grid g4 mb">${kpi('Hearings due', due.length)}${kpi('Eligible in 14 days', soon.length)}${kpi('Approved (total)', S.stats.paroleApproved)}${kpi('Denied (total)', S.stats.paroleDenied)}</div>`;
  h += `<div class="card mb"><div class="spread"><h3>Hearings due</h3><div class="row">${seg('paroleMode', S.settings.paroleMode, [['review', 'I review hearings'], ['auto', 'Board decides automatically']])}${due.length ? btn('Convene all', 'paroleAll', null, 'sm pri') : ''}</div></div>
    ${due.length ? `<div class="twrap"><table><thead><tr><th>Inmate</th><th>Class</th><th class="right">Served</th><th class="right">Behavior</th><th>Discipline</th><th class="right">Programs</th><th>Job</th><th class="right">Board score</th><th>Your recommendation</th><th></th></tr></thead><tbody>
    ${due.map(i => `<tr><td>${inmLink(i.id, iname(i))} <span class="mono tiny dim">${i.id}</span></td><td>${tag(i.cls)}</td><td class="right mono">${served(i)}/${i.sent}d</td><td class="right mono">${Math.round(i.beh)}</td><td>${i.disc}</td><td class="right mono">${i.certs.length}</td><td>${i.job || '—'}</td>
      <td class="right mono ${paroleScore(i) >= 60 ? 'good' : paroleScore(i) < 45 ? 'bad' : 'warn'}">${paroleScore(i)}</td>
      <td>${seg('rec_' + i.id, String(i.recommend || 0), [['-10', 'Oppose'], ['0', 'Neutral'], ['10', 'Support']])}</td><td>${btn('Convene board', 'paroleOne', i.id, 'sm pri')}</td></tr>`).join('')}</tbody></table></div>
    <p class="tiny dim mt6">Score ≥ 60 is usually approved, 45–59 continued for review, below 45 denied. If you don't act, the board convenes automatically after 3 days.</p>` : '<div class="small mut">No hearings due.</div>'}</div>`;
  h += `<div class="grid g2"><div class="card"><h3>Upcoming eligibility (14 days)</h3>${tbl('psoon', soon, [
    { l: 'Inmate', v: i => iname(i), h: i => inmLink(i.id, iname(i)) }, { l: 'Class', v: i => i.cls, h: i => tag(i.cls) }, { l: 'Eligible', v: i => i.parole, h: i => 'Day ' + i.parole }, { l: 'Outlook', v: i => paroleScore(i), r: 1 }
  ], { search: false, per: 10, empty: 'Nobody becomes eligible in the next 14 days.' })}</div>
    <div class="card"><h3>Board decisions</h3>${tbl('pout', S.reports, [
    { l: 'Day', v: r => r.d, h: r => 'D' + r.d }, { l: 'Inmate', v: r => r.name, h: r => inmLink(r.id, r.name) }, { l: 'Class', v: r => r.cls, h: r => tag(r.cls) }, { l: 'Score', v: r => r.score, r: 1 },
    { l: 'Outcome', v: r => r.out, h: r => `<span class="${r.out === 'Approved' ? 'good' : r.out === 'Denied' ? 'bad' : 'warn'}">${r.out}</span>` }
  ], { per: 10, empty: 'No hearings held yet.', filters: [{ l: 'Outcome', opts: ['Approved', 'Continued', 'Denied'], fn: (r, v) => r.out === v }] })}</div></div>`;
  return h;
};
A.paroleOne = id => { const i = getInm(id); if (!i) return; const out = holdHearing(i); toast(out === 'Approved' ? 'good' : out === 'Denied' ? 'bad' : 'warn', `${iname(i)}: parole ${out.toLowerCase()}.`); dirty(); render(); };
A.paroleAll = () => { const r = { Approved: 0, Continued: 0, Denied: 0 }; S.inm.filter(i => i.hearing).forEach(i => r[holdHearing(i)]++); toast('info', `Board: ${r.Approved} approved, ${r.Continued} continued, ${r.Denied} denied.`); dirty(); render(); };

/* ---------- Finance ---------- */
V.finance = () => {
  const fb = fundingBreakdown(); const comp = fb.pop().comp;
  const y = S.hist[S.hist.length - 1]; const l30 = S.hist.slice(-30);
  const payroll = sum(S.staff, s => s.sal / 365);
  const editable = S.mode !== 'career';
  let h = `<h1>Finance</h1><p class="sub">Government operating funding is the main income, paid daily at midnight for each housed inmate by classification, adjusted by a compliance factor. Empty beds earn nothing but still cost utilities and maintenance.</p>`;
  h += `<div class="grid g4 mb">${kpi('Balance', fmt$(S.money), '', S.money < 0 ? 'bad' : '')}${kpi('Daily funding (est.)', fmt$(sum(fb, x => x.total)), `Monthly ≈ ${fmt$(sum(fb, x => x.total) * 30)}`)}
    ${kpi('Yesterday', y ? `${y.inc - y.exp >= 0 ? '+' : ''}${fmt$(y.inc - y.exp)}` : '—', y ? `In ${fmt$(y.inc)} · Out ${fmt$(y.exp)}` : 'Report at midnight', y && y.inc < y.exp ? 'bad' : 'good')}
    ${kpi('Last 30 days', l30.length ? fmt$(sum(l30, x => x.inc - x.exp)) : '—', l30.length ? `In ${fmt$(sum(l30, x => x.inc))} · Out ${fmt$(sum(l30, x => x.exp))}` : '')}</div>`;
  h += `<div class="grid g2 mb"><div class="card"><h3>How funding is calculated</h3><div class="twrap"><table><thead><tr><th>Classification</th><th class="right">Housed</th><th class="right">Rate/inmate/day</th><th class="right">Daily</th></tr></thead><tbody>
    ${fb.filter(x => S.unlock.classes.includes(x.cls) || x.n).map(x => `<tr><td>${tag(x.cls)} ${x.cls}</td><td class="right mono">${x.n}</td><td class="right">${editable ? '$' + num('fundRate', x.rate, x.cls, 0, 1000, 1, 70) : '<span class="mono">' + fmt$(x.rate) + '</span>'}</td><td class="right mono">${fmt$(x.total)}</td></tr>`).join('')}
    <tr><td colspan=3>Compliance factor</td><td class="right mono">× ${comp.toFixed(3)}</td></tr></tbody></table></div>
    <p class="tiny dim mt6">Funding = Σ (housed inmates × rate) × compliance. Compliance ranges 0.80–1.00 based on officer coverage (15%) and support staffing (5%)${S.unlock.bonus ? ', plus a 5% performance bonus for 30 days after an inspection scoring 80+' : ''}. Inmates in the pending queue are not funded. ${editable ? 'Rates are editable in sandbox mode.' : 'Rates are set by the state in career mode.'}</p></div>
    <div class="card"><h3>Daily cost structure</h3><div class="kv">
      <div>Payroll</div><div class="mono">${fmt$(payroll)}</div>
      <div>Food (est.)</div><div class="mono">${fmt$(dailyFoodUse() * mealCost())}</div>
      <div>Utilities</div><div class="mono">${fmt$(sum(S.blocks.filter(b => b.status !== 'Construction'), b => blockCap(b) * TIERS[b.tier].util) + S.inm.length)}</div>
      <div>Maintenance (est.)</div><div class="mono">${fmt$(totalCapacity() * 1.2)}</div>
      <div>Healthcare (est.)</div><div class="mono">${fmt$(S.inm.length * 2 + S.inm.filter(i => i.infirm).length * 30)}</div>
      <div>Security operations</div><div class="mono">${fmt$(staffCount('Correctional Officer') * 6)}</div>
      <div>Administration</div><div class="mono">${fmt$(150 + S.inm.length)}</div></div>
      ${y ? `<h3 class="mt">Yesterday's breakdown</h3><div class="kv">${Object.entries(y.incomeBy).map(([k, v]) => `<div>${k}</div><div class="mono good">+${fmt$(v)}</div>`).join('')}${Object.entries(y.expBy).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<div>${k}</div><div class="mono bad">-${fmt$(v)}</div>`).join('')}</div>` : ''}</div></div>`;
  h += `<div class="card mb"><h3>Balance (30 days)</h3>${spark(l30.map(x => x.bal), 'var(--good)')}</div>`;
  const cats = [...new Set(S.tx.map(t => t.cat))].sort();
  h += `<div class="card"><h3>Transaction history</h3>${tbl('tx', S.tx, [
    { l: '#', v: t => t.id, r: 1, h: t => `<span class="mono small dim">${t.id}</span>` }, { l: 'When', v: t => t.t, h: t => `<span class="small">${stamp(t.t)}</span>` }, { l: 'Category', v: t => t.cat }, { l: 'Description', v: t => t.desc },
    { l: 'Amount', v: t => t.amt, r: 1, h: t => `<span class="mono ${t.amt < 0 ? 'bad' : 'good'}">${t.amt < 0 ? '' : '+'}${fmt$(t.amt)}</span>` }
  ], { sort: 0, dir: -1, per: 20, empty: 'No transactions yet.', filters: [{ l: 'Category', opts: cats, fn: (t, v) => t.cat === v }, { l: 'Type', opts: ['Income', 'Expense'], fn: (t, v) => v === 'Income' ? t.amt > 0 : t.amt < 0 }] })}</div>`;
  return h;
};
C.fundRate = (v, el, c) => { if (S.mode !== 'sandbox') return; S.settings.funding[c] = clamp(parseFloat(v) || 0, 0, 1000); dirty(); };

/* ---------- Reports ---------- */
V.reports = () => {
  const tabs = ['Daily', 'Weekly', 'Monthly'];
  const n = { Daily: 1, Weekly: 7, Monthly: 30 }[UI.repTab];
  const L = S.hist.slice(-n), P = S.hist.slice(-2 * n, -n);
  let h = `<h1>Reports</h1><p class="sub">Administrative reports are generated at midnight. ${S.hist.length} days of history recorded.</p>`;
  h += `<div class="tabs">${tabs.map(t => `<button class="${t === UI.repTab ? 'on' : ''}" data-a="repTab" data-arg="${t}">${t}</button>`).join('')}</div>`;
  if (!L.length) return h + '<div class="card mut">No reports yet. The first daily report is produced at midnight.</div>';
  const agg = (arr, f) => sum(arr, f);
  const rows = [
    ['Population (end)', L[L.length - 1].pop, P.length ? P[P.length - 1].pop : null],
    ['Capacity (end)', L[L.length - 1].cap, P.length ? P[P.length - 1].cap : null],
    ['Admissions received', agg(L, x => x.recv), P.length ? agg(P, x => x.recv) : null],
    ['Redirected / transferred', agg(L, x => x.rejected + x.transferred), P.length ? agg(P, x => x.rejected + x.transferred) : null, true],
    ['Income', fmt$(agg(L, x => x.inc)), P.length ? fmt$(agg(P, x => x.inc)) : null],
    ['Expenses', fmt$(agg(L, x => x.exp)), P.length ? fmt$(agg(P, x => x.exp)) : null],
    ['Net', fmt$(agg(L, x => x.inc - x.exp)), P.length ? fmt$(agg(P, x => x.inc - x.exp)) : null],
    ['Incidents (all)', agg(L, x => sum(Object.values(x.incidents))), P.length ? agg(P, x => sum(Object.values(x.incidents))) : null, true],
    ['  Major + Critical', agg(L, x => x.incidents.Major + x.incidents.Critical), P.length ? agg(P, x => x.incidents.Major + x.incidents.Critical) : null, true],
    ['Escapes', agg(L, x => x.escapes), P.length ? agg(P, x => x.escapes) : null, true],
    ['Meals served', fmtN(agg(L, x => x.meals)), P.length ? fmtN(agg(P, x => x.meals)) : null],
    ['Meals missed', agg(L, x => x.short), P.length ? agg(P, x => x.short) : null, true],
    ['Program enrollment (end)', L[L.length - 1].enrolled, P.length ? P[P.length - 1].enrolled : null],
    ['Program completions', agg(L, x => x.completions), P.length ? agg(P, x => x.completions) : null],
    ['Inmates employed (end)', L[L.length - 1].employed, P.length ? P[P.length - 1].employed : null],
    ['Parole approved / continued / denied', `${agg(L, x => x.paroleA)} / ${agg(L, x => x.paroleC)} / ${agg(L, x => x.paroleD)}`, P.length ? `${agg(P, x => x.paroleA)} / ${agg(P, x => x.paroleC)} / ${agg(P, x => x.paroleD)}` : null],
    ['Releases', agg(L, x => x.releases), P.length ? agg(P, x => x.releases) : null],
    ['Avg inmate satisfaction', Math.round(avg(L, x => x.sat)), P.length ? Math.round(avg(P, x => x.sat)) : null],
    ['Avg safety', Math.round(avg(L, x => x.needs.safety)), P.length ? Math.round(avg(P, x => x.needs.safety)) : null],
    ['Avg officer coverage', pct(Math.min(1, avg(L, x => x.cov))), P.length ? pct(Math.min(1, avg(P, x => x.cov))) : null],
    ['Visits', agg(L, x => x.visits), P.length ? agg(P, x => x.visits) : null],
    ['Contraband finds', agg(L, x => x.contraband), P.length ? agg(P, x => x.contraband) : null, true]
  ];
  h += `<div class="grid g2 mb"><div class="card"><h3>${UI.repTab} report · Day ${L[0].d}${L.length > 1 ? '–' + L[L.length - 1].d : ''}</h3><div class="twrap"><table><thead><tr><th>Metric</th><th class="right">This period</th><th class="right">Previous</th></tr></thead><tbody>
    ${rows.map(r => `<tr><td>${r[0]}</td><td class="right mono">${r[1]}</td><td class="right mono dim">${r[2] == null ? '—' : r[2]}</td></tr>`).join('')}</tbody></table></div></div>
    <div><div class="card mb"><h3>Problems & recommendations</h3>${reportRecs(L).map(([l, m]) => `<div class="alert ${l}">${m}</div>`).join('') || '<div class="alert good">No significant problems in this period.</div>'}</div>
    <div class="card"><h3>Trends</h3><div class="small mut">Satisfaction</div>${spark(S.hist.slice(-30).map(x => x.sat), 'var(--info)')}<div class="small mut mt6">Net income per day</div>${spark(S.hist.slice(-30).map(x => x.inc - x.exp), 'var(--good)')}<div class="small mut mt6">Officer coverage</div>${spark(S.hist.slice(-30).map(x => Math.min(1, x.cov)), 'var(--acc)')}</div></div></div>`;
  h += `<div class="card"><h3>Inspection history</h3>${S.inspections.length ? `<div class="twrap"><table><thead><tr><th>Day</th><th>Type</th><th class="right">Score</th><th>Grade</th>${Object.keys(S.inspections[0].parts).map(k => `<th class="right">${k}</th>`).join('')}</tr></thead><tbody>
    ${S.inspections.map(r => `<tr><td>D${r.d}</td><td>${r.scheduled ? 'Monthly' : 'Requested'}</td><td class="right mono ${r.score >= 70 ? 'good' : 'warn'}">${r.score}</td><td>${r.grade}</td>${Object.keys(r.parts).map(k => `<td class="right mono">${r.parts[k].toFixed(1)}/${r.max[k]}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : '<div class="small mut">No inspections yet. Monthly inspections happen automatically every 30 days; you can request one in Administration.</div>'}</div>`;
  return h;
};
function reportRecs(L) {
  const out = []; const last = L[L.length - 1];
  const net = sum(L, x => x.inc - x.exp);
  if (net < 0) { const top = {}; L.forEach(x => { for (const k in x.expBy) top[k] = (top[k] || 0) + x.expBy[k]; }); const t = Object.entries(top).sort((a, b) => b[1] - a[1])[0]; out.push(['bad', `Operating deficit of ${fmt$(-net)}. Largest cost: ${t ? t[0] + ' (' + fmt$(t[1]) + ')' : '—'}. Fill empty beds (raise intake), trim surplus staff, or lower meal quality.`]); }
  const empty = last.cap - last.pop; if (empty / Math.max(1, last.cap) > .25) out.push(['warn', `${empty} beds (${Math.round(empty / last.cap * 100)}%) are empty and earn no funding. Raise daily intake allowances.`]);
  const short = sum(L, x => x.short); if (short) out.push(['bad', `${short} meals missed. Increase kitchen staff or food stock.`]);
  const mc = sum(L, x => x.incidents.Major + x.incidents.Critical); if (mc / L.length > 1) out.push(['warn', `${mc} major/critical incidents. Check officer coverage, separate rivals, and enrol aggressive inmates in Anger Management.`]);
  if (sum(L, x => x.escapes)) out.push(['bad', `${sum(L, x => x.escapes)} escape(s). Coverage in high-security blocks must be raised.`]);
  if (avg(L, x => x.cov) < .8) out.push(['warn', `Average officer coverage ${pct(avg(L, x => x.cov))}. Hire officers or rebalance shifts.`]);
  if (last.needs.hygiene < 40) out.push(['warn', 'Hygiene is low — add shower periods or upgrade cells to Tier 2.']);
  if (last.needs.rec < 40) out.push(['warn', 'Recreation is low — schedule more recreation/free time or staff the library.']);
  if (last.needs.stress > 55) out.push(['warn', 'Stress is elevated — improve meals, recreation, visits and counseling.']);
  if (last.pop && last.enrolled / last.pop < .2) out.push(['info', 'Under 20% of inmates are in programs. More program staff improve parole outcomes.']);
  if (sum(L, x => x.rejected + x.transferred)) out.push(['warn', `${sum(L, x => x.rejected + x.transferred)} admissions were redirected or transferred because no suitable beds were free.`]);
  if (sum(L, x => x.contraband) > L.length) out.push(['info', 'Frequent contraband: tighten visitor screening or increase cell searches.']);
  return out;
}
A.repTab = t => { UI.repTab = t; render(); };

/* ---------- Administration ---------- */
V.administration = () => {
  const est = inspectionScore();
  const canInspect = curDay() - S.lastInspectDay >= 7;
  let h = `<h1>Administration</h1><p class="sub">Prison configuration, inspections, saving and game rules.</p>`;
  h += `<div class="grid g2 mb"><div class="card"><h3>Facility</h3><div class="kv"><div>Prison name</div><div>${esc(S.name)} ${btn('Rename', 'renamePrison', null, 'sm')}</div>
    <div>Game mode</div><div>${modeLabel(S.mode)}</div><div>Population</div><div>${S.pop}</div><div>Initial size</div><div>${S.size}</div>
    <div>Day</div><div>${curDay()} (${DOW[dow()]}) ${clockStr()}</div><div>Classifications</div><div>${S.unlock.classes.join(', ')}</div><div>Tier 3 cells</div><div>${S.unlock.tier3 ? 'Available' : 'Locked'}</div></div></div>
    <div class="card"><h3>Government inspection</h3><p class="small mut">Current estimate: <b class="mono" style="color:var(--txt)">${est.score}/100</b>. Inspections happen every 30 days automatically; you can request one every 7 days.</p>
    ${Object.entries(est.parts).map(([k, v]) => `<div class="needrow" style="grid-template-columns:150px 1fr 60px"><span class="mut">${k}</span>${bar(v / est.max[k] * 100)}<span class="mono right">${v.toFixed(1)}/${est.max[k]}</span></div>`).join('')}
    <div class="row mt">${btn('Request inspection', 'inspect', null, 'pri', !canInspect)}${!canInspect ? `<span class="tiny dim">Next request available Day ${S.lastInspectDay + 7}</span>` : ''}</div></div></div>`;
  if (S.mode === 'career') h += careerCard(false);
  h += `<div class="grid g2 mb"><div class="card"><h3>Saving</h3><p class="small mut">${Store.describe()}</p>
    <div class="kv mb"><div>Last saved</div><div id="lastSaved">${Store.lastSaved ? new Date(Store.lastSaved).toLocaleTimeString() : 'Not yet'}</div><div>Auto-save</div><div>Every 30 seconds while playing, on pause, and when you leave</div></div>
    <div class="row">${btn('Save now', 'saveNow', null, 'pri')}${btn('Export save code', 'exportSave', null)}${btn('Import save code', 'importSave', null)}</div></div>
    <div class="card"><h3>Game session</h3><p class="small mut">The simulation only runs while this page is open and visible. It pauses automatically when you switch tabs or close the page, and resumes from the saved state.</p>
    <div class="row">${btn('Save & exit to menu', 'quit', null)}${btn('Delete this prison', 'deletePrison', null, 'danger')}</div></div></div>`;
  return h;
};
A.renamePrison = () => { openModal(`<h2>Rename prison</h2><input type="text" id="rnIn" value="${esc(S.name)}" style="width:100%"><div class="row mt" style="justify-content:flex-end">${btn('Cancel', 'closeModal')}${btn('Save', 'renamePrisonOk', null, 'pri')}</div>`, true); };
A.renamePrisonOk = () => { const v = $('#rnIn').value.trim().slice(0, 40); if (v) { S.name = v; dirty(); } closeModal(); renderShell(); render(); };
A.inspect = () => { if (curDay() - S.lastInspectDay < 7) return; const r = runInspection(false); dirty(); render(); openModal(`<h2>Inspection result: ${r.score}/100 — ${r.grade}</h2>${Object.entries(r.parts).map(([k, v]) => `<div class="needrow" style="grid-template-columns:150px 1fr 60px"><span class="mut">${k}</span>${bar(v / r.max[k] * 100)}<span class="mono right">${v.toFixed(1)}/${r.max[k]}</span></div>`).join('')}<p class="small mut mt">${r.score >= 70 ? 'The facility passed inspection.' : 'The facility did not reach the passing standard of 70. See Reports for recommendations.'}</p>`, true); };
A.exportSave = () => {
  const code = encodeSave(S);
  openModal(`<h2>Export save code</h2><p class="small mut">Copy this text and keep it somewhere safe. You can import it on any device.</p><textarea id="exp" readonly style="width:100%;height:160px;background:#0d1114;color:var(--txt);border:1px solid var(--line2);border-radius:6px;font:11px var(--mono)">${esc(code)}</textarea><div class="row mt" style="justify-content:flex-end">${btn('Copy', 'copyExp', null, 'pri')}</div>`);
};
A.copyExp = () => { const t = $('#exp'); t.select(); try { navigator.clipboard.writeText(t.value).then(() => toast('good', 'Copied.'), () => toast('info', 'Select the text and copy it manually.')); } catch (e) { toast('info', 'Select the text and copy it manually.'); } };
A.importSave = () => { openModal(`<h2>Import save code</h2><p class="small mut">Paste a save code. It will be added as a new prison in your saves.</p><textarea id="imp" style="width:100%;height:160px;background:#0d1114;color:var(--txt);border:1px solid var(--line2);border-radius:6px;font:11px var(--mono)"></textarea><div class="row mt" style="justify-content:flex-end">${btn('Cancel', 'closeModal')}${btn('Import', 'importOk', null, 'pri')}</div>`); };

/* ---------- Death row appeals ---------- */
function deathRowCard() {
  const dr = S.inm.filter(i => i.appeal);
  if (!dr.length && !S.unlock.classes.includes('DeathRow')) return '';
  let h = `<div class="card mb"><div class="spread"><h3>Death row appeals (${dr.length})</h3><span class="tiny dim">Executions carried out: ${S.stats.executions || 0}</span></div>`;
  if (!dr.length) return h + '<div class="small mut">Nobody is on death row.</div></div>';
  h += `<p class="small mut">Every death sentence goes through four stages: ${APPEAL_STAGES.join(' → ')}. Winning any stage commutes the sentence to life in Maximum security. If all four are denied, an execution date is set 14 days later (a court may still grant a last-minute stay). You can fund a legal team ($5,000 per stage) and, at the clemency stage, formally support clemency.</p>
  <div class="twrap"><table><thead><tr><th>Inmate</th><th>Charges</th><th>Stage</th><th>Next date</th><th class="right">Odds</th><th class="right">Behavior</th><th>Psychiatric care</th><th></th></tr></thead><tbody>
  ${dr.sort((a, b) => (a.appeal.exec || a.appeal.next) - (b.appeal.exec || b.appeal.next)).map(i => { const a = i.appeal; return `<tr><td>${inmLink(i.id, iname(i))} <span class="mono tiny dim">${i.id}</span></td><td class="small" style="white-space:normal">${esc(i.charges[0])}</td>
    <td>${i.commuted ? '<span class="good">Commuted — awaiting Max bed</span>' : a.exec ? '<span class="bad">Appeals exhausted</span>' : `${a.stage + 1}/4 · ${APPEAL_STAGES[a.stage]}`}</td>
    <td>${a.exec ? `<span class="bad">Execution Day ${a.exec}</span>` : 'Day ' + a.next}</td><td class="right mono">${a.exec || i.commuted ? '—' : Math.round(appealOdds(i) * 100) + '%'}</td><td class="right mono">${Math.round(i.beh)}</td>
    <td class="small">${i.prog === 'Psychiatric Treatment' ? 'In treatment' : i.certs.includes('Psychiatric Treatment') ? 'Completed' : '<span class="mut">None</span>'}</td>
    <td><div class="row" style="flex-wrap:nowrap">${!a.exec && !i.commuted ? btn(a.legal ? 'Legal team funded' : 'Fund legal team ($5k)', 'drLegal', i.id, 'sm', !!a.legal) : ''}${a.stage === 3 && !a.exec ? btn(a.support ? 'Supporting clemency' : 'Support clemency', 'drSupport', i.id, 'sm' + (a.support ? ' pri' : '')) : ''}</div></td></tr>`; }).join('')}
  </tbody></table></div></div>`;
  return h;
}
A.drLegal = id => { const i = getInm(id); if (!i || !i.appeal || i.appeal.legal) return; if (S.money < 5000) return toast('bad', 'Not enough funds.'); money(-5000, 'Legal & judicial', `Appeal legal team ${i.id}`); i.appeal.legal = 1; ihist(i, `Administration funded a legal team for the ${APPEAL_STAGES[i.appeal.stage].toLowerCase()}.`); dirty(); render(true); };
A.drSupport = id => { const i = getInm(id); if (!i || !i.appeal) return; i.appeal.support = i.appeal.support ? 0 : 1; dirty(); render(true); };

/* ---------- Discipline policy ---------- */
V.discipline = () => {
  const pol = S.settings.disc;
  const since = d => S.inc.filter(x => curDay() - curDay(x.t) < d);
  const l7 = since(7), l30 = since(30);
  const durS = Object.keys(SANCTIONS).filter(k => SANCTIONS[k].dur);
  let h = `<h1>Discipline</h1><p class="sub">Choose the punishment for each type of incident and how long it lasts. These rules are used whenever an incident is handled automatically, and are pre-selected when you decide an incident yourself on the Security page.</p>`;
  h += `<div class="card mb"><div class="row mb">
    <div><label class="f">Handle automatically</label>${seg('autoHandle', S.settings.autoHandle, [['minor', 'Minor only'], ['moderate', 'Minor + moderate'], ['all', 'All incidents']])}</div>
    <div>${chk('escalate', S.settings.escalate, 'Double the duration for Major and Critical incidents')}</div></div>
    <div class="twrap"><table><thead><tr><th>Incident type</th><th class="right">Last 7 days</th><th class="right">Last 30 days</th><th>Punishment</th><th class="right">Duration (days)</th><th>What it does</th></tr></thead><tbody>
    ${INC_TYPES.map(t => { const p = pol[t] || { s: 'Verbal warning', days: 0 }; const X = SANCTIONS[p.s] || {}; return `<tr><td><b>${t}</b></td><td class="right mono">${l7.filter(x => x.type === t).length}</td><td class="right mono">${l30.filter(x => x.type === t).length}</td>
      <td>${sel('discS', p.s, Object.keys(SANCTIONS), t)}</td><td class="right">${X.dur ? num('discD', p.days || X.days, t, 1, 60, 1, 64) : '<span class="dim">—</span>'}</td><td class="small mut" style="white-space:normal;min-width:200px">${X.d || ''}</td></tr>`; }).join('')}
    </tbody></table></div>
    <div class="row mt">${btn('Reset to recommended', 'discReset', null, 'sm')}<span class="tiny dim">Minor incidents are always logged; punishments with a duration (${durS.join(', ')}) apply for the days you set.</span></div></div>`;
  const now = S.inm.filter(i => i.disc === 'Restricted' || i.disc === 'Solitary');
  h += `<div class="card"><h3>Currently serving punishments (${now.length})</h3>${tbl('serving', now, [
    { l: 'ID', v: i => i.id, h: i => `<span class="mono">${i.id}</span>` }, { l: 'Name', v: i => iname(i) }, { l: 'Class', v: i => i.cls, h: i => tag(i.cls) }, { l: 'Status', v: i => i.disc, h: i => `<span class="${i.disc === 'Solitary' ? 'bad' : 'warn'}">${i.disc}</span>` },
    { l: 'Until', v: i => i.discUntil, h: i => 'Day ' + i.discUntil }, { l: 'Days left', v: i => i.discUntil - curDay(), r: 1 }, { l: '', v: () => '', ns: 1, q: false, h: i => btn('End early', 'discEnd', i.id, 'sm') }
  ], { row: 'inmate', rowArg: i => i.id, per: 15, empty: 'Nobody is currently being punished.' })}</div>`;
  return h;
};
C.discS = (v, el, t) => { const X = SANCTIONS[v]; S.settings.disc[t] = { s: v, days: X.dur ? (S.settings.disc[t] && S.settings.disc[t].days) || X.days : 0 }; dirty(); render(true); };
C.discD = (v, el, t) => { S.settings.disc[t].days = clamp(parseInt(v) || 1, 1, 60); dirty(); };
C.escalate = (v, el) => { S.settings.escalate = el.checked; dirty(); };
A.discReset = () => { S.settings.disc = defaultDiscipline(); dirty(); render(true); };
A.discEnd = id => { const i = getInm(id); if (!i) return; ihist(i, `${i.disc} ended early by administration.`); i.disc = 'Warning'; i.discUntil = curDay(); dirty(); render(true); };

/* ---------- Test mode ---------- */
V.testing = () => {
  if (!S.test) return `<h1>Test Mode</h1><div class="card">${btn('Enable test tools for this prison', 'testOn', null, 'pri')}</div>`;
  const T = UI.t = UI.t || { cls: 'Medium', n: 10, inc: 'Fight', weather: 'Clear' };
  const box = (title, body) => `<div class="card"><h3>${title}</h3>${body}</div>`;
  let h = `<h1>Test Mode</h1><p class="sub">Tools for trying things out quickly. Nothing here is a normal game action. A 100x speed button is available in the top bar.</p><div class="grid g3 mb">`;
  h += box('Money', `<div class="row">${btn('+$100k', 'tMoney', 100000, 'sm')}${btn('+$1M', 'tMoney', 1000000, 'sm')}${btn('Set to $0', 'tMoneySet', 0, 'sm')}${btn('Set to -$50k', 'tMoneySet', -50000, 'sm')}</div>`);
  h += box('Time', `<div class="row">${btn('+1 hour', 'tTime', 60, 'sm')}${btn('+1 day', 'tTime', 1440, 'sm')}${btn('+7 days', 'tTime', 10080, 'sm')}${btn('+30 days', 'tTime', 43200, 'sm')}</div><p class="tiny dim mt6">Runs the full simulation for that period instantly.</p>`);
  h += box('Spawn inmates', `<div class="row">${sel('tCls', T.cls, CLASSES.map(c => [c, CLS_LABEL[c]]))}${num('tN', T.n, '', 1, 200, 1, 64)}${btn('Admit now', 'tSpawn', null, 'sm pri')}</div><p class="tiny dim mt6">Bypasses intake limits; goes to the queue if no beds.</p>`);
  h += box('Trigger incident', `<div class="row">${sel('tInc', T.inc, INC_TYPES.concat(['Escape', 'Positive behavior']))}${btn('Trigger', 'tIncident', null, 'sm pri')}</div><p class="tiny dim mt6">Uses a random inmate (of the class selected under Spawn, if any are housed).</p>`);
  h += box('Death row', `<div class="row">${btn('All appeals due today', 'tAppeals', null, 'sm')}${btn('Exhaust appeals for one', 'tExhaust', null, 'sm')}${btn('Add death row inmate', 'tSpawnDR', null, 'sm')}</div>`);
  h += box('Criminally insane', `<div class="row">${btn('Psychiatric crisis (all → 10)', 'tPsych', 10, 'sm')}${btn('Stabilize all (→ 90)', 'tPsych', 90, 'sm')}</div>`);
  h += box('Needs', `<div class="row">${btn('All needs perfect', 'tNeeds', 100, 'sm')}${btn('All needs terrible', 'tNeeds', 15, 'sm')}${btn('Heal everyone', 'tHeal', null, 'sm')}</div>`);
  h += box('Staff', `<div class="row">${btn('Hire to meet needs (free)', 'tHire', null, 'sm')}</div>`);
  h += box('World', `<div class="row">${sel('tWeather', S.weather, WEATHER.map(w => w[0]))}${btn('PC request', 'tPC', null, 'sm')}${btn('Run inspection', 'tInspect', null, 'sm')}${btn('Unlock everything', 'tUnlock', null, 'sm')}${S.mode === 'career' ? btn('Complete next objective', 'tObjective', null, 'sm') : ''}</div>`);
  h += `</div><div class="card"><h3>Debug</h3><div class="kv small"><div>Save size</div><div class="mono">${fmtN(JSON.stringify(S).length / 1024)} KB</div><div>Inmates / queue / released</div><div class="mono">${S.inm.length} / ${S.queue.length} / ${S.released.length}</div><div>Incidents stored</div><div class="mono">${S.inc.length}</div><div>Game time (minutes)</div><div class="mono">${S.t}</div><div>Storage</div><div>${Store.mode}</div></div>
    <div class="row mt">${btn('Disable test tools', 'testOff', null, 'sm')}</div></div>`;
  return h;
};
A.testOn = () => { S.test = true; dirty(); renderShell(); render(); };
A.testOff = () => { S.test = false; if (S.speed > 30) S.speed = 30; UI.view = 'dashboard'; dirty(); renderShell(); render(); };
A.tMoney = v => { money(+v, 'Test', 'Test mode deposit'); dirty(); updateHeader(); render(true); };
A.tMoneySet = v => { S.money = +v; dirty(); updateHeader(); render(true); };
A.tTime = m => { const t0 = performance.now(); advanceMinutes(+m); dirty(); updateHeader(); render(true); toast('info', `Advanced ${+m >= 1440 ? (+m / 1440) + ' day(s)' : '1 hour'} in ${Math.round(performance.now() - t0)} ms.`); };
C.tCls = v => { UI.t.cls = v; }; C.tN = v => { UI.t.n = clamp(parseInt(v) || 1, 1, 200); }; C.tInc = v => { UI.t.inc = v; };
C.tWeather = v => { S.weather = v; dirty(); toast('info', `Weather set to ${v}.`); };
A.tSpawn = () => { const { cls, n } = UI.t; let a = 0, q = 0; for (let k = 0; k < n; k++) { const i = genInmate(cls); const spot = findBed(cls); if (spot) { place(i, spot.b, spot.c); i.loc = 'Cell'; S.inm.push(i); afterAdmit(i); a++; } else { i.queued = curDay(); i.loc = 'Pending intake'; S.queue.push(i); q++; } } toast('good', `${a} admitted, ${q} queued.`); dirty(); updateHeader(); render(true); };
A.tSpawnDR = () => { UI.t.cls = 'DeathRow'; UI.t.n = 1; A.tSpawn(); };
A.tIncident = () => {
  const pool = S.inm.filter(i => i.cls === UI.t.cls).length ? S.inm.filter(i => i.cls === UI.t.cls) : S.inm; if (!pool.length) return toast('bad', 'No inmates.');
  const i = pick(pool); const b = getBlock(i.blk); const t = UI.t.inc;
  if (t === 'Escape') escape(i, b);
  else if (t === 'Positive behavior') incident(i, 'Positive behavior', `${iname(i)} recognised for good conduct (test).`, 'Positive', b, true);
  else if (t === 'Medical emergency') { i.n.health = 30; i.infirm = true; incident(i, t, `${iname(i)} required emergency medical attention (test).`, 'Major', b); }
  else if (t === 'Assault on protective custody') { const v = S.inm.find(x => x.cls === 'Protective'); const a = S.inm.find(x => x.cls !== 'Protective'); if (!v || !a) return toast('bad', 'Needs a PC inmate and a general population inmate.'); yardClash([v], [a]); }
  else makeIncident(i, b, t, 1);
  toast('info', `Triggered ${t} involving ${iname(i)}.`); dirty(); render(true);
};
A.tAppeals = () => { S.inm.filter(i => i.appeal && !i.appeal.exec).forEach(i => i.appeal.next = curDay()); toast('info', 'Appeals will be heard at midnight (or use +1 day).'); dirty(); };
A.tExhaust = () => { const i = S.inm.find(x => x.appeal && !x.appeal.exec); if (!i) return toast('bad', 'No death row inmate with appeals pending.'); i.appeal.stage = 3; i.appeal.next = curDay(); i.appeal.support = 0; toast('info', `${iname(i)} is at the clemency stage; decided at midnight.`); dirty(); render(true); };
A.tPsych = v => { S.inm.forEach(i => { if (i.psych != null) i.psych = +v; }); dirty(); render(true); };
A.tNeeds = v => { S.inm.forEach(i => { for (const k in i.n) i.n[k] = k === 'stress' ? 100 - v : +v; }); dirty(); render(true); };
A.tHeal = () => { S.inm.forEach(i => { i.n.health = 100; i.infirm = false; i.sick = false; }); dirty(); render(true); };
A.tHire = () => { const req = requirements(); let n = 0; for (const r of ROLE_NAMES) { const gap = (req[r] || 0) - staffCount(r); for (let k = 0; k < gap; k++) { const s = genStaff(r, ri(2, 8)); S.staff.push(s); if (r === 'Correctional Officer') assignNewOfficer(s); n++; } } toast('good', `Hired ${n} staff for free.`); dirty(); updateHeader(); render(true); };
A.tPresent = v => { S.staff.forEach(s => { s.present = +v ? true : (s.role === 'Correctional Officer' ? rnd() < .5 : true); }); dirty(); updateHeader(); render(true); };
A.tPC = () => { const i = S.inm.find(x => !['Protective', 'DeathRow', 'Insane'].includes(x.cls) && !x.pcRequest); if (!i) return; i.pcRequest = { d: curDay(), why: 'Labelled an informant by other inmates' }; note('warn', `${iname(i)} (${i.id}) has requested protective custody (test).`); dirty(); toast('info', 'PC request created — see Security.'); };
A.tInspect = () => { runInspection(false); dirty(); render(true); };
A.tUnlock = () => { CLASSES.forEach(unlockClass); S.unlock.tier3 = true; S.unlock.bonus = true; PROG_NAMES.forEach(p => S.unlock.progs[p] = true); JOB_NAMES.forEach(j => S.unlock.jobs[j] = true); dirty(); render(true); };
A.tObjective = () => { if (S.career.idx >= CAREER.length) return; const o = CAREER[S.career.idx]; S.career.done.push(o.id); S.career.idx++; o.give(); note('good', `Objective completed (test): ${o.t}.`); dirty(); render(true); };
