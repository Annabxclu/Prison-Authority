/* ================= Simulation engine ================= */
function shiftOf(h) { return h >= 6 && h < 18 ? 'Day' : 'Night'; }

/* Officer coverage per block for a shift: on-duty assigned officers / required */
function officersRequired(b, shift) {
  const occ = blockOcc(b); if (!occ) return 0;
  const r = Math.ceil(occ / OFFICER_RATIO[b.cls]);
  return shift === 'Night' ? Math.max(1, Math.ceil(r / 2)) : r;
}
function blockCoverage(b, shift) {
  const req = officersRequired(b, shift); if (!req) return 1;
  const on = S.staff.filter(s => s.role === 'Correctional Officer' && s.assign === b.id && s.shift === shift && s.present);
  const eff = sum(on, s => .85 + s.perf / 650); // ~0.9..1.0
  // Unassigned officers on this shift float and help at 50%
  return clamp(eff / req, 0, 1.2);
}
function floatingHelp(shift) {
  return S.staff.filter(s => s.role === 'Correctional Officer' && !s.assign && s.shift === shift && s.present).length;
}
function computeCoverage(shift) {
  const res = {};
  let floatPool = floatingHelp(shift) * .5;
  const open = S.blocks.filter(b => b.status !== 'Construction' && b.status !== 'Closed');
  open.forEach(b => res[b.id] = blockCoverage(b, shift));
  // distribute floaters to worst blocks
  const sorted = open.slice().sort((a, b) => res[a.id] - res[b.id]);
  for (const b of sorted) {
    if (floatPool <= 0) break;
    const req = officersRequired(b, shift); if (!req || res[b.id] >= 1) continue;
    const need = (1 - res[b.id]) * req; const give = Math.min(need, floatPool);
    res[b.id] += give / req; floatPool -= give;
  }
  return res;
}
function avgCoverage() {
  const d = computeCoverage('Day'), n = computeCoverage('Night');
  const bl = S.blocks.filter(b => blockOcc(b) > 0 && d[b.id] != null);
  if (!bl.length) return 1;
  return sum(bl, b => (Math.min(1, d[b.id]) * 2 + Math.min(1, n[b.id])) / 3 * blockOcc(b)) / sum(bl, blockOcc);
}

/* Support staffing requirements */
function requirements() {
  const pop = S.inm.length, beds = totalCapacity();
  const kitchenInm = S.inm.filter(i => i.job === 'Kitchen').length;
  const offReq = sum(S.blocks, b => officersRequired(b, 'Day') + officersRequired(b, 'Night'));
  return {
    'Correctional Officer': offReq,
    'Medical Staff': Math.ceil(pop / 40),
    'Kitchen Worker': Math.max(pop ? 1 : 0, Math.ceil(Math.max(0, pop - kitchenInm * 15) / 40)),
    'Maintenance Worker': Math.ceil(beds / 75),
    'Administrator': Math.max(1, Math.ceil(sum(CLASSES, c => S.settings.intake[c]) / 25)),
    'Teacher': Math.ceil(enrolledFor('Teacher') / 15),
    'Psychologist': Math.ceil(enrolledFor('Psychologist') / 11),
    'Rehabilitation Specialist': Math.ceil(enrolledFor('Rehabilitation Specialist') / 13),
    'Psychiatrist': Math.ceil(S.inm.filter(i => i.cls === 'Insane' || i.cls === 'DeathRow').length / 15),
    'Warden': pop >= 80 ? 1 : 0
  };
}
function enrolledFor(role) { return S.inm.filter(i => i.prog && PROGRAMS[i.prog].role === role).length; }
function kitchenCapacity() {
  const k = S.staff.filter(s => s.role === 'Kitchen Worker' && s.present);
  return Math.round(sum(k, s => 40 * (.8 + s.perf / 500))) + S.inm.filter(i => i.job === 'Kitchen' && i.disc !== 'Solitary').length * 15;
}
function intakeCapacity() { return 15 + staffCount('Administrator', true) * 25; }
function mealCost() { return { Basic: 2.0, Standard: 2.8, Quality: 4.0 }[S.settings.mealQuality]; }
function mealsPerDay() { return Math.max(1, Math.round(avg(CLASSES.filter(c => S.inm.some(i => i.cls === c)), c => S.sched[c].filter(a => a === 'Meal').length) || 3)); }
function dailyFoodUse() { return S.inm.length * mealsPerDay(); }
function avgNeed(k, list = S.inm) { return list.length ? avg(list, i => i.n[k]) : 0; }
function satisfaction(i) { const n = i.n; return (n.hunger + n.hygiene + n.rec + n.health + n.social + n.comfort + n.safety + (100 - n.stress)) / 8; }

/* Funding */
function compliance() {
  const cov = Math.min(1, avgCoverage());
  const req = requirements();
  const support = ['Medical Staff', 'Kitchen Worker', 'Maintenance Worker'].map(r => req[r] ? Math.min(1, staffCount(r) / req[r]) : 1);
  let c = .8 + .15 * cov + .05 * avg(support);
  if (S.unlock.bonus && S.lastInspection && S.lastInspection.score >= 80 && curDay() - S.lastInspection.d <= 30) c += .05;
  return Math.round(c * 1000) / 1000;
}
function fundingBreakdown() {
  const c = compliance();
  return CLASSES.map(cls => { const n = S.inm.filter(i => i.cls === cls).length; return { cls, n, rate: S.settings.funding[cls], total: n * S.settings.funding[cls] * c }; }).concat([{ comp: c }]);
}

/* ---------- Intake ---------- */
function processIntake() {
  const T = S.today.intake;
  let capLeft = intakeCapacity();
  // queue first
  const stillQ = [];
  for (const i of S.queue) {
    if (capLeft > 0) { const spot = findBed(i.cls); if (spot) { place(i, spot.b, spot.c); i.loc = 'Cell'; S.inm.push(i); ihist(i, `Admitted from pending queue to ${cellLabel(i)}.`); T.fromQueue++; capLeft--; afterAdmit(i); continue; } }
    stillQ.push(i);
  }
  S.queue = stillQ;
  if (!S.settings.intakeOn) return intakeSummary();
  for (const cls of CLASSES) {
    if (!S.unlock.classes.includes(cls)) continue;
    const v = +S.settings.intake[cls] || 0; const n = Math.floor(v) + (rnd() < v % 1 ? 1 : 0);
    for (let k = 0; k < n; k++) {
      const i = genInmate(cls);
      T.recv[cls] = (T.recv[cls] || 0) + 1;
      const spot = capLeft > 0 ? findBed(cls) : null;
      if (spot) { place(i, spot.b, spot.c); i.loc = 'Cell'; S.inm.push(i); ihist(i, `Assigned to ${cellLabel(i)}.`); capLeft--; afterAdmit(i); }
      else if (S.settings.overflow === 'queue' && S.queue.length < S.settings.queueMax) { i.queued = curDay(); i.loc = 'Pending intake'; S.queue.push(i); T.queued++; if (capLeft <= 0 && !T.limited.includes('processing')) T.limited.push('processing'); else if (!T.limited.includes(cls)) T.limited.push(cls); }
      else { T.rejected++; S.seq.inm; if (!T.limited.includes(cls)) T.limited.push(cls); }
    }
  }
  intakeSummary();
}
function afterAdmit(i) {
  S.arrivals.unshift(i.id); if (S.arrivals.length > 40) S.arrivals.length = 40;
  if (S.settings.autoJobs) tryAssignJob(i);
  if (S.settings.autoEnroll) tryEnroll(i);
  // initial relationships with blockmates of same gang
  if (i.gang) { const mates = S.inm.filter(x => x.blk === i.blk && x.gang === i.gang && x.id !== i.id).slice(0, 2); mates.forEach(m => befriend(i, m)); }
}
function intakeSummary() {
  const T = S.today.intake;
  const recv = sum(Object.values(T.recv));
  const parts = CLASSES.filter(c => T.recv[c]).map(c => `${T.recv[c]} ${c}`).join(', ');
  const admitted = recv - T.queued - T.rejected + T.fromQueue;
  let msg = `Intake: ${recv} received${parts ? ' (' + parts + ')' : ''}. ${admitted} admitted`;
  if (T.fromQueue) msg += ` (${T.fromQueue} from queue)`;
  if (T.queued) msg += `, ${T.queued} placed in pending queue`;
  if (T.rejected) msg += `, ${T.rejected} redirected to other facilities`;
  msg += `. Free beds: ${CLASSES.filter(c => S.unlock.classes.includes(c)).map(c => CLS_SHORT[c] + ' ' + freeBeds(c)).join(' · ')}.`;
  const lvl = T.rejected || T.queued ? 'warn' : 'info';
  note(lvl, msg);
  if (T.limited.includes('processing')) note('warn', `Intake processing limit reached (${intakeCapacity()}/day). Hire Administrators to process more admissions.`);
}

