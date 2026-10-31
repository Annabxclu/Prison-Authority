/* ================= Persistence ================= */
const sleep = ms => new Promise(r => setTimeout(r, ms));
const timeout = (p, ms) => Promise.race([p, new Promise(r => setTimeout(() => r(null), ms))]);
function encodeSave(st) { const j = JSON.stringify(st); return 'PMS1:' + btoa(unescape(encodeURIComponent(j))); }
function decodeSave(code) { code = code.trim(); if (!code.startsWith('PMS1:')) throw new Error('Not a save code'); return JSON.parse(decodeURIComponent(escape(atob(code.slice(5))))); }

const Store = {
  mode: 'none', db: null, uid: null, lastSaved: 0, saving: false, pending: false, tab: uid(), gens: {},
  describe() {
    return this.mode === 'cloud' ? 'Saved privately to your Claude account. Your prisons are available wherever you open this game while signed in.'
      : this.mode === 'local' ? 'Saved in this browser only (account saving is not available in this view). Use Export to move a prison to another device.'
        : 'Saving is not available in this view. Use Export save code to keep your progress.';
  },
  async init() {
    try {
      for (let k = 0; k < 15 && !(window.claude && window.claude.use); k++) await sleep(100);
      if (window.claude && window.claude.use) {
        const [db, user] = await Promise.all([timeout(window.claude.use('db'), 10000), timeout(window.claude.use('user'), 10000)]);
        if (db && user) { const id = await timeout(user.id(), 10000); if (id) { this.db = db; this.uid = id; this.mode = 'cloud'; return; } }
      }
    } catch (e) { console.warn('cloud init failed', e); }
    try { localStorage.setItem('__psim', '1'); localStorage.removeItem('__psim'); this.mode = 'local'; } catch (e) { this.mode = 'none'; }
  },
  col() { return this.db.collection('data/users/' + this.uid); },
  async list() {
    if (this.mode === 'cloud') { const q = await this.col().where('kind', '==', 'meta').get(); return q.docs.map(d => d.data()).sort((a, b) => b.updated - a.updated); }
    if (this.mode === 'local') { const out = []; for (let k = 0; k < localStorage.length; k++) { const key = localStorage.key(k); if (key.startsWith('psim_meta_')) { try { out.push(JSON.parse(localStorage.getItem(key))); } catch (e) { } } } return out.sort((a, b) => b.updated - a.updated); }
    return [];
  },
  meta(st) { return { kind: 'meta', slot: st.id, name: st.name, mode: st.mode, day: curDay(st.t), pop: st.inm.length, cap: sum(st.blocks, b => sum(b.cells, c => c.beds)), money: Math.round(st.money), updated: Date.now() }; },
  async save(st) {
    if (!st || this.mode === 'none' || Lock.lost) return;
    if (this.saving) { this.pending = true; return; }
    this.saving = true; setSaveDot('saving');
    try {
      const json = JSON.stringify(st); const meta = this.meta(st);
      if (this.mode === 'cloud') {
        const col = this.col(); const slot = st.id;
        let prev = this.gens[slot]; if (!prev) { const m = await col.doc('m-' + slot).get(); prev = m.exists ? m.data() : { gen: 1, n0: 0, n1: 0 }; }
        const gen = (prev.gen + 1) % 2; const CH = 90000; const n = Math.ceil(json.length / CH);
        for (let i = 0; i < n; i++) await col.doc(`c-${slot}-g${gen}-${i}`).set({ kind: 'chunk', slot, gen, i, d: json.slice(i * CH, (i + 1) * CH) });
        meta.gen = gen; meta.chunks = n; meta.n0 = gen === 0 ? n : (prev.n0 || 0); meta.n1 = gen === 1 ? n : (prev.n1 || 0);
        const old = gen === 0 ? prev.n0 || 0 : prev.n1 || 0;
        await col.doc('m-' + slot).set(meta);
        for (let i = n; i < old; i++) await col.doc(`c-${slot}-g${gen}-${i}`).delete();
        this.gens[slot] = meta;
      } else {
        localStorage.setItem('psim_save_' + st.id, json); localStorage.setItem('psim_meta_' + st.id, JSON.stringify(meta));
      }
      this.lastSaved = Date.now(); setSaveDot('ok');
      const el = document.getElementById('lastSaved'); if (el) el.textContent = new Date(this.lastSaved).toLocaleTimeString();
    } catch (e) {
      console.error(e); setSaveDot('err');
      if (e && e.code === 'quota_exceeded') toast('bad', 'Cloud storage is full. Delete an old prison or export this one.');
      else toast('bad', 'Save failed: ' + (e && (e.message || e.code) || e));
    } finally {
      this.saving = false;
      if (this.pending) { this.pending = false; setTimeout(() => this.save(S), 500); }
    }
  },
  async load(slot) {
    if (this.mode === 'cloud') {
      const col = this.col(); const m = await col.doc('m-' + slot).get(); if (!m.exists) throw new Error('Save not found');
      const meta = m.data(); const parts = [];
      for (let i = 0; i < meta.chunks; i++) { const c = await col.doc(`c-${slot}-g${meta.gen}-${i}`).get(); if (!c.exists) throw new Error('Save data incomplete'); parts.push(c.data().d); }
      this.gens[slot] = meta; return JSON.parse(parts.join(''));
    }
    if (this.mode === 'local') { const j = localStorage.getItem('psim_save_' + slot); if (!j) throw new Error('Save not found'); return JSON.parse(j); }
    throw new Error('No storage');
  },
  async del(slot) {
    if (this.mode === 'cloud') {
      const col = this.col(); const m = await col.doc('m-' + slot).get(); const meta = m.exists ? m.data() : { n0: 0, n1: 0 };
      await col.doc('m-' + slot).delete();
      for (const g of [0, 1]) for (let i = 0; i < (meta['n' + g] || meta.chunks || 0); i++) await col.doc(`c-${slot}-g${g}-${i}`).delete();
      try { await col.doc('lock-' + slot).delete(); } catch (e) { }
    } else if (this.mode === 'local') { localStorage.removeItem('psim_save_' + slot); localStorage.removeItem('psim_meta_' + slot); }
  }
};