/* ---------- Jobs & programs ---------- */
function jobFilled(j) { return S.inm.filter(i => i.job === j).length; }
function jobEligible(i, j) { const cfg = S.jobs[j]; return S.unlock.jobs[j] && cfg.on && cfg.elig.includes(i.cls) && i.disc !== 'Solitary' && !i.infirm; }
function tryAssignJob(i) {
  if (i.job) return false;
  const opts = JOB_NAMES.filter(j => jobEligible(i, j) && jobFilled(j) < S.jobs[j].pos);
  if (!opts.length) return false;
  // Hardworking prefer workshop; else most open
  opts.sort((a, b) => (S.jobs[b].pos - jobFilled(b)) - (S.jobs[a].pos - jobFilled(a)));
  setJob(i, opts[0]); return true;
}
function setJob(i, j) {
  if (i.job) { const h = i.jobHist.find(x => x.j === i.job && !x.end); if (h) h.end = curDay(); ihist(i, `Left ${i.job} job.`); }
  i.job = j || null;
  if (j) { i.jobSince = curDay(); i.jobHist.unshift({ j, start: curDay(), end: null }); if (i.jobHist.length > 8) i.jobHist.length = 8; ihist(i, `Started work: ${j} ($${S.jobs[j].wage.toFixed(2)}/hr).`); }
}
function progEnrolled(p) { return S.inm.filter(i => i.prog === p).length; }
function progSeats(p) { return staffCount(PROGRAMS[p].role, true) * PROGRAMS[p].per; }
function progEligible(i, p) { const c = S.progs[p]; return S.unlock.progs[p] && c.on && c.elig.includes(i.cls) && (PROGRAMS[p].repeat || !i.certs.includes(p)); }
function progRoom(p) { return progEnrolled(p) < Math.min(S.progs[p].cap, progSeats(p) || staffCount(PROGRAMS[p].role) * PROGRAMS[p].per); }
/* Inmates choose programs based on their own personality, needs and history */
function programWishes(i) {
  const w = [];
  const add = (p, score, why) => { if (progEligible(i, p) && staffCount(PROGRAMS[p].role) > 0) w.push({ p, score: score + rnd() * 2, why }); };
  const t = x => i.traits.includes(x);
  add('Anger Management', t('Aggressive') ? 6 : i.incCount > 2 ? 3 : 0, t('Aggressive') ? 'wants to control their temper' : 'wants to stay out of trouble');
  add('Substance Recovery', i.charges.some(c => /Drug|alcohol|narcotic/i.test(c)) ? 6 : 0.5, i.charges.some(c => /Drug/i.test(c)) ? 'wants to beat an addiction' : 'curious about recovery support');
  add('Vocational Training', t('Hardworking') ? 5 : i.age < 35 ? 2.5 : 1, t('Hardworking') ? 'wants to learn a trade' : 'wants job skills for release');
  add('Education', t('Introverted') ? 4 : i.age < 26 ? 3.5 : 1.5, i.age < 26 ? 'wants to finish school' : 'enjoys studying');
  add('Counseling', (t('Anxious') ? 4 : 0) + (i.n.stress > 60 ? 3 : 0), i.n.stress > 60 ? 'is struggling with stress' : 'wants someone to talk to');
  add('Life Skills', t('Leadership-oriented') ? 3.5 : remaining(i) < 40 ? 4 : 1.5, remaining(i) < 40 ? 'is preparing for release' : 'wants practical skills');
  add('Psychiatric Treatment', i.cls === 'Insane' ? 7 + (60 - (i.psych || 60)) / 10 : i.cls === 'DeathRow' ? 5 : 0, i.cls === 'Insane' ? 'was referred for ongoing psychiatric care' : 'wants support while facing a death sentence');
  if (t('Manipulative')) w.forEach(x => { x.score += PROGRAMS[x.p].fx.parole / 4; x.why = 'thinks it will impress the parole board'; });
  return w.sort((a, b) => b.score - a.score);
}
function inmateChooses(i) {
  if (i.prog) return false;
  const t = x => i.traits.includes(x);
  if (t('Rebellious') && rnd() < .5) return false; // refuses this time
  if (i.disc === 'Solitary') return false;
  const w = programWishes(i); if (!w.length) return false;
  const top = w[0];
  if (progRoom(top.p)) { setProg(i, top.p, `chose it — ${top.why}`); i.progWant = null; return true; }
  // Top choice full: cooperative/easily influenced inmates settle for second choice, others join the waitlist
  if ((t('Cooperative') || t('Easily influenced')) && w[1] && progRoom(w[1].p)) { setProg(i, w[1].p, `${top.p} was full, settled for this — ${w[1].why}`); i.progWant = null; return true; }
  if (i.progWant !== top.p) { i.progWant = top.p; i.progWhy = top.why; ihist(i, `Applied for ${top.p} (${top.why}); placed on the waitlist.`); }
  return false;
}
function tryEnroll(i) {
  if (i.prog) return false;
  if (S.settings.progChoice !== 'admin') return inmateChooses(i);
  let opts = PROG_NAMES.filter(p => progEligible(i, p) && progEnrolled(p) < Math.min(S.progs[p].cap, progSeats(p) || staffCount(PROGRAMS[p].role) * PROGRAMS[p].per));
  if (!opts.length) return false;
  // Targeted: aggressive → anger mgmt; drug charges → recovery
  const pref = p => (p === 'Anger Management' && i.traits.includes('Aggressive') ? -10 : 0) + (p === 'Substance Recovery' && i.charges.some(c => /Drug/.test(c)) ? -10 : 0) + (p === 'Counseling' && i.n.stress > 60 ? -5 : 0) + progEnrolled(p) / Math.max(1, progSeats(p));
  opts.sort((a, b) => pref(a) - pref(b));
  setProg(i, opts[0]); return true;
}
function setProg(i, p, why) {
  if (i.prog) { i.progHist.unshift({ p: i.prog, start: i.progStart, end: curDay(), hrs: Math.round(i.progHrs), done: false }); ihist(i, `Withdrew from ${i.prog}.`); }
  i.prog = p || null; i.progHrs = 0; i.progStart = curDay(); i.progWhy = p ? (why || 'assigned by administration') : null;
  if (p) { i.progWant = null; ihist(i, `Enrolled in ${p} (${i.progWhy}).`); }
}
function completeProg(i) {
  const p = i.prog, P = PROGRAMS[p];
  i.progHist.unshift({ p, start: i.progStart, end: curDay(), hrs: P.hrs, done: true }); if (i.progHist.length > 10) i.progHist.length = 10;
  if (!i.certs.includes(p)) i.certs.push(p); i.beh = clamp(i.beh + P.fx.beh); i.paroleRec += P.fx.parole;
  if (P.fx.calm && i.traits.includes('Aggressive')) { i.traits[i.traits.indexOf('Aggressive')] = 'Calm'; ihist(i, 'Personality shift: Aggressive → Calm.'); }
  if (P.fx.stress) i.n.stress = clamp(i.n.stress - 20);
  ihist(i, `Completed ${p}. Earned: ${P.cert}.`);
  i.prog = null; i.progHrs = 0;
  S.stats.completions++; S.today.completions++; S.progs[p].completions++;
  if (S.settings.autoEnroll) tryEnroll(i);
}

/* ---------- Relationships ---------- */
function befriend(a, b) { if (a.id === b.id) return; if (!a.friends.includes(b.id) && a.friends.length < 6) a.friends.push(b.id); if (!b.friends.includes(a.id) && b.friends.length < 6) b.friends.push(a.id); a.rivals = a.rivals.filter(x => x !== b.id); b.rivals = b.rivals.filter(x => x !== a.id); }
function rival(a, b) { if (a.id === b.id) return; if (!a.rivals.includes(b.id) && a.rivals.length < 6) a.rivals.push(b.id); if (!b.rivals.includes(a.id) && b.rivals.length < 6) b.rivals.push(a.id); a.friends = a.friends.filter(x => x !== b.id); b.friends = b.friends.filter(x => x !== a.id); }
function affinity(a, b) {
  let s = rnd() * 1.2 - .6;
  for (const [x, y] of TRAIT_CLASH) if ((a.traits.includes(x) && b.traits.includes(y)) || (a.traits.includes(y) && b.traits.includes(x))) s -= .45;
  for (const [x, y] of TRAIT_BOND) if ((a.traits.includes(x) && b.traits.includes(y)) || (a.traits.includes(y) && b.traits.includes(x))) s += .4;
  if (a.gang && b.gang) s += a.gang === b.gang ? .8 : -.9;
  return s;
}
function dailyRelationships() {
  const byBlock = {};
  S.inm.forEach(i => { if (i.blk && i.disc !== 'Solitary' && i.disc !== 'Confined' && !i.infirm) (byBlock[i.blk] = byBlock[i.blk] || []).push(i); });
  for (const bid in byBlock) {
    const list = byBlock[bid]; if (list.length < 2) continue;
    const n = Math.ceil(list.length * .25);
    for (let k = 0; k < n; k++) {
      const a = pick(list), b = pick(list); if (a === b) continue;
      const s = affinity(a, b);
      if (s > .55) befriend(a, b); else if (s < -.6) { rival(a, b); }
    }
    // gang recruitment
    list.filter(i => i.gang && i.traits.includes('Leadership-oriented')).forEach(L => {
      const t = list.find(x => !x.gang && x.traits.includes('Easily influenced') && rnd() < .25);
      if (t) { t.gang = L.gang; befriend(t, L); ihist(t, `Joined ${L.gang} (recruited by ${iname(L)}).`); }
    });
  }
  // reconciliation & prune dead references
  S.inm.forEach(i => { if (i.rivals.length && rnd() < .08) { const r = i.rivals.shift(); const o = getInm(r); if (o) o.rivals = o.rivals.filter(x => x !== i.id); } });
  const ids = new Set(S.inm.map(i => i.id));
  S.inm.forEach(i => { i.friends = i.friends.filter(x => ids.has(x)); i.rivals = i.rivals.filter(x => ids.has(x)); });
}

/* ---------- Hourly simulation ---------- */
let hourFlags = {};
function effectiveAct(i, act, b, cov) {
  if (i.infirm) return 'Infirmary';
  if (i.disc === 'Solitary') return act === 'Sleep' ? 'Sleep' : act === 'Meal' ? 'Meal' : act === 'Shower' && rnd() < .3 ? 'Shower' : 'Solitary';
  if (b.status === 'Lockdown' && !['Sleep', 'Meal', 'Wake'].includes(act)) return 'Lockdown';
  if (act === 'Visits' && !S.settings.visitDays[dow()]) act = 'Free';
  if (act === 'Yard' && S.weather === 'Storm') act = 'Recreation';
  if (i.disc === 'Confined' && !['Sleep', 'Wake', 'Meal', 'Shower'].includes(act)) return 'Confined';
  if (i.disc === 'Restricted' && ['Recreation', 'Yard', 'Free', 'Visits'].includes(act)) return 'Lockdown';
  if (cov < .5 && ['Recreation', 'Yard', 'Free', 'Visits', 'Work', 'Rehab'].includes(act)) { hourFlags.cancel = hourFlags.cancel || {}; hourFlags.cancel[b.id] = true; return 'Lockdown'; }
  if (act === 'Work' && !i.job) return 'Idle';
  if (act === 'Rehab' && !i.prog) return 'Idle';
  return act;
}
const LOC = { Sleep: 'Cell (asleep)', Wake: 'Cell', Meal: 'Dining hall', Work: 'Work assignment', Recreation: 'Gym / day room', Yard: 'Exercise yard', Rehab: 'Program room', Shower: 'Showers', Free: 'Common area', Visits: 'Visitation room', Lockdown: 'Cell (locked)', Idle: 'Cell block', Infirmary: 'Infirmary', Solitary: 'Solitary confinement' };

function hourTick(h) {
  hourFlags = {};
  const shift = shiftOf(h);
  const cov = computeCoverage(shift);
  const T = S.today;
  const libBonus = Math.min(8, jobFilled('Library') * 2.5);
  const laundry = Math.min(1, jobFilled('Laundry') / Math.max(1, S.inm.length / 25));
  const janitor = Math.min(1, jobFilled('Janitorial') / Math.max(1, S.inm.length / 20));
  const maintReq = Math.ceil(totalCapacity() / 75);
  const maintOK = maintReq ? Math.min(1, staffCount('Maintenance Worker', true) / maintReq) : 1;
  const mq = S.settings.mealQuality;

  // meals: determine who eats
  const eaters = S.inm.filter(i => { const b = getBlock(i.blk); return b && effectiveActRaw(i, h) === 'Meal'; });
  let mealSet = null;
  if (eaters.length) {
    const cap = Math.min(kitchenCapacity(), Math.floor(S.food));
    const served = Math.min(cap, eaters.length);
    S.food -= served; T.mealsServed += served; T.foodUsed += served;
    const short = eaters.length - served; T.mealsShort += short;
    mealSet = new Set(shuffle(eaters.slice()).slice(0, served).map(i => i.id));
    if (short > 0) { hourFlags.mealShort = short; }
  }

  // program seats this hour
  const seats = {}; PROG_NAMES.forEach(p => seats[p] = progSeats(p));
  // medical capacity
  let medCap = staffCount('Medical Staff', true) * 6;

  let wages = 0, workshopHrs = 0, yardUsed = 0; const yardCap = (S.yards || 0) * YARD_CAP;
  const yardGP = [], yardPC = [], rolls = [];
  const visitDay = S.settings.visitDays[dow()];
  const blockRivals = {};

  for (const i of S.inm) {
    const b = getBlock(i.blk); if (!b) continue;
    const c = cov[b.id] == null ? 1 : cov[b.id];
    let act = effectiveAct(i, S.sched[i.cls][h], b, c);
    if (act === 'Yard') { if (yardUsed >= yardCap) { act = 'Lockdown'; hourFlags.yardFull = (hourFlags.yardFull || 0) + 1; } else { yardUsed++; (i.cls === 'Protective' ? yardPC : yardGP).push(i); } }
    i.loc = i.disc === 'Solitary' ? 'Solitary confinement' : i.disc === 'Confined' && act !== 'Shower' ? 'Cell (confined)' : (LOC[act] || act);
    const n = i.n;
    // base decay
    const asleep = act === 'Sleep';
    n.hunger -= asleep ? 1.5 : 4.2;
    n.hygiene -= (asleep ? .8 : 2.2) * (b.tier >= 2 ? .8 : 1) * (1 - laundry * .3);
    n.rec -= asleep ? .3 : 2.2;
    n.social -= asleep ? .2 : 1.6;
    n.comfort += (55 + TIERS[b.tier].comfort * 13 + janitor * 6 + (i.friends.length ? 4 : 0) - n.comfort) * .05;
    if (maintOK < 1) n.comfort -= (1 - maintOK) * 1.2;
    switch (act) {
      case 'Meal':
        if (mealSet && mealSet.has(i.id)) { n.hunger += 48 + (mq === 'Quality' ? 8 : mq === 'Basic' ? -6 : 0); n.comfort += mq === 'Quality' ? 3 : mq === 'Basic' ? -2 : 0; n.social += 3; }
        else { n.stress += 6; }
        break;
      case 'Shower': n.hygiene += 55; break;
      case 'Recreation': n.rec += 26 + libBonus; n.social += 7; n.stress -= 3; break;
      case 'Yard': { const w = S.weather === 'Rain' ? .6 : 1; n.rec += 36 * w; n.social += 10 * w; n.stress -= 6 * w; n.health += .6 * w; if (S.weather === 'Rain') n.hygiene -= 3; if (S.weather === 'Clear') n.comfort += 1.5; break; }
      case 'Free': n.social += 14; n.rec += 9 + libBonus / 2; n.stress -= 2; break;
      case 'Work':
        n.rec += 4; n.stress -= 1.5; n.social += 3;
        { const w = S.jobs[i.job].wage; wages += w; i.earn += w; i.bal += w; if (i.job === 'Workshop') workshopHrs++; if (rnd() < .01) i.beh = clamp(i.beh + 1); }
        break;
      case 'Rehab':
        if (seats[i.prog] > 0) { seats[i.prog]--; i.progHrs++; n.stress -= 3; if (i.prog === 'Psychiatric Treatment') { n.stress -= 3; if (i.psych != null) i.psych = clamp(i.psych + 1); } if (i.progHrs >= PROGRAMS[i.prog].hrs) completeProg(i); }
        else { hourFlags.progShort = hourFlags.progShort || {}; hourFlags.progShort[i.prog] = true; }
        break;
      case 'Visits':
        if (visitDay && rnd() < .3) {
          T.visits++; const strict = S.settings.screening === 'strict';
          n.social += strict ? 18 : 28; n.stress -= 8;
          if (rnd() < .25) { const dep = ri(10, 40); itx(i, 'Family deposit', dep); }
          const p = { none: .07, standard: .03, strict: .01 }[S.settings.screening];
          if (rnd() < p) { b.contraband = clamp(b.contraband + 6); if (rnd() < .4) { T.contraband++; incident(i, 'Contraband', 'Contraband intercepted during visitation screening.', 'Moderate', b); } }
        } else { n.social += 6; }
        break;
      case 'Sleep': n.stress -= 1.2; n.health += .25; break;
      case 'Lockdown': n.stress += 1.2; n.rec -= 1; break;
      case 'Confined': n.stress += 1.2; n.rec -= 1.2; n.social -= .5; break;
      case 'Solitary': n.stress += 2.2; n.social -= 2.5; n.rec -= 1.5; break;
      case 'Idle': n.rec -= .5; n.stress += .3; break;
      case 'Infirmary':
        if (medCap > 0) { medCap--; n.health += 4; }
        break;
    }
    // stress dynamics from unmet needs
    const lack = Math.max(0, 35 - n.hunger) + Math.max(0, 30 - n.hygiene) * .5 + Math.max(0, 30 - n.rec) * .6 + Math.max(0, 30 - n.social) * .5 + Math.max(0, 40 - n.comfort) * .4 + Math.max(0, 50 - n.safety) * .6;
    n.stress += lack / 45 - (i.friends.length ? .25 : 0) - (i.traits.includes('Calm') ? .3 : 0) + (i.traits.includes('Anxious') ? .3 : 0);
    n.stress += (42 - n.stress) * .035;
    // safety: driven by coverage, rivals in block, block incidents
    if (blockRivals[i.id] == null) blockRivals[i.id] = i.rivals.filter(r => { const x = getInm(r); return x && x.blk === i.blk; }).length;
    const sTarget = 25 + Math.min(1, c) * 60 - Math.min(20, blockRivals[i.id] * 5) - Math.min(15, b.incidents * 1.5) - b.contraband * .1 + (i.friends.length ? 6 : 0);
    n.safety += (sTarget - n.safety) * .08;
    // health
    if (n.hunger < 15) n.health -= .6;
    if (n.hygiene < 15) n.health -= .3;
    for (const k in n) n[k] = clamp(n[k]);

    // incidents
    if (!asleep && act !== 'Infirmary') rolls.push([i, b, c, act, blockRivals[i.id]]);
  }
  // incidents are rolled after everyone's location for this hour is known
  for (const r of rolls) if (S.inm.includes(r[0])) rollIncident(r[0], r[1], r[2], r[3], r[4]);
  if (yardPC.length && yardGP.length) yardClash(yardPC, yardGP);
  if (wages > 0) accrue(wages, 'Inmate wages');
  if (workshopHrs > 0) { const r = workshopHrs * 11; S.money += r; T.income['Workshop contracts'] = (T.income['Workshop contracts'] || 0) + r; }

  // health events
  for (const i of S.inm) {
    if (!i.infirm && i.n.health < 35) { i.infirm = true; ihist(i, 'Admitted to infirmary (poor health).'); }
    if (i.infirm && i.n.health >= 70) { i.infirm = false; i.sick = false; ihist(i, 'Discharged from infirmary.'); }
  }
  // flags → notes (once per day per type)
  if (hourFlags.mealShort && !T.flagMeal) { T.flagMeal = true; note('bad', `Meal shortage: ${hourFlags.mealShort} inmates went without a meal. ${S.food < S.inm.length ? 'Food inventory is too low.' : 'Kitchen capacity is too low — hire kitchen workers or assign inmate kitchen jobs.'}`, true); }
  if (hourFlags.cancel) for (const bid in hourFlags.cancel) { if (!T.cancelled[bid]) { T.cancelled[bid] = true; const b = getBlock(bid); note('warn', `${b.name}: activities cancelled — fewer than half the required officers on ${shift.toLowerCase()} shift.`); incidentStaffShortage(b); } }
  if (hourFlags.yardFull && !T.flagYard) { T.flagYard = true; note('warn', `Yard over capacity at ${String(h).padStart(2, '0')}:00: ${hourFlags.yardFull} inmates stayed in their cells. Build another exercise yard (Housing) or stagger yard times in Regimes.`); }
  if (hourFlags.progShort && !T.flagProg) { T.flagProg = true; note('warn', `Rehabilitation sessions over capacity: ${Object.keys(hourFlags.progShort).join(', ')}. Some enrolled inmates could not attend — hire more program staff.`); }
  // sample needs for daily average
  if (h % 4 === 0) { T.needSamples++; T.needAcc = T.needAcc || { hunger: 0, hygiene: 0, rec: 0, health: 0, social: 0, comfort: 0, stress: 0, safety: 0, sat: 0 }; for (const k in T.needAcc) T.needAcc[k] += k === 'sat' ? avg(S.inm, satisfaction) : avgNeed(k); }
  if (h === 8) processIntake();
  if (h === 10) dailySearches();
  if (h === 14) canteenSales();
  // decay block incident heat
  S.blocks.forEach(b => b.incidents = Math.max(0, b.incidents - .05));
}
function effectiveActRaw(i, h) {
  if (i.infirm) return 'Infirmary';
  return S.sched[i.cls][h];
}