/* Single-simulation lock: one tab/device runs a prison at a time */
const Lock = {
  slot: null, lost: false, timer: null, bc: null,
  async take(slot) {
    this.slot = slot; this.lost = false;
    if (Store.mode === 'cloud') {
      try { const r = await Store.col().doc('lock-' + slot).acquire({ holder: Store.tab, ttlMs: 25000 }); if (!r.acquired) return false; }
      catch (e) { console.warn('lock failed', e); }
    } else {
      try {
        if (!this.bc) { this.bc = new BroadcastChannel('psim-lock'); this.bc.onmessage = ev => { const m = ev.data; if (m.q && m.q === this.slot && m.tab !== Store.tab && !this.lost) this.bc.postMessage({ busy: m.q, tab: Store.tab }); if (m.busy && m.busy === this._asking && m.tab !== Store.tab) this._busy = true; }; }
        this._asking = slot; this._busy = false; this.bc.postMessage({ q: slot, tab: Store.tab }); await sleep(350); this._asking = null;
        if (this._busy) return false;
      } catch (e) { }
    }
    clearInterval(this.timer);
    this.timer = setInterval(() => this.renew(), 10000);
    return true;
  },
  async renew() {
    if (!this.slot || this.lost || Store.mode !== 'cloud') return;
    try { const r = await Store.col().doc('lock-' + this.slot).acquire({ holder: Store.tab, ttlMs: 25000 }); if (!r.acquired) this.onLost(); } catch (e) { }
  },
  onLost() { this.lost = true; setSpeed(0); showLockBanner(); },
  release() { clearInterval(this.timer); this.slot = null; this.lost = false; }
};
function showLockBanner() {
  const el = document.createElement('div'); el.className = 'lockbanner'; el.id = 'lockBanner';
  el.innerHTML = `<div class="card" style="max-width:440px"><h2>Running elsewhere</h2><p class="mut">This prison is open in another tab or on another device. To prevent two simulations running at once, it is paused here.</p><div class="row">${btn('Try again', 'lockRetry', null, 'pri')}${btn('Back to menu', 'quitNoSave', null)}</div><p class="tiny dim mt">If you closed the other window, the hold is released within about 25 seconds.</p></div>`;
  document.getElementById('lockBanner')?.remove(); document.body.appendChild(el);
}
A.lockRetry = async () => { const ok = await Lock.take(S.id); if (ok) { document.getElementById('lockBanner')?.remove(); toast('good', 'Control resumed in this window.'); try { const fresh = await Store.load(S.id); S = fresh; renderShell(); render(); } catch (e) { } } else toast('warn', 'Still open elsewhere. Try again shortly.'); };