/* ---------- Incidents ---------- */
function rollIncident(i, b, cov, act, rivalsHere) {
  const n = i.n;
  let p = .0008;
  p *= i.traits.reduce((m, t) => m * TRAITS[t].inc, 1);
  p *= .4 + n.stress / 45;
  p *= 1 + Math.max(0, 1 - cov) * 2.5;
  p *= 1.7 - i.beh / 100;
  p *= CLS_MULT[i.cls];
  p *= { Yard: 1.6, Recreation: 1.4, Free: 1.4, Meal: 1.25, Work: .8, Rehab: .6, Lockdown: .5, Confined: .4, Solitary: .15, Visits: 1.1, Shower: 1.1, Idle: 1.2, Wake: .8 }[act] || 1;
  p *= 1 + rivalsHere * .3 + b.contraband / 120;
  if (i.disc === 'Solitary') p *= .3;
  if (i.cls === 'Insane') p *= 1 + Math.max(0, 55 - (i.psych || 50)) / 10;
  if (i.cls === 'DeathRow' && i.appeal && i.appeal.exec) p *= 1.8;
  if (rnd() < p) {
    if (i.cls === 'Insane') { makeIncident(i, b, wpick([['Psychotic episode', 35 + Math.max(0, 50 - (i.psych || 50))], ['Fight', 18], ['Assault on staff', 14], ['Property damage', 15], ['Argument', 15], ['Refusal to follow instructions', 10]]), cov); return; }
    if (i.cls === 'Protective') { makeIncident(i, b, wpick([['Argument', 40], ['Refusal to follow instructions', 30], ['Property damage', 10], ['Contraband', 10]]), cov); return; }
    const type = wpick([
      ['Argument', 30], ['Refusal to follow instructions', 20 * (i.traits.includes('Rebellious') ? 2 : 1)],
      ['Fight', 13 * (i.traits.includes('Aggressive') ? 2 : 1) * (1 + rivalsHere)], ['Property damage', 9],
      ['Contraband', 6 + b.contraband / 8], ['Assault on staff', 2.5 * (i.traits.includes('Aggressive') ? 2 : 1)],
      ['Attempted escape', .6 * CLS_MULT[i.cls] * (1 + Math.max(0, 1 - cov) * 4) * (i.traits.includes('Manipulative') || i.traits.includes('Rebellious') ? 1.6 : 1)]
    ]);
    makeIncident(i, b, type, cov);
  }
  // positive behaviour
  if ((act === 'Work' || act === 'Rehab') && n.stress < 40 && rnd() < .00045 * (i.beh / 50)) {
    S.today.positive++; i.beh = clamp(i.beh + 3);
    const what = act === 'Work' ? `outstanding work performance in ${i.job}` : `exceptional progress in ${i.prog}`;
    incident(i, 'Positive behavior', `${iname(i)} recognised for ${what}.`, 'Positive', b, true);
  }
  // medical emergency
  if (!i.infirm && rnd() < .00012 * (1 + (100 - n.health) / 25) * (i.age > 50 ? 1.6 : 1)) {
    i.n.health = clamp(i.n.health - ri(25, 45)); i.infirm = true; i.sick = true;
    const sev = i.n.health < 25 ? 'Critical' : 'Major';
    incident(i, 'Medical emergency', `${iname(i)} required emergency medical attention (${pick(['chest pains', 'seizure', 'severe allergic reaction', 'diabetic emergency', 'collapse in cell', 'injury from fall'])}).`, sev, b);
    money(-ri(400, 1600), 'Healthcare', `Emergency treatment ${i.id}`);
  }
}
function makeIncident(i, b, type, cov) {
  let sev = 'Minor', desc = '', others = [];
  // Only inmates physically present with this inmate right now can be involved. Inmates in solitary or the infirmary are isolated.
  const isolated = i.disc === 'Solitary' || i.infirm;
  const mates = isolated ? [] : i.disc === 'Confined' ? S.inm.filter(x => x.id !== i.id && x.blk === i.blk && x.cell === i.cell && /^Cell/.test(x.loc) && x.disc !== 'Solitary') : S.inm.filter(x => x.id !== i.id && x.disc !== 'Solitary' && x.disc !== 'Confined' && !x.infirm && x.loc === i.loc && (x.blk === b.id || /yard|Dining|Program|Work|Visitation/i.test(i.loc)));
  if (!mates.length && type === 'Fight') type = 'Assault on staff';
  switch (type) {
    case 'Argument': {
      const o = mates.find(x => i.rivals.includes(x.id)) || pick(mates); if (o) { others.push(o); if (rnd() < .3) rival(i, o); }
      desc = o ? `Verbal altercation between ${iname(i)} and ${iname(o)}.` : `${iname(i)} involved in a verbal altercation with staff.`; break;
    }
    case 'Refusal to follow instructions': sev = rnd() < .3 ? 'Moderate' : 'Minor'; desc = `${iname(i)} refused direct orders ${pick(['to return to cell', 'during count', 'at work assignment', 'during a search', 'to leave the yard'])}.`; break;
    case 'Fight': {
      const o = mates.find(x => i.rivals.includes(x.id)) || mates.find(x => x.gang && i.gang && x.gang !== i.gang) || pick(mates);
      sev = rnd() < .3 ? 'Major' : 'Moderate';
      if (o) { others.push(o); rival(i, o); const dmg = sev === 'Major' ? ri(15, 35) : ri(5, 15); o.n.health = clamp(o.n.health - dmg); i.n.health = clamp(i.n.health - dmg * .6); o.n.safety = clamp(o.n.safety - 15); }
      desc = o ? `Physical fight between ${iname(i)} and ${iname(o)}${i.gang && o.gang && i.gang !== o.gang ? ` (${i.gang} vs ${o.gang})` : ''}.` : `${iname(i)} assaulted another inmate.`;
      mates.forEach(m => m.n.safety = clamp(m.n.safety - 3)); break;
    }
    case 'Property damage': { sev = 'Moderate'; const cost = ri(150, 1800) * (staffCount('Maintenance Worker') ? 1 : 1.5); money(-cost, 'Maintenance', `Repairs: ${b.name}`); desc = `${iname(i)} damaged ${pick(['cell fixtures', 'a door lock', 'the TV room', 'kitchen equipment', 'a window', 'plumbing'])}. Repair cost ${fmt$(cost)}.`; break; }
    case 'Contraband': sev = rnd() < .3 ? 'Major' : 'Moderate'; desc = `Contraband found on ${iname(i)}: ${pick(['mobile phone', 'homemade weapon', 'narcotics', 'tobacco', 'homemade alcohol', 'unauthorised medication'])}.`; b.contraband = clamp(b.contraband - 5); S.today.contraband++; break;
    case 'Psychotic episode': sev = (i.psych || 50) < 25 ? 'Major' : 'Moderate'; desc = `${iname(i)} suffered a psychotic episode (${pick(['paranoid delusions', 'severe agitation', 'auditory hallucinations', 'barricaded in cell', 'self-neglect and confusion', 'violent outburst'])}).`; i.psych = clamp((i.psych || 50) - 8); mates.forEach(m => m.n.safety = clamp(m.n.safety - 3)); break;
    case 'Assault on staff': sev = 'Major'; desc = `${iname(i)} assaulted a correctional officer.`; { const o = pick(S.staff.filter(s => s.role === 'Correctional Officer' && s.assign === b.id)); if (o) { o.morale = clamp(o.morale - 15); desc = `${iname(i)} assaulted Officer ${o.ln}.`; } } break;
    case 'Attempted escape': {
      sev = 'Critical';
      const succ = rnd() < .22 * Math.max(.05, 1.15 - cov) * (b.tier === 1 ? 1.2 : 1);
      if (succ) { escape(i, b); return; }
      desc = `${iname(i)} attempted to escape from ${b.name} and was stopped by staff.`; break;
    }
  }
  incident(i, type, desc, sev, b, false, others);
}
function incident(i, type, desc, sev, b, positive, others = []) {
  const T = S.today;
  const inc = { id: 'INC-' + String(S.seq.inc++).padStart(5, '0'), t: S.t, type, sev, desc, who: i.id, whoName: iname(i), others: others.map(o => o.id), blk: b ? b.id : null, blkName: b ? b.name : '', status: 'Open', action: null };
  if (positive) { inc.status = 'Recorded'; inc.action = 'Commendation'; }
  else {
    if (T.inc[sev] != null) T.inc[sev]++;
    i.incCount++; i.lastInc = curDay(); i.beh = clamp(i.beh - ({ Minor: 2, Moderate: 4, Major: 7, Critical: 12 }[sev] || 0));
    if (b) b.incidents += { Minor: .5, Moderate: 1, Major: 2, Critical: 3 }[sev];
    if (sev === 'Minor' && type !== 'Medical emergency') { inc.status = 'Closed'; inc.action = 'Logged'; if (i.disc === 'Good') i.disc = 'Warning'; }
    else if (type === 'Medical emergency') { if (staffCount('Medical Staff', true)) { inc.status = 'Closed'; inc.action = 'Treated by medical staff'; } }
    else if (S.settings.autoHandle === 'all' || (S.settings.autoHandle === 'moderate' && sev === 'Moderate')) { applySanctions(inc, standardSanctions(inc), true); }
    if (inc.status === 'Open') note(sev === 'Critical' ? 'bad' : 'warn', `${sev} incident (${type}) in ${b ? b.name : 'facility'}: ${desc} Action required.`, sev === 'Critical');
  }
  ihist(i, `${positive ? 'Commendation' : 'Incident ' + inc.id}: ${type}${positive ? '' : ' (' + sev + ')'}.`);
  others.forEach(o => ihist(o, `Involved in ${inc.id}: ${type}.`));
  S.inc.unshift(inc);
  if (S.inc.length > 500) { const open = S.inc.filter(x => x.status === 'Open'); S.inc = S.inc.filter(x => x.status !== 'Open').slice(0, 450).concat(open).sort((a, b) => b.t - a.t); }
  return inc;
}
function incidentStaffShortage(b) {
  const inc = { id: 'INC-' + String(S.seq.inc++).padStart(5, '0'), t: S.t, type: 'Staff shortage', sev: 'Moderate', desc: `${b.name} operating below minimum officer coverage; scheduled activities cancelled.`, who: null, whoName: '—', others: [], blk: b.id, blkName: b.name, status: 'Closed', action: 'Logged' };
  S.inc.unshift(inc); S.today.inc.Moderate++;
}
function escape(i, b) {
  S.stats.escapes++; S.today.escapes++; S.stats.lastEscapeDay = curDay();
  const fine = { Minimum: 10000, Medium: 20000, Maximum: 40000, Supermax: 80000 }[i.cls];
  const inc = incident(i, 'Escape', `${iname(i)} (${i.cls}) ESCAPED from ${b.name}. State penalty ${fmt$(fine)}.`, 'Critical', b);
  inc.status = 'Closed'; inc.action = 'Manhunt initiated';
  money(-fine, 'Penalties', `Escape penalty ${i.id}`);
  S.inm.forEach(x => { if (x.blk === b.id) x.n.safety = clamp(x.n.safety - 10); });
  releaseInmate(i, 'Escaped');
  note('bad', `ESCAPE: ${iname(i)} (${i.id}) escaped from ${b.name}. Penalty ${fmt$(fine)}. Review officer coverage.`, true);
}
const SANCTIONS = {
  'Verbal warning': { beh: -2, d: 'Formal warning recorded' },
  'Fine': { beh: -2, fine: 25, d: 'Deduct $25 from the inmate account' },
  'Restitution': { beh: -3, fine: 60, d: 'Inmate pays up to $60 toward damages' },
  'Loss of job': { beh: -4, job: true, d: 'Removed from work assignment' },
  'Loss of privileges': { beh: -5, days: 3, dur: true, disc: 'Restricted', d: 'No yard, recreation, free time or visits' },
  'Cell lockdown': { beh: -6, days: 3, dur: true, disc: 'Confined', stress: 6, d: 'Confined to own cell all day: meals in cell, no work, programs, yard, recreation or visits' },
  'Solitary confinement': { beh: -8, days: 5, dur: true, disc: 'Solitary', stress: 15, d: 'Held in segregation' },
  'Psychiatric observation': { beh: 0, days: 2, dur: true, disc: 'Restricted', psych: 18, cost: 200, d: 'Observation and medication review (helps unstable inmates)' },
  'Investigation': { cost: 300, d: 'Officers investigate: may uncover contraband and gang activity' },
  'Medical evaluation': { cost: 250, d: 'Send to infirmary for assessment' },
  'Refer for prosecution': { beh: -12, sent: [20, 90], d: 'Adds 20–90 days to sentence' },
  'Dismiss': { d: 'Close without sanction' }
};
const DISC_RANK = { Good: 0, Warning: 1, Restricted: 2, Confined: 3, Solitary: 4 };
const DISC_SANCTION = { Restricted: 'Loss of privileges', Confined: 'Cell lockdown', Solitary: 'Solitary confinement' };
function polList(t) { const p = S.settings.disc && S.settings.disc[t]; if (!p) return null; const l = Array.isArray(p) ? p : [p]; return l.filter(x => x && SANCTIONS[x.s]); }
/* The list of punishments the policy gives this incident (several can be combined) */
function standardSanctions(inc) { const l = polList(inc.type); if (l && l.length) return l.map(x => ({ s: x.s, days: x.days || 0 })); return [{ s: standardSanction(inc), days: 0 }]; }
function applySanctions(inc, list, auto) {
  if (!list || !list.length) list = [{ s: 'Verbal warning' }];
  if (list.some(x => x.s === 'Dismiss')) list = [{ s: 'Dismiss' }];
  inc._link = '';
  const labels = list.map(x => applySanction(inc, x.s, x.days));
  inc.status = 'Closed'; inc.action = labels.join(' + ') + (auto ? ' (auto)' : '') + (inc._link || ''); delete inc._link;
}
/* Recompute an inmate's disciplinary status from all punishments they are serving */
function recomputeDisc(i) {
  const d = curDay(); i.pun = (i.pun || []).filter(p => d < p.until);
  if (i.pun.length) { const top = i.pun.reduce((a, p) => DISC_RANK[p.disc] > DISC_RANK[a.disc] ? p : a); i.disc = top.disc; i.discUntil = Math.max(...i.pun.map(p => p.until)); }
  else if (DISC_RANK[i.disc] >= 2) { i.disc = d - i.lastInc < 14 ? 'Warning' : 'Good'; i.discUntil = d; }
}
function standardSanction(inc) {
  if (inc.type === 'Contraband') return 'Investigation';
  if (inc.type === 'Medical emergency') return 'Medical evaluation';
  if (inc.sev === 'Critical') return inc.type === 'Attempted escape' ? 'Refer for prosecution' : 'Solitary confinement';
  if (inc.sev === 'Major') return 'Solitary confinement';
  return 'Loss of privileges';
}
function sanctionDays(inc, s, days) {
  const X = SANCTIONS[s]; if (!X.dur) return 0;
  let d = days || X.days;
  if (S.settings.escalate && (inc.sev === 'Major' || inc.sev === 'Critical')) d *= 2;
  return d;
}
function applySanction(inc, s, days) {
  const i = getInm(inc.who); const X = Object.assign({}, SANCTIONS[s]);
  if (X.dur) X.days = sanctionDays(inc, s, days);
  const label = s + (X.dur ? ` (${X.days}d)` : '');
  if (!i) return label;
  if (X.fine) { const a = Math.min(Math.max(0, i.bal), X.fine); if (a > 0) itx(i, `${s} for ${inc.id}`, -a); }
  if (X.job && i.job) setJob(i, null);
  if (X.psych && i.psych != null) i.psych = clamp(i.psych + X.psych);
  if (X.cost) money(-X.cost, s === 'Investigation' ? 'Security operations' : 'Healthcare', `${s} ${inc.id}`);
  if (X.beh) i.beh = clamp(i.beh + X.beh);
  if (X.disc) { i.pun = i.pun || []; i.pun.push({ s, disc: X.disc, until: curDay() + X.days, inc: inc.id }); recomputeDisc(i); if (X.disc === 'Solitary' && i.job) setJob(i, null); }
  if (X.stress) i.n.stress = clamp(i.n.stress + X.stress);
  if (X.sent) { const add = ri(X.sent[0], X.sent[1]); i.release += add; i.parole += Math.round(add * PAROLE_FRAC[i.cls]); i.sent += add; ihist(i, `Sentence extended by ${add} days (prosecution).`); }
  if (s === 'Investigation') {
    const b = getBlock(inc.blk);
    if (b) b.contraband = clamp(b.contraband - 15);
    if (i.gang && rnd() < .5) { const members = S.inm.filter(x => x.gang === i.gang && x.blk === i.blk); members.forEach(m => { m.beh = clamp(m.beh - 2); }); inc._link = ` — linked to ${i.gang}`; }
  }
  if (s === 'Medical evaluation') { i.infirm = true; }
  if (s !== 'Dismiss') ihist(i, `Sanction for ${inc.id}: ${s}${X.dur ? ' for ' + X.days + ' days' : ''}.`);
  if (s === 'Dismiss') { i.beh = clamp(i.beh + 2); }
  return label;
}

function dailySearches() {
  const m = S.settings.searches; if (m === 'off') return;
  if (m === 'weekly' && dow() !== 0) return;
  S.blocks.filter(b => blockOcc(b)).forEach(b => {
    const cost = blockOcc(b) * (m === 'daily' ? 2 : 4);
    accrue(cost, 'Security operations');
    const found = rnd() < b.contraband / 60;
    b.contraband = clamp(b.contraband - (m === 'daily' ? 6 : 18));
    if (found) { const mates = S.inm.filter(i => i.blk === b.id); const i = pick(mates); if (i) { S.today.contraband++; incident(i, 'Contraband', `Cell search in ${b.name} found ${pick(['a mobile phone', 'a homemade weapon', 'narcotics', 'homemade alcohol', 'tobacco'])} in ${iname(i)}'s cell.`, 'Moderate', b); } }
    S.inm.forEach(i => { if (i.blk === b.id) i.n.stress = clamp(i.n.stress + (m === 'daily' ? 1 : 2)); });
  });
}
function canteenSales() {
  const w = jobFilled('Canteen'); if (!w) return;
  let rev = 0; const max = w * 40; let n = 0;
  for (const i of shuffle(S.inm.slice())) { if (n >= max) break; if (i.bal > 6 && rnd() < .3 && i.disc !== 'Solitary') { const a = Math.min(i.bal, ri(2, 9)); itx(i, 'Canteen purchase', -a); i.n.comfort = clamp(i.n.comfort + 6); rev += a * .25; n++; } }
  if (rev) { S.money += rev; S.today.income['Canteen sales'] = (S.today.income['Canteen sales'] || 0) + rev; }
}