/* ================= Game loop ================= */
const SPEEDS = [0, 1, 2, 4, 10, 30];
let lastTick = performance.now(), acc = 0, prevSpeed = 1, hiddenPaused = false;
function setSpeed(v) { if (!S) return; if (Lock.lost && v > 0) return; if (v === 0 && S.speed > 0) { prevSpeed = S.speed; Store.save(S); } S.speed = v; updateHeader(); }
setInterval(() => {
  const now = performance.now(); const dt = Math.min(1000, now - lastTick); lastTick = now;
  if (!S || !S.speed || Lock.lost || document.hidden || !document.getElementById('app') || $('#app').classList.contains('hide')) return;
  acc += dt / 1000 * S.speed;
  const m = Math.floor(acc); if (m <= 0) return; acc -= m;
  const h0 = Math.floor(S.t / 60);
  try { advanceMinutes(m); } catch (e) { console.error(e); setSpeed(0); toast('bad', 'Simulation error: ' + e.message); }
  UI.dirty = true; updateHeader();
  if (Math.floor(S.t / 60) !== h0) liveRender();
}, 100);
setInterval(() => { if (S && UI.dirty && !Lock.lost && !$('#app').classList.contains('hide')) { UI.dirty = false; Store.save(S); } }, 30000);
document.addEventListener('visibilitychange', () => {
  if (!S || $('#app').classList.contains('hide')) return;
  if (document.hidden) { if (S.speed > 0) { hiddenPaused = S.speed; } Store.save(S); }
  else { lastTick = performance.now(); if (Store.mode === 'cloud') Lock.renew(); }
});
window.addEventListener('pagehide', () => { if (S) Store.save(S); });
function dirty() { UI.dirty = true; }
function liveRender() {
  if (UI.modal) { if (UI.prof && !document.activeElement?.closest?.('.modal select,.modal input')) { const t = UI.profTab; openInmate(UI.prof); UI.profTab = t; } return; }
  const ae = document.activeElement; if (ae && ae.closest && ae.closest('main') && /INPUT|SELECT|TEXTAREA/.test(ae.tagName)) return;
  render(true);
}

/* ================= Shell ================= */
function renderShell() {
  $('#hdr').innerHTML = `<button class="hbtn" id="menuBtn" data-a="toggleNav">☰</button>
    <div class="brand"><div class="logo">PM</div><span class="pname">${esc(S.name)}</span></div>
    <div class="clock" id="clk"></div>
    <div class="speeds" id="spd">${SPEEDS.map(v => `<button data-a="speed" data-arg="${v}">${v ? v + 'x' : '❚❚'}</button>`).join('')}</div>
    <div class="hstat hide-m"><span>Balance</span><b id="hBal"></b></div>
    <div class="hstat hide-m"><span>Pop</span><b id="hPop"></b></div>
    <div class="hstat" title="Employees present today / total employed"><span>Staff</span><b id="hStaff"></b></div>
    <div class="grow"></div>
    <span class="tiny dim hide-m" id="saveDot"></span>
    <button class="hbtn" data-a="nav" data-arg="dashboard" title="Notifications">🔔<span class="badge hide" id="hBadge"></span></button>
    <button class="hbtn" data-a="saveNow" title="Save">Save</button>`;
  renderNav(); updateHeader();
}
function renderNav() {
  const open = S.inc.filter(x => x.status === 'Open').length, due = S.inm.filter(i => i.hearing).length;
  $('#nav').innerHTML = NAV.map(([k, l], n) => `<a class="${UI.view === k ? 'on' : ''}" data-a="nav" data-arg="${k}"><span class="n">${String(n + 1).padStart(2, '0')}</span>${l}${k === 'security' && open ? `<span class="cnt">${open}</span>` : ''}${k === 'parole' && due ? `<span class="cnt" style="background:var(--info)">${due}</span>` : ''}${k === 'intake' && S.queue.length ? `<span class="cnt" style="background:var(--warn);color:#111">${S.queue.length}</span>` : ''}</a>`).join('');
}
function updateHeader() {
  if (!S || !$('#clk')) return;
  $('#clk').innerHTML = `Day <b>${curDay()}</b> ${DOW[dow()]} <b>${clockStr()}</b>`;
  $('#hBal').textContent = fmt$(S.money); $('#hBal').className = S.money < 0 ? 'bad' : '';
  $('#hPop').textContent = `${S.inm.length}/${totalCapacity()}`;
  const pres = S.staff.filter(s => s.present).length; $('#hStaff').textContent = pres === S.staff.length ? S.staff.length : `${pres}/${S.staff.length}`;
  document.querySelectorAll('#spd button').forEach(b => b.classList.toggle('on', +b.dataset.arg === S.speed));
  const unread = S.notes.filter(n => !n.read && (n.lvl === 'bad' || n.lvl === 'warn')).length;
  const bd = $('#hBadge'); bd.textContent = unread; bd.classList.toggle('hide', !unread);
}
function setSaveDot(s) { const el = $('#saveDot'); if (el) el.textContent = s === 'saving' ? 'Saving…' : s === 'ok' ? 'Saved ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : s === 'err' ? 'Save failed' : ''; }
function render(live) {
  const main = $('#main'); const y = main.scrollTop;
  try { main.innerHTML = V[UI.view](); } catch (e) { console.error(e); main.innerHTML = `<div class="alert bad">Error rendering view: ${esc(e.message)}</div>`; }
  if (live) main.scrollTop = y; else main.scrollTop = 0;
  renderNav();
}

/* ================= Event delegation ================= */
document.addEventListener('click', e => {
  const tp = e.target.closest('[data-tp]'); if (tp) { const [id, d] = tp.dataset.tp.split('|'); TS[id].page = Math.max(0, TS[id].page + +d); rerenderTable(id); return; }
  const ts = e.target.closest('[data-ts]'); if (ts) { const [id, k] = ts.dataset.ts.split('|'); const st = TS[id]; if (st.sort === +k) st.dir *= -1; else { st.sort = +k; st.dir = 1; } rerenderTable(id); return; }
  const t = e.target.closest('[data-a]'); if (!t || t.disabled) return;
  if (t.tagName === 'TR' && e.target.closest('select,input,button,textarea,label,a')) return;
  const f = A[t.dataset.a]; if (f) { e.preventDefault(); f(t.dataset.arg, t, e); }
});
document.addEventListener('change', e => { const t = e.target;
  if (t.dataset.tf) { const [id, k] = t.dataset.tf.split('|'); TS[id].f[k] = t.value; TS[id].page = 0; rerenderTable(id); return; }
  if (t.dataset.c && C[t.dataset.c]) C[t.dataset.c](t.value, t, t.dataset.arg);
});
document.addEventListener('input', e => { const t = e.target;
  if (t.dataset.tq) { TS[t.dataset.tq].q = t.value; TS[t.dataset.tq].page = 0; rerenderTable(t.dataset.tq); return; }
  if (t.dataset.c === 'bName' || t.dataset.c === 'ngName') C[t.dataset.c](t.value, t);
});
document.addEventListener('keydown', e => {
  if (e.target.closest && e.target.closest('input,select,textarea')) return;
  if (!S || $('#app').classList.contains('hide')) return;
  if (e.key === ' ') { e.preventDefault(); setSpeed(S.speed ? 0 : prevSpeed || 1); }
  if (e.key >= '1' && e.key <= '5') setSpeed(SPEEDS[+e.key]);
  if (e.key === 'Escape' && UI.modal) closeModal();
});
$('#modalBg').addEventListener('click', e => { if (e.target.id === 'modalBg') closeModal(); });
window.addEventListener('hashchange', () => { const v = location.hash.slice(1); if (S && V[v] && v !== UI.view) { UI.view = v; render(); } });

A.closeModal = () => closeModal();
A.nav = v => { if (!V[v]) return; UI.view = v; try { history.replaceState(null, '', '#' + v); } catch (e) { } $('#nav').classList.remove('open'); render(); };
A.toggleNav = () => $('#nav').classList.toggle('open');
A.speed = v => setSpeed(+v);
A.readAll = () => { S.notes.forEach(n => n.read = true); updateHeader(); render(true); };
A.seg = arg => {
  const [k, v] = arg.split('|');
  if (k.startsWith('rec_')) { const i = getInm(k.slice(4)); if (i) i.recommend = +v; }
  else if (k.startsWith('ng_')) { UI.ng[k.slice(3)] = v; renderMenu(); return; }
  else S.settings[k] = v;
  dirty(); render(true);
};
A.saveNow = async () => { await Store.save(S); if (Store.mode !== 'none') toast('good', 'Saved.'); else toast('warn', 'Saving is unavailable here — use Export save code in Administration.'); };
A.quit = async () => { setSpeed(0); await Store.save(S); exitToMenu(); };
A.quitNoSave = () => { exitToMenu(); };
function exitToMenu() { Lock.release(); document.getElementById('lockBanner')?.remove(); S = null; closeModal(); $('#app').classList.add('hide'); showMenu(); }
A.deletePrison = () => confirmBox('Delete prison', `Permanently delete <b>${esc(S.name)}</b> and all its records? This cannot be undone.`, 'Delete', async () => { const id = S.id; S.speed = 0; Lock.release(); await Store.del(id); S = null; $('#app').classList.add('hide'); showMenu(); toast('info', 'Prison deleted.'); }, true);
A.importOk = async () => {
  try { const st = decodeSave($('#imp').value); st.id = uid(); st.speed = 0; st.name = st.name + ' (imported)'; closeModal(); const cur = S; S = st; await Store.save(st); S = cur; toast('good', `Imported "${st.name}". Find it in the main menu.`); if (!S) showMenu(); }
  catch (e) { toast('bad', 'Invalid save code.'); }
};

/* ================= Main menu ================= */
let SLOTS = null;
async function showMenu() {
  $('#menu').classList.remove('hide'); renderMenu();
  try { SLOTS = await Store.list(); } catch (e) { console.error(e); SLOTS = []; toast('bad', 'Could not load saves: ' + (e.message || e.code)); }
  renderMenu();
}
function renderMenu() {
  UI.ng = UI.ng || { name: 'Blackwater Correctional Facility', mode: 'sandbox', size: 'Medium', pop: 'Male', funds: '500000', staff: 'recommended', intake: 'normal', classes: CLASSES.slice(), overflow: 'queue' };
  const g = UI.ng; const career = g.mode === 'career';
  const cbtn = (k, v, title, desc) => `<button class="${g[k] === v ? 'on' : ''}" data-a="seg" data-arg="ng_${k}|${v}"><b>${title}</b><span>${desc}</span></button>`;
  let h = `<div class="menuBox"><div class="hero"><div class="logo">PM</div><div><h1>Prison Management Simulator</h1><div class="mut">Run a correctional facility: intake, housing, staff, regimes, rehabilitation, parole and the budget.</div></div></div><div class="bars-deco"></div>`;
  h += `<div class="card mb"><div class="spread"><h2>Your prisons</h2><span class="tiny dim">${Store.mode === 'cloud' ? 'Saved to your Claude account' : Store.mode === 'local' ? 'Saved in this browser' : ''}</span></div>`;
  if (SLOTS == null) h += '<div class="mut small">Loading saves…</div>';
  else if (!SLOTS.length) h += '<div class="mut small">No prisons yet. Create your first one below.</div>';
  else h += SLOTS.map(s => `<div class="slot"><div><b>${esc(s.name)}</b><div class="small mut">${s.mode === 'career' ? 'Career' : 'Sandbox'} · Day ${s.day} · ${s.pop}/${s.cap || '?'} inmates · ${fmt$(s.money)} · saved ${new Date(s.updated).toLocaleString()}</div></div><div class="row">${btn('Continue', 'loadSlot', s.slot, 'pri')}${btn('Delete', 'delSlot', s.slot, 'danger sm')}</div></div>`).join('');
  h += `<div class="row mt">${btn('Import save code', 'importSave', null, 'sm')}</div></div>`;
  h += `<div class="card"><h2>New prison</h2>
    <div class="field"><label class="f">Prison name</label><input type="text" data-c="ngName" value="${esc(g.name)}" style="width:100%" maxlength="40"></div>
    <div class="field"><label class="f">Game mode</label><div class="choice" style="grid-template-columns:1fr 1fr">${cbtn('mode', 'sandbox', 'Sandbox', 'Full freedom: choose size, funds and classifications. Everything unlocked.')}${cbtn('mode', 'career', 'Career', 'Start with a small Minimum/Medium prison and unlock facilities through objectives.')}</div></div>
    ${career ? '<div class="alert info">Career starts as a Small prison (50 beds, Minimum + Medium) with $150,000.</div>' : `
    <div class="field"><label class="f">Prison size</label><div class="choice">${cbtn('size', 'Small', 'Small', '50 beds')}${cbtn('size', 'Medium', 'Medium', '150 beds')}${cbtn('size', 'Large', 'Large', '300 beds')}</div></div>
    <div class="field"><label class="f">Security classifications</label>${CLASSES.map(c => `<label class="chk"><input type="checkbox" data-c="ngCls" data-arg="${c}"${g.classes.includes(c) ? ' checked' : ''}> ${CLS_LABEL[c]}</label>`).join('')}</div>
    <div class="field"><label class="f">Starting funds</label>${seg('ng_funds', g.funds, [['250000', '$250k'], ['500000', '$500k'], ['1000000', '$1M'], ['5000000', '$5M']])}</div>`}
    <div class="grid g3"><div class="field"><label class="f">Population</label>${seg('ng_pop', g.pop, [['Male', 'Male'], ['Female', 'Female']])}</div>
    <div class="field"><label class="f">Starting employees</label>${seg('ng_staff', g.staff, [['recommended', 'Recommended'], ['minimal', 'Minimal'], ['none', 'None']])}</div>
    <div class="field"><label class="f">Daily intake</label>${seg('ng_intake', g.intake, [['low', 'Low'], ['normal', 'Normal'], ['high', 'High']])}</div></div>
    <div class="field"><label class="f">When beds are full</label>${seg('ng_overflow', g.overflow, [['queue', 'Hold in pending queue'], ['reject', 'Redirect elsewhere']])}</div>
    <div class="spread mt"><span class="tiny dim">${Store.describe()}</span>${btn('Create prison', 'startGame', null, 'pri')}</div></div>`;
  h += `<p class="tiny dim center mt">Tip: press Space to pause/resume and keys 1–5 to change speed. At 1x, one real second is one in-game minute.</p></div>`;
  $('#menu').innerHTML = h;
}
C.ngName = v => { UI.ng.name = v; };
C.ngCls = (v, el, c) => { const s = UI.ng.classes; if (el.checked) { if (!s.includes(c)) s.push(c); } else if (s.length > 1) UI.ng.classes = s.filter(x => x !== c); else el.checked = true; };
A.startGame = async () => {
  const g = UI.ng; const career = g.mode === 'career';
  const size = career ? 'Small' : g.size;
  const mult = { low: .6, normal: 1, high: 1.6 }[g.intake];
  const base = { Small: { Minimum: 3, Medium: 4, Maximum: 2, Supermax: 1, Protective: 1 }, Medium: { Minimum: 3, Medium: 5, Maximum: 2, Supermax: 1, Protective: 1 }, Large: { Minimum: 6, Medium: 8, Maximum: 4, Supermax: 2, Protective: 1 } }[size];
  const intake = {}; CLASSES.forEach(c => intake[c] = Math.max(c === 'Supermax' || c === 'Protective' ? 0 : 1, Math.round(base[c] * mult)));
  const cfg = { name: (g.name || 'New Prison').trim().slice(0, 40), mode: g.mode, size, pop: g.pop, funds: career ? 150000 : +g.funds, staff: g.staff, classes: career ? null : CLASSES.filter(c => g.classes.includes(c)), intake, overflow: g.overflow };
  newState(cfg);
  UI.view = 'dashboard'; UI.build = null; for (const k in TS) delete TS[k];
  await Store.save(S);
  await enterGame();
};
A.loadSlot = async slot => {
  $('#menu').innerHTML = '<div class="menuBox center mut">Loading prison…</div>';
  try { S = await Store.load(slot); migrate(S); S.speed = 0; for (const k in TS) delete TS[k]; UI.view = 'dashboard'; UI.build = null; await enterGame(); }
  catch (e) { console.error(e); toast('bad', 'Could not load: ' + (e.message || e.code)); S = null; renderMenu(); }
};
A.delSlot = slot => { const s = SLOTS.find(x => x.slot === slot); confirmBox('Delete prison', `Permanently delete <b>${esc(s ? s.name : slot)}</b>? This cannot be undone.`, 'Delete', async () => { await Store.del(slot); showMenu(); }, true); };
async function enterGame() {
  $('#menu').classList.add('hide'); $('#app').classList.remove('hide');
  renderShell(); const v = location.hash.slice(1); if (V[v]) UI.view = v; render();
  const ok = await Lock.take(S.id); if (!ok) Lock.onLost();
}
function migrate(st) {
  // forward-compatible defaults for older saves
  st.settings = Object.assign({ intakeOn: true, overflow: 'queue', queueMax: 40, queueDays: 5, autoReorder: true, reorderDays: 5, autoHandle: 'moderate', searches: 'weekly', screening: 'standard', autoJobs: true, autoEnroll: true, paroleMode: 'review' }, st.settings);
  st.today = st.today || blankDay(); st.inspections = st.inspections || []; st.reports = st.reports || [];
  if (!st.sched.Protective) st.sched.Protective = defaultSchedule('Protective');
  ['intake', 'funding'].forEach(k => { if (st.settings[k].Protective == null) st.settings[k].Protective = k === 'intake' ? 0 : DEFAULT_FUNDING.Protective; });
  if (st.yards == null) { st.yards = Math.max(1, Math.ceil(sum(st.blocks, b => sum(b.cells, c => c.beds)) / 150)); CLASSES.forEach(c => { const s = st.sched[c]; const k = s.indexOf('Recreation'); if (k >= 0 && !s.includes('Yard')) s[k] = 'Yard'; }); }
  if (!st.weather) st.weather = 'Clear';
  if (st.mode !== 'career' && !st.unlock.classes.includes('Protective')) st.unlock.classes.push('Protective');
}

/* ================= Boot ================= */
(async function boot() {
  $('#menu').classList.remove('hide');
  $('#menu').innerHTML = '<div class="menuBox center mut">Connecting…</div>';
  await Store.init();
  showMenu();
})();
window.__psim = { get S() { return S; }, advanceMinutes: m => advanceMinutes(m), render: () => render(true) };