/* ---------- Parole & release ---------- */
function paroleScore(i) {
  const recent = S.inc.filter(x => x.who === i.id && x.sev !== 'Minor' && x.status !== 'Recorded' && curDay(x.t) > curDay() - 30).length;
  let s = 40 + (i.beh - 50) * .6 + i.paroleRec - recent * 12 - i.sev * 4 - i.priors * 2;
  if (i.job) s += 6 + Math.min(8, (curDay() - i.jobSince) / 5);
  if (i.disc === 'Solitary') s -= 20; else if (i.disc === 'Confined') s -= 14; else if (i.disc === 'Restricted') s -= 10;
  s += i.recommend || 0;
  if (i.cls === 'Insane') s += ((i.psych || 0) - 55) * .5;
  return Math.round(clamp(s, 0, 100));
}
function holdHearing(i) {
  const s = paroleScore(i); i.hearings++;
  let out;
  if (s >= 60) out = 'Approved'; else if (s >= 45) out = 'Continued'; else out = 'Denied';
  // probabilistic softening
  if (out === 'Continued' && rnd() < .3) out = s >= 52 ? 'Approved' : 'Denied';
  i.hearing = null; i.recommend = 0;
  S.reports.unshift({ d: curDay(), id: i.id, name: iname(i), cls: i.cls, score: s, out }); if (S.reports.length > 200) S.reports.length = 200;
  if (out === 'Approved') { S.stats.paroleApproved++; S.today.paroleA++; ihist(i, `Parole board: APPROVED (score ${s}).`); releaseInmate(i, 'Paroled'); }
  else if (out === 'Continued') { S.today.paroleC++; i.parole = curDay() + 10; ihist(i, `Parole board: continued for review in 10 days (score ${s}).`); }
  else { S.stats.paroleDenied++; S.today.paroleD++; i.parole = curDay() + 30; ihist(i, `Parole board: DENIED (score ${s}). Next eligibility in 30 days.`); }
  return out;
}
function releaseInmate(i, why) {
  vacate(i); if (i.job) setJob(i, null);
  S.inm = S.inm.filter(x => x.id !== i.id);
  S.released.unshift({ id: i.id, name: iname(i), cls: i.cls, adm: i.adm, out: curDay(), why, served: served(i), sent: i.sent, certs: i.certs.length, incidents: i.incCount });
  if (S.released.length > 600) S.released.length = 600;
  if (why === 'Paroled' || why === 'Sentence complete') { S.stats.releases++; S.today.releases++; }
}

/* ---------- Daily processing ---------- */
function dayTick() {
  const d = curDay(); // new day number
  const T = S.today;
  // --- Finance for the day just ended
  const fb = fundingBreakdown(); const comp = fb.pop().comp;
  const fund = sum(fb, x => x.total);
  if (fund > 0) money(fund, 'Government funding', `Daily operating funding (${S.inm.length} inmates × compliance ${comp.toFixed(3)})`);
  const payroll = sum(S.staff, s => s.sal / 365);
  if (payroll) money(-payroll, 'Payroll', `Payroll: ${S.staff.length} employees`);
  const beds = totalCapacity(), pop = S.inm.length;
  const util = sum(S.blocks.filter(b => b.status !== 'Construction'), b => blockCap(b) * TIERS[b.tier].util) + pop * 1;
  money(-util, 'Utilities', 'Utilities');
  const maintReq = Math.ceil(beds / 75); const maintOK = maintReq ? Math.min(1, staffCount('Maintenance Worker') / maintReq) : 1;
  const inmMaint = Math.min(.35, (jobFilled('Maintenance') * .05 + jobFilled('Janitorial') * .02));
  const maint = beds * 1.2 * (1 + (1 - maintOK) * 1.5) * (1 - inmMaint);
  money(-maint - (S.yards || 0) * 150, 'Maintenance', 'Facility & yard maintenance');
  const health = pop * 2 + S.inm.filter(i => i.infirm).length * 30;
  if (health) money(-health, 'Healthcare', 'Healthcare supplies & treatment');
  const secOps = staffCount('Correctional Officer') * 6;
  if (secOps) money(-secOps, 'Security operations', 'Security operations & equipment');
  const progCost = S.inm.filter(i => i.prog).length * 3;
  if (progCost) money(-progCost, 'Rehabilitation', 'Program materials');
  money(-(150 + pop * 1), 'Administration', 'Administrative expenses');
  // post accrued (wages/searches) as transactions
  if (T.exp['Inmate wages']) S.tx.unshift({ id: S.seq.tx++, t: S.t, cat: 'Inmate wages', desc: 'Inmate wages for the day', amt: -T.exp['Inmate wages'] });
  if (T.income['Workshop contracts']) S.tx.unshift({ id: S.seq.tx++, t: S.t, cat: 'Workshop contracts', desc: 'Workshop contract revenue', amt: T.income['Workshop contracts'] });
  if (T.income['Canteen sales']) S.tx.unshift({ id: S.seq.tx++, t: S.t, cat: 'Canteen sales', desc: 'Canteen margin', amt: T.income['Canteen sales'] });
  // --- Snapshot
  const ns = Math.max(1, T.needSamples);
  const A = T.needAcc || {};
  const snap = {
    d: d - 1, pop, cap: beds, queue: S.queue.length, bal: S.money,
    inc: sum(Object.values(T.income)), exp: sum(Object.keys(T.exp).filter(k => k[0] !== '_'), k => T.exp[k]),
    incomeBy: T.income, expBy: Object.fromEntries(Object.entries(T.exp).filter(([k]) => k[0] !== '_')),
    incidents: Object.assign({}, T.inc), meals: T.mealsServed, short: T.mealsShort,
    enrolled: S.inm.filter(i => i.prog).length, employed: S.inm.filter(i => i.job).length, completions: T.completions,
    paroleA: T.paroleA, paroleD: T.paroleD, paroleC: T.paroleC, releases: T.releases, escapes: T.escapes, visits: T.visits, contraband: T.contraband,
    sat: (A.sat || 0) / ns, needs: Object.fromEntries(['hunger', 'hygiene', 'rec', 'health', 'social', 'comfort', 'stress', 'safety'].map(k => [k, (A[k] || 0) / ns])),
    att: S.staff.length ? S.staff.filter(s => s.present).length / S.staff.length : 1, staff: S.staff.length, cov: avgCoverage(),
    recv: sum(Object.values(T.intake.recv)), rejected: T.intake.rejected, transferred: T.intake.transferred, positive: T.positive
  };
  S.hist.push(snap); if (S.hist.length > 120) S.hist.shift();
  S.yday = T; S.today = blankDay();

  // --- Discipline expiry
  S.inm.forEach(i => {
    if (i.pun && i.pun.length) { const ended = i.pun.filter(p => d >= p.until); if (ended.length) { ended.forEach(p => ihist(i, `${p.s} ended.`)); recomputeDisc(i); if (!i.pun.length && S.settings.autoJobs) tryAssignJob(i); } }
    else if (i.disc === 'Warning' && d - i.lastInc >= 14) i.disc = 'Good';
    // daily behaviour drift
    const sat = satisfaction(i); i.beh = clamp(i.beh + (sat - 50) / 60 + (i.job ? .2 : 0) + (i.prog ? .2 : 0) + (i.friends.length ? .1 : -.1));
    // illness
    if (!i.infirm && rnd() < .006 + (i.n.hygiene < 25 ? .02 : 0)) { i.sick = true; i.n.health = clamp(i.n.health - ri(10, 30)); ihist(i, `Fell ill (${pick(['influenza', 'stomach virus', 'chest infection', 'skin infection'])}).`); }
    if (i.sick && !i.infirm && !staffCount('Medical Staff')) i.n.health = clamp(i.n.health - 3);
  });
  // --- Parole & releases
  const due = [];
  S.inm.slice().forEach(i => {
    if (d >= i.release) { ihist(i, 'Sentence complete. Released.'); releaseInmate(i, 'Sentence complete'); return; }
    if (d >= i.parole && !i.hearing) { i.hearing = d; due.push(i); }
  });
  if (S.settings.paroleMode === 'auto') S.inm.filter(i => i.hearing).forEach(holdHearing);
  else {
    // board convenes automatically for hearings pending 3+ days
    S.inm.filter(i => i.hearing && d - i.hearing >= 3).forEach(holdHearing);
    if (due.length) note('info', `${due.length} inmate${due.length > 1 ? 's are' : ' is'} now eligible for parole. Review hearings on the Parole page.`);
  }
  // --- Pending queue: transfers
  const keep = [];
  S.queue.forEach(i => { if (d - i.queued >= S.settings.queueDays) { S.today.intake.transferred++; S.stats.transfers++; } else keep.push(i); });
  if (keep.length < S.queue.length) note('warn', `${S.queue.length - keep.length} pending admissions waited too long and were transferred to other facilities. Add capacity in Housing.`);
  S.queue = keep;
  // --- Food reorder
  const use = dailyFoodUse();
  if (S.settings.autoReorder && S.food < use * 2) { buyFood(Math.max(0, Math.round(use * S.settings.reorderDays - S.food)), true); }
  if (S.food < use) note('warn', `Food inventory low: ${fmtN(S.food)} meals left (${fmtN(use)} needed per day).`);
  // --- Staff attendance & morale
  const warden = staffCount('Warden') ? 3 : 0;
  S.staff.forEach(s => {
    const m = S.money < 0 ? -10 : 0;
    s.morale = clamp(s.morale + (70 - s.morale) * .1 + m * .3 + (warden ? .5 : 0));
    s.present = true; // staff always report for duty and never resign
    s.perf = clamp(s.perf + (s.morale - 60) / 200 + .02);
  });
  // --- Construction
  S.blocks.forEach(b => {
    if (b.status === 'Construction') { b.buildLeft--; if (b.buildLeft <= 0) { b.status = 'Open'; note('good', `${b.name} construction complete — ${blockCap(b)} ${b.cls} beds now available.`); } }
    if (b.upgrade) { b.upgrade.left--; if (b.upgrade.left <= 0) { b.tier = b.upgrade.to; b.upgrade = null; note('good', `${b.name} upgraded to Tier ${b.tier} (${TIERS[b.tier].name}).`); } }
  });
  // --- Psychiatric care for criminally insane inmates
  const ci = S.inm.filter(i => i.cls === 'Insane');
  ci.forEach(i => { i.psych = clamp((i.psych == null ? 40 : i.psych) - 6 - (i.n.stress > 60 ? 3 : 0)); });
  let rounds = staffCount('Psychiatrist', true) * 15;
  ci.slice().sort((a, b) => a.psych - b.psych).forEach(i => { if (rounds > 0) { rounds--; i.psych = clamp(i.psych + 5); } });
  if (ci.length && !staffCount('Psychiatrist')) note('bad', `${ci.length} criminally insane inmates have no psychiatrist. Their condition will deteriorate and incidents will rise — hire a Psychiatrist.`);
  // --- Death row appeals
  S.inm.filter(i => i.cls === 'DeathRow' && i.appeal).slice().forEach(i => processAppeal(i, d));
  // --- Inmate-chosen programs: waitlisted inmates try again, some drop out
  if (S.settings.autoEnroll) S.inm.forEach(i => { if (i.prog && i.traits.includes('Rebellious') && rnd() < .02) { ihist(i, `Dropped out of ${i.prog}.`); setProg(i, null); } });
  // --- Weather
  S.weather = wpick(WEATHER);
  if (S.weather === 'Storm' && CLASSES.some(c => S.sched[c].includes('Yard'))) note('info', 'Storm forecast today: yard time moves indoors to recreation.');
  // --- Protective custody requests
  if (S.unlock.classes.includes('Protective')) {
    S.inm.forEach(i => {
      if (i.cls === 'Protective' || i.cls === 'DeathRow' || i.cls === 'Insane' || i.pcRequest) return;
      const threat = i.rivals.filter(r => { const x = getInm(r); return x && x.blk === i.blk; }).length;
      const p = (i.n.safety < 30 ? .025 : 0) + threat * .008 + (i.traits.includes('Anxious') && i.n.safety < 45 ? .006 : 0);
      if (rnd() < p) { i.pcRequest = { d, why: pick(threat ? ['Threatened by rivals in the block', 'Debt to another inmate', 'Agreed to testify; fears retaliation'] : ['Fears for personal safety', 'Labelled an informant by other inmates', 'Left a gang and fears retaliation']) }; ihist(i, `Requested protective custody: ${i.pcRequest.why}.`); note('warn', `${iname(i)} (${i.id}) has requested protective custody: ${i.pcRequest.why}. Review it on the Security page.`); }
    });
    S.inm.forEach(i => { if (i.pcRequest && d - i.pcRequest.d >= 5) { i.pcRequest = null; i.n.stress = clamp(i.n.stress + 10); } });
  }
  // --- Relationships, candidates, auto-jobs/enrol
  dailyRelationships();
  if (d % 2 === 0) S.cands = genCandidates();
  if (S.settings.autoJobs) S.inm.forEach(i => { if (!i.job) tryAssignJob(i); });
  if (S.settings.autoEnroll) S.inm.forEach(i => { if (!i.prog) tryEnroll(i); });
  // jobs over capacity after config change
  JOB_NAMES.forEach(j => { const ws = S.inm.filter(i => i.job === j); const c = S.jobs[j]; if (!c.on || !S.unlock.jobs[j]) ws.forEach(i => setJob(i, null)); else ws.slice(c.pos).forEach(i => setJob(i, null)); });
  // --- Lapsed incidents
  S.inc.filter(x => x.status === 'Open' && d - curDay(x.t) >= 3).forEach(x => { x.status = 'Closed'; x.action = 'Lapsed (no action taken)'; const i = getInm(x.who); if (i) i.beh = clamp(i.beh - 2); S.inm.forEach(m => { if (m.blk === x.blk) m.n.safety = clamp(m.n.safety - 2); }); });
  // --- Money warnings
  if (S.money < 0) note('bad', `Operating deficit: balance is ${fmt$(S.money)}. Staff morale is falling. Reduce costs or increase funded population.`, true);
  // --- Monthly inspection
  if (d % 30 === 1 && d > 1) runInspection(true);
  // --- Career
  checkCareer();
  // daily report note
  const net = snap.inc - snap.exp;
  note(net >= 0 ? 'info' : 'warn', `Day ${d - 1} report: income ${fmt$(snap.inc)}, expenses ${fmt$(snap.exp)} (${net >= 0 ? '+' : ''}${fmt$(net)}). ${sum(Object.values(snap.incidents))} incidents. Population ${pop}/${beds}.`);
}
function buyFood(n, auto) {
  if (n <= 0) return;
  const cost = n * mealCost();
  money(-cost, 'Food', `${auto ? 'Auto-reorder' : 'Purchase'}: ${fmtN(n)} meals (${S.settings.mealQuality})`);
  S.food += n;
}

/* ---------- Inspection ---------- */
function inspectionScore() {
  const pop = S.inm.length;
  const req = requirements();
  const cov = Math.min(1, avgCoverage());
  const sup = ['Medical Staff', 'Kitchen Worker', 'Maintenance Worker', 'Administrator'].map(r => req[r] ? Math.min(1, staffCount(r) / req[r]) : 1);
  const staffing = cov * 15 + avg(sup) * 10;
  const living = pop ? avg(['hunger', 'hygiene', 'rec', 'health', 'comfort', 'social'], k => avgNeed(k)) / 100 * 25 : 12;
  const last7 = S.hist.slice(-7);
  const incs = sum(last7, h => h.incidents.Moderate * 1 + h.incidents.Major * 2 + h.incidents.Critical * 4) / Math.max(1, pop / 100) / Math.max(1, last7.length);
  const openMajor = S.inc.filter(x => x.status === 'Open' && (x.sev === 'Major' || x.sev === 'Critical')).length;
  const esc = sum(last7, h => h.escapes);
  const safety = clamp(20 - incs * 1.2 - openMajor * 2 - esc * 8, 0, 20);
  const adm = clamp(10 - S.queue.length * .5 - sum(last7, h => h.transferred) * .5, 0, 10);
  const net7 = sum(last7, h => h.inc - h.exp);
  const fin = S.money > 0 ? (net7 >= 0 ? 10 : 6) : 0;
  const engaged = pop ? S.inm.filter(i => i.job || i.prog).length / pop : 0;
  const rehab = engaged * 10;
  const parts = { 'Staffing': staffing, 'Living conditions': living, 'Safety & security': safety, 'Admissions': adm, 'Finances': fin, 'Rehabilitation & work': rehab };
  const max = { 'Staffing': 25, 'Living conditions': 25, 'Safety & security': 20, 'Admissions': 10, 'Finances': 10, 'Rehabilitation & work': 10 };
  return { score: Math.round(sum(Object.values(parts))), parts, max };
}
function runInspection(scheduled) {
  const r = inspectionScore();
  const rec = { d: curDay(), score: r.score, parts: r.parts, max: r.max, scheduled: !!scheduled };
  S.inspections.unshift(rec); if (S.inspections.length > 30) S.inspections.length = 30;
  S.lastInspection = rec; S.lastInspectDay = curDay();
  S.stats.bestInspection = Math.max(S.stats.bestInspection, r.score);
  if (S.inm.length >= 250 && r.score >= 80) S.stats.flagship = true;
  const grade = r.score >= 85 ? 'Outstanding' : r.score >= 70 ? 'Pass' : r.score >= 55 ? 'Requires improvement' : 'Fail';
  rec.grade = grade;
  let bonus = 0;
  if (S.unlock.bonus && r.score >= 80) { bonus = Math.round(S.inm.length * 50); grant(bonus, 'Inspection performance bonus'); }
  note(r.score >= 70 ? 'good' : 'warn', `${scheduled ? 'Monthly' : 'Requested'} government inspection: ${r.score}/100 — ${grade}.`, true);
  checkCareer();
  return rec;
}

/* ---------- Career ---------- */
function checkCareer() {
  if (S.mode !== 'career') return;
  let guard = 0;
  while (S.career.idx < CAREER.length && guard++ < 10) {
    const o = CAREER[S.career.idx];
    if (!o.ok()) break;
    S.career.done.push(o.id); S.career.idx++;
    o.give();
    note('good', `Objective complete: ${o.t}. Reward: ${o.reward}.`, true);
  }
}

/* ---------- Advance clock ---------- */
function advanceMinutes(m) {
  for (let k = 0; k < m; k++) {
    S.t++;
    if (S.t % 60 === 0) {
      if (S.t % 1440 === 0) dayTick();
      hourTick(curHour());
    }
  }
}

/* ---------- Officer assignment ---------- */
function autoAssignOfficers(silent) {
  const offs = S.staff.filter(s => s.role === 'Correctional Officer');
  offs.forEach(o => o.assign = null);
  const blocks = S.blocks.filter(b => b.status !== 'Construction' && b.status !== 'Closed');
  // Requirements based on capacity (anticipate filling) blended with occupancy
  const need = blocks.map(b => { const basis = Math.max(blockOcc(b), blockCap(b)); const r = Math.ceil(basis / OFFICER_RATIO[b.cls]); return { b, Day: r, Night: Math.max(1, Math.ceil(r / 2)) }; });
  const totalNeed = sum(need, x => x.Day + x.Night) || 1;
  // assign shifts in ratio Day:Night
  const dayShare = sum(need, x => x.Day) / totalNeed;
  offs.sort((a, b) => b.perf - a.perf);
  const nDay = Math.round(offs.length * dayShare);
  offs.forEach((o, k) => o.shift = k < nDay ? 'Day' : 'Night');
  for (const sh of ['Day', 'Night']) {
    const pool = offs.filter(o => o.shift === sh);
    const order = need.slice().sort((a, b) => CLASSES.indexOf(b.b.cls) - CLASSES.indexOf(a.b.cls));
    const left = Object.fromEntries(order.map(x => [x.b.id, x[sh]]));
    let idx = 0;
    // round robin by remaining need
    while (idx < pool.length) {
      const tgt = order.filter(x => left[x.b.id] > 0).sort((a, b) => left[b.b.id] - left[a.b.id])[0];
      if (!tgt) break;
      pool[idx].assign = tgt.b.id; left[tgt.b.id]--; idx++;
    }
    // extras: distribute to blocks proportional
    for (; idx < pool.length; idx++) pool[idx].assign = order.length ? order[idx % order.length].b.id : null;
  }
  if (!silent) note('info', `Officers re-assigned across ${blocks.length} blocks and two shifts.`);
}

/* ---------- Protective custody ---------- */
function yardClash(pcList, gpList) {
  // Protective custody inmates sharing the yard with general population are at serious risk
  for (const v of pcList) {
    v.n.safety = clamp(v.n.safety - 12); v.n.stress = clamp(v.n.stress + 8);
    if (rnd() < .06) {
      const a = pick(gpList); const b = getBlock(a.blk);
      const dmg = ri(15, 40); v.n.health = clamp(v.n.health - dmg); rival(a, v);
      incident(a, 'Assault on protective custody', `${iname(a)} attacked protective custody inmate ${iname(v)} (${v.pc || 'PC'}) in the exercise yard. PC and general population were scheduled in the yard at the same time.`, dmg > 30 ? 'Critical' : 'Major', b, false, [v]);
    }
  }
  if (!S.today.flagPCYard) { S.today.flagPCYard = true; note('bad', 'Protective custody inmates are sharing the yard with general population. Give Protective Custody a separate yard time in Regimes.', true); }
}
function transferToPC(i) {
  const spot = findBed('Protective');
  if (!spot) return false;
  const old = i.cls; i.cls = 'Protective'; place(i, spot.b, spot.c);
  i.parole = i.start + Math.ceil(i.sent * PAROLE_FRAC.Protective);
  i.pc = i.pcRequest ? i.pcRequest.why : 'Administrative placement'; i.pcRequest = null; i.gang = null;
  i.n.safety = clamp(i.n.safety + 25); i.n.stress = clamp(i.n.stress - 15);
  if (i.job && !jobEligible(i, i.job)) setJob(i, null);
  ihist(i, `Transferred from ${old} to Protective Custody (${cellLabel(i)}).`);
  return true;
}

/* ---------- Death row appeals ---------- */
function appealOdds(i) {
  const a = i.appeal; const st = a.stage;
  let p = [.1, .07, .06, .04][st] || .04;
  p += a.legal * .05;                       // funded legal representation
  if (st === 3) p += a.support ? .1 : 0;    // administration supports clemency
  if (i.beh > 70) p += .03;
  if (i.certs.includes('Psychiatric Treatment') || i.prog === 'Psychiatric Treatment') p += .03;
  if (i.incCount > 3) p -= .03;
  return clamp(p, .01, .6);
}
function processAppeal(i, d) {
  const a = i.appeal;
  if (i.commuted) { const sp = findBed('Maximum'); if (sp) { i.cls = 'Maximum'; place(i, sp.b, sp.c); i.appeal = null; i.pendingMove = null; ihist(i, `Moved to ${cellLabel(i)} after commutation.`); } return; }
  if (a.exec) {
    if (d >= a.exec) {
      if (rnd() < .05 + a.legal * .02) { a.exec = null; a.stage = 2; a.next = d + ri(20, 40); a.log.unshift({ d, x: 'Last-minute stay granted by the court. New federal review scheduled.' }); ihist(i, 'Execution stayed by the court.'); note('info', `Execution of ${iname(i)} (${i.id}) was stayed by the court.`); return; }
      a.log.unshift({ d, x: 'Sentence carried out.' });
      money(-15000, 'Legal & judicial', `Execution procedure ${i.id}`);
      ihist(i, 'Death sentence carried out.');
      S.stats.executions = (S.stats.executions || 0) + 1;
      S.inm.forEach(x => { if (x.blk === i.blk && x.id !== i.id) x.n.stress = clamp(x.n.stress + 12); });
      releaseInmate(i, 'Executed');
      note('warn', `Death sentence carried out: ${iname(i)} (${i.id}), Day ${d}.`);
    }
    return;
  }
  if (d < a.next) return;
  const stage = APPEAL_STAGES[a.stage];
  if (rnd() < appealOdds(i)) {
    a.log.unshift({ d, x: `${stage}: GRANTED. Death sentence commuted to life imprisonment.` });
    ihist(i, `${stage} granted — sentence commuted to life.`);
    commute(i);
    note('good', `${iname(i)} (${i.id}) won their ${stage.toLowerCase()}. Sentence commuted to life; moved to Maximum security${i.cls === 'DeathRow' ? ' (no free bed yet — remains on death row until one opens)' : ''}.`);
    return;
  }
  a.log.unshift({ d, x: `${stage}: denied.` });
  ihist(i, `${stage} denied.`);
  a.stage++; a.legal = 0;
  if (a.stage >= APPEAL_STAGES.length) {
    a.exec = d + 14; a.log.unshift({ d, x: `All appeals exhausted. Execution scheduled for Day ${a.exec}.` });
    i.n.stress = clamp(i.n.stress + 25);
    note('warn', `All appeals exhausted for ${iname(i)} (${i.id}). Execution scheduled for Day ${a.exec}.`);
  } else {
    a.next = d + ri(20, 35);
    note('info', `${iname(i)} (${i.id}): ${stage.toLowerCase()} denied. Next: ${APPEAL_STAGES[a.stage]} on Day ${a.next}.`);
  }
}
function commute(i) {
  i.commuted = true;
  const spot = findBed('Maximum');
  i.sent = 900; i.start = curDay(); i.release = curDay() + 900; i.parole = curDay() + 630;
  if (spot) { i.cls = 'Maximum'; place(i, spot.b, spot.c); i.appeal.done = true; i.appeal = null; ihist(i, `Moved to ${cellLabel(i)}.`); }
  else { i.pendingMove = 'Maximum'; }
}
