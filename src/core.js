'use strict';
/* ================= Utilities ================= */
const $ = s => document.querySelector(s);
const rnd = Math.random;
const ri = (a, b) => Math.floor(a + rnd() * (b - a + 1));
const pick = a => a[Math.floor(rnd() * a.length)];
const clamp = (v, a = 0, b = 100) => v < a ? a : v > b ? b : v;
const fmt$ = n => (n < 0 ? '-' : '') + '$' + Math.abs(Math.round(n)).toLocaleString();
const fmtN = n => Math.round(n).toLocaleString();
const pct = n => Math.round(n * 100) + '%';
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sum = (a, f = x => x) => a.reduce((s, x) => s + f(x), 0);
const avg = (a, f = x => x) => a.length ? sum(a, f) / a.length : 0;
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const wpick = (items) => { let t = sum(items, x => x[1]); let r = rnd() * t; for (const [v, w] of items) { if ((r -= w) <= 0) return v; } return items[items.length - 1][0]; };
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

/* ================= Constants ================= */
const CLASSES = ['Minimum', 'Medium', 'Maximum', 'Supermax', 'Protective', 'DeathRow', 'Insane'];
const CLS_SHORT = { Minimum: 'MIN', Medium: 'MED', Maximum: 'MAX', Supermax: 'SMX', Protective: 'PC', DeathRow: 'DR', Insane: 'CI' };
const CLS_LABEL = { Minimum: 'Minimum', Medium: 'Medium', Maximum: 'Maximum', Supermax: 'Supermax', Protective: 'Protective Custody', DeathRow: 'Death Row', Insane: 'Criminally Insane' };
const CLS_MULT = { Minimum: .7, Medium: 1, Maximum: 1.4, Supermax: 1.7, Protective: .6, DeathRow: 1.2, Insane: 1.6 };
const OFFICER_RATIO = { Minimum: 20, Medium: 12, Maximum: 6, Supermax: 3, Protective: 8, DeathRow: 3, Insane: 4 };
const PAROLE_FRAC = { Minimum: .5, Medium: .6, Maximum: .7, Supermax: .85, Protective: .6, DeathRow: null, Insane: .75 };
const DEFAULT_FUNDING = { Minimum: 60, Medium: 75, Maximum: 110, Supermax: 180, Protective: 105, DeathRow: 230, Insane: 200 };
const DEFAULT_INTAKE = { Minimum: 5, Medium: 10, Maximum: 4, Supermax: 1, Protective: 1, DeathRow: .2, Insane: .5 };
const BEDS_PER_CELL = { Minimum: 2, Medium: 2, Maximum: 1, Supermax: 1, Protective: 1, DeathRow: 1, Insane: 1 };
const CELL_BASE_COST = { Minimum: 2200, Medium: 2800, Maximum: 4200, Supermax: 7000, Protective: 4000, DeathRow: 7500, Insane: 6000 };
const NEVER = 999999; // death row: no release or parole date
const APPEAL_STAGES = ['Direct appeal', 'State post-conviction review', 'Federal habeas corpus', 'Clemency petition'];
const CAPITAL_CHARGES = ['Capital murder', 'Murder with special circumstances', 'Multiple homicide', 'Murder of a law enforcement officer', 'Murder during a kidnapping'];
const INSANE_DX = ['Paranoid schizophrenia', 'Schizoaffective disorder', 'Bipolar disorder with psychotic features', 'Delusional disorder', 'Severe psychotic depression'];
const PC_REASONS = ['Former police officer', 'Former corrections officer', 'Informant / cooperating witness', 'Gang dropout', 'High-profile case', 'Vulnerable (age or health)', 'Former prosecutor\'s investigator', 'Testified against co-defendants'];
const YARD_CAP = 100, YARD_COST = 30000;
const WEATHER = [['Clear', 45], ['Cloudy', 30], ['Rain', 18], ['Storm', 7]];
const TIERS = {
  1: { name: 'Basic', util: 2, cellCost: 0, comfort: -1.2, desc: 'Bed, toilet, basic amenities' },
  2: { name: 'Standard', util: 3.5, cellCost: 1800, comfort: 0, desc: 'Adds shower access and extra basics' },
  3: { name: 'Premium', util: 5.5, cellCost: 4500, comfort: 1.2, desc: 'Improved amenities, storage and comfort' }
};
const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const ROLES = {
  'Correctional Officer': { dept: 'Security', sal: 46000 },
  'Warden': { dept: 'Administration', sal: 98000 },
  'Administrator': { dept: 'Administration', sal: 52000 },
  'Medical Staff': { dept: 'Healthcare', sal: 72000 },
  'Psychologist': { dept: 'Healthcare', sal: 85000 },
  'Teacher': { dept: 'Rehabilitation', sal: 50000 },
  'Kitchen Worker': { dept: 'Food Services', sal: 32000 },
  'Maintenance Worker': { dept: 'Facilities', sal: 38000 },
  'Rehabilitation Specialist': { dept: 'Rehabilitation', sal: 58000 },
  'Psychiatrist': { dept: 'Healthcare', sal: 125000 }
};
const ROLE_NAMES = Object.keys(ROLES);

const TRAITS = {
  'Cooperative': { inc: .5, beh: 10 },
  'Aggressive': { inc: 2.1, beh: -12 },
  'Introverted': { inc: .85, beh: 2 },
  'Manipulative': { inc: 1.35, beh: -6 },
  'Rebellious': { inc: 1.7, beh: -10 },
  'Leadership-oriented': { inc: 1.05, beh: 0 },
  'Easily influenced': { inc: 1.2, beh: -2 },
  'Calm': { inc: .6, beh: 8 },
  'Anxious': { inc: 1.1, beh: 0 },
  'Hardworking': { inc: .8, beh: 6 }
};
const TRAIT_NAMES = Object.keys(TRAITS);
const TRAIT_CLASH = [['Aggressive', 'Aggressive'], ['Aggressive', 'Rebellious'], ['Manipulative', 'Cooperative'], ['Rebellious', 'Cooperative'], ['Aggressive', 'Anxious'], ['Leadership-oriented', 'Leadership-oriented'], ['Manipulative', 'Aggressive']];
const TRAIT_BOND = [['Cooperative', 'Cooperative'], ['Calm', 'Introverted'], ['Hardworking', 'Hardworking'], ['Leadership-oriented', 'Easily influenced'], ['Calm', 'Cooperative'], ['Hardworking', 'Cooperative']];

const GANGS = ['Iron Brotherhood', 'South Side Kings', 'Black Ravens', 'Los Lobos', 'Northern Crew'];

const ACTS = {
  Sleep: { c: '#33415c', l: 'Sleep' },
  Wake: { c: '#6b7c93', l: 'Wake up' },
  Meal: { c: '#4cc38a', l: 'Meal' },
  Work: { c: '#e8b931', l: 'Employment' },
  Yard: { c: '#3fae6a', l: 'Yard (outdoors)' },
  Recreation: { c: '#5aa9e6', l: 'Recreation (indoor)' },
  Rehab: { c: '#b48ef0', l: 'Rehabilitation' },
  Shower: { c: '#45c4c4', l: 'Shower' },
  Free: { c: '#8fbf5a', l: 'Free time' },
  Visits: { c: '#f08a24', l: 'Visitation' },
  Lockdown: { c: '#7a3b3b', l: 'Lockdown (in cell)' }
};
const ACT_NAMES = Object.keys(ACTS);
function defaultSchedule(cls) {
  const s = Array(24).fill('Sleep');
  s[6] = 'Wake'; s[7] = 'Meal';
  if (cls === 'DeathRow') {
    for (let h = 8; h < 22; h++) s[h] = 'Lockdown';
    s[11] = 'Yard'; s[12] = 'Meal'; s[14] = 'Rehab'; s[16] = 'Shower'; s[17] = 'Meal'; s[18] = 'Visits';
    return s;
  }
  if (cls === 'Insane') {
    s[8] = s[9] = 'Rehab'; s[10] = 'Recreation'; s[11] = 'Yard'; s[12] = 'Meal'; s[13] = 'Rehab'; s[14] = s[15] = 'Free'; s[16] = 'Shower'; s[17] = 'Meal'; s[18] = 'Visits'; s[19] = 'Recreation'; s[20] = s[21] = 'Lockdown';
    return s;
  }
  if (cls === 'Supermax') {
    for (let h = 8; h < 24; h++) s[h] = 'Lockdown';
    s[12] = 'Meal'; s[11] = 'Yard'; s[13] = 'Recreation'; s[14] = 'Rehab'; s[16] = 'Shower'; s[17] = 'Meal'; s[22] = s[23] = 'Sleep';
    return s;
  }
  s[8] = s[9] = s[10] = s[11] = 'Work'; s[12] = 'Meal'; s[13] = 'Yard';
  s[14] = s[15] = 'Rehab'; s[16] = 'Shower'; s[17] = 'Meal'; s[18] = 'Visits';
  s[19] = 'Recreation'; s[20] = 'Free'; s[21] = 'Lockdown';
  if (cls === 'Maximum') { s[10] = s[11] = 'Lockdown'; s[13] = 'Recreation'; s[15] = 'Yard'; s[20] = 'Lockdown'; }
  if (cls === 'Protective') { s[13] = 'Recreation'; s[14] = 'Yard'; s[15] = 'Rehab'; }
  return s;
}

const JOBS = {
  Kitchen: { pos: 6, wage: 1.0, elig: ['Minimum', 'Medium'], desc: 'Each worker adds 15 meals per sitting' },
  Laundry: { pos: 5, wage: .8, elig: ['Minimum', 'Medium', 'Protective'], desc: 'Improves hygiene across the prison' },
  Janitorial: { pos: 8, wage: .7, elig: ['Minimum', 'Medium', 'Maximum'], desc: 'Reduces maintenance costs, improves comfort' },
  Maintenance: { pos: 4, wage: 1.1, elig: ['Minimum'], desc: 'Reduces maintenance costs and damage repairs' },
  Workshop: { pos: 10, wage: 1.5, elig: ['Minimum', 'Medium'], desc: 'Produces contract goods: $11 revenue per worker-hour' },
  Library: { pos: 3, wage: .7, elig: ['Minimum', 'Medium', 'Maximum', 'Protective'], desc: 'Improves recreation for all inmates' },
  Canteen: { pos: 3, wage: .8, elig: ['Minimum', 'Medium'], desc: 'Lets inmates make purchases (prison keeps 25%)' }
};
const JOB_NAMES = Object.keys(JOBS);

const PROGRAMS = {
  'Education': { role: 'Teacher', per: 15, hrs: 60, elig: ['Minimum', 'Medium', 'Maximum', 'Protective'], cert: 'GED Certificate', fx: { beh: 8, parole: 10 } },
  'Vocational Training': { role: 'Teacher', per: 12, hrs: 80, elig: ['Minimum', 'Medium', 'Protective'], cert: 'Trade Certificate', fx: { beh: 6, parole: 14 } },
  'Life Skills': { role: 'Rehabilitation Specialist', per: 15, hrs: 30, elig: CLASSES, cert: 'Life Skills Certificate', fx: { beh: 6, parole: 6 } },
  'Anger Management': { role: 'Psychologist', per: 10, hrs: 30, elig: CLASSES, cert: 'Anger Management Completion', fx: { beh: 12, parole: 10, calm: true } },
  'Substance Recovery': { role: 'Rehabilitation Specialist', per: 12, hrs: 50, elig: CLASSES, cert: 'Recovery Program Completion', fx: { beh: 8, parole: 12 } },
  'Counseling': { role: 'Psychologist', per: 12, hrs: 20, elig: CLASSES, cert: 'Counseling Completion', fx: { beh: 5, parole: 5, stress: true } },
  'Psychiatric Treatment': { role: 'Psychiatrist', per: 8, hrs: 30, elig: ['DeathRow', 'Insane'], cert: 'Psychiatric Treatment Course', fx: { beh: 6, parole: 6, stress: true }, repeat: true }
};
const PROG_NAMES = Object.keys(PROGRAMS);

const CHARGES = {
  1: ['Petty theft', 'Trespassing', 'Vandalism', 'Drug possession', 'Shoplifting', 'Driving while suspended', 'Disorderly conduct'],
  2: ['Burglary', 'Fraud', 'Possession with intent to supply', 'Receiving stolen property', 'Forgery', 'Vehicle theft', 'Embezzlement'],
  3: ['Robbery', 'Aggravated assault', 'Drug trafficking', 'Arson', 'Extortion', 'Identity theft ring'],
  4: ['Armed robbery', 'Kidnapping', 'Manslaughter', 'Organized crime', 'Weapons trafficking'],
  5: ['Murder', 'Attempted murder', 'Serial armed robbery', 'Criminal enterprise leadership']
};
const SEV_RANGE = { Minimum: [1, 2], Medium: [2, 3], Maximum: [3, 4], Supermax: [4, 5], Protective: [1, 4], DeathRow: [5, 5], Insane: [2, 5] };
const SENT_RANGE = { 1: [20, 60], 2: [40, 120], 3: [90, 240], 4: [180, 450], 5: [365, 900] };
const SEV_LABEL = { 1: 'Low', 2: 'Moderate', 3: 'Serious', 4: 'Severe', 5: 'Extreme' };

const M_FIRST = ['James', 'Michael', 'Robert', 'David', 'William', 'Joseph', 'Thomas', 'Daniel', 'Marcus', 'Anthony', 'Kevin', 'Brian', 'Jason', 'Eric', 'Tyrone', 'Luis', 'Carlos', 'Andre', 'Derek', 'Shane', 'Victor', 'Malik', 'Jose', 'Travis', 'Cody', 'Raymond', 'Dwayne', 'Scott', 'Omar', 'Ivan', 'Trevor', 'Darnell', 'Miguel', 'Wesley', 'Curtis', 'Frank', 'Hector', 'Jamal', 'Terrence', 'Dustin', 'Ruben', 'Leon', 'Calvin', 'Gregory', 'Sean', 'Nathan', 'Rashad', 'Kyle', 'Edwin', 'Roy'];
const F_FIRST = ['Mary', 'Jennifer', 'Linda', 'Patricia', 'Jessica', 'Ashley', 'Tanya', 'Maria', 'Crystal', 'Amber', 'Brittany', 'Denise', 'Monique', 'Rosa', 'Kimberly', 'Heather', 'Nicole', 'Tasha', 'Angela', 'Vanessa', 'Shonda', 'Carmen', 'Dana', 'Kelly', 'Lisa', 'Megan', 'Renee', 'Yolanda', 'Gloria', 'Erin', 'Latoya', 'Sabrina', 'Tiffany', 'Leah', 'Paula', 'Destiny', 'Raquel', 'Shannon', 'Bianca', 'Holly'];
const LAST = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Clark', 'Lewis', 'Robinson', 'Walker', 'Young', 'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores', 'Green', 'Adams', 'Nelson', 'Baker', 'Hall', 'Rivera', 'Campbell', 'Mitchell', 'Carter', 'Roberts', 'Phillips', 'Evans', 'Turner', 'Diaz', 'Parker', 'Cruz', 'Edwards', 'Collins', 'Reyes', 'Stewart', 'Morris', 'Murphy', 'Cook', 'Rogers', 'Morgan', 'Cooper', 'Peterson', 'Bailey', 'Reed', 'Kelly', 'Howard', 'Kim', 'Cox', 'Ward', 'Richardson', 'Watson', 'Brooks', 'Wood', 'James', 'Bennett', 'Gray', 'Mendoza', 'Ruiz', 'Hughes', 'Price', 'Alvarez', 'Castillo', 'Sanders', 'Patel', 'Myers', 'Long', 'Ross', 'Foster', 'Jimenez', 'Powell', 'Jenkins', 'Perry', 'Russell', 'Sullivan', 'Bell', 'Coleman', 'Butler', 'Henderson', 'Barnes', 'Fisher', 'Vasquez', 'Simmons', 'Graham', 'Marshall', 'Owens', 'Harrison', 'Gibson', 'Wallace', 'Ellis', 'Stone', 'Hayes', 'Ford', 'Webb', 'Shaw', 'Holmes', 'Rice', 'Dunn', 'Palmer', 'Black', 'Wagner', 'Hunt', 'Ortiz'];
const STAFF_FIRST = M_FIRST.concat(F_FIRST);

/* Career objectives */
const CAREER = [
  { id: 'open', t: 'Open for business', d: 'Employ at least 4 correctional officers, 1 kitchen worker and 1 medical staff, and house 20 inmates.',
    ok: () => staffCount('Correctional Officer') >= 4 && staffCount('Kitchen Worker') >= 1 && staffCount('Medical Staff') >= 1 && S.inm.length >= 20,
    reward: 'Grant: $25,000', give: () => grant(25000, 'Opening grant') },
  { id: 'stable', t: 'Stable footing', d: 'Reach Day 7 with a positive balance and average inmate safety of 50 or more.',
    ok: () => curDay() >= 7 && S.money > 0 && avgNeed('safety') >= 50,
    reward: 'Grant: $30,000', give: () => { grant(30000, 'Stability grant'); } },
  { id: 'grow', t: 'Growing population', d: 'Build a new cell block and house 45 inmates at once.',
    ok: () => S.stats.blocksBuilt >= 1 && S.inm.length >= 45,
    reward: 'Unlock Maximum security + Protective Custody + $40,000', give: () => { unlockClass('Maximum'); unlockClass('Protective'); grant(40000, 'Expansion grant'); } },
  { id: 'rehab', t: 'Second chances', d: 'Have inmates complete 8 rehabilitation programs.',
    ok: () => S.stats.completions >= 8,
    reward: 'Unlock Vocational Training and Workshop jobs', give: () => { S.unlock.progs['Vocational Training'] = true; S.unlock.jobs.Workshop = true; } },
  { id: 'inspect', t: 'First inspection', d: 'Request a government inspection (Administration) and score 70 or higher.',
    ok: () => S.stats.bestInspection >= 70,
    reward: 'Grant: $75,000 + Premium (Tier 3) cells', give: () => { S.unlock.tier3 = true; grant(75000, 'Inspection grant'); } },
  { id: 'maxsec', t: 'Maximum security', d: 'House 20 Maximum security inmates with no escapes in the last 7 days.',
    ok: () => S.inm.filter(i => i.cls === 'Maximum').length >= 20 && (S.stats.lastEscapeDay == null || curDay() - S.stats.lastEscapeDay >= 7),
    reward: 'Unlock Supermax, Death Row and Criminally Insane', give: () => { unlockClass('Supermax'); unlockClass('DeathRow'); unlockClass('Insane'); } },
  { id: 'parole', t: 'Parole system', d: 'Achieve 10 parole approvals.',
    ok: () => S.stats.paroleApproved >= 10,
    reward: 'Performance bonus funding (+5%)', give: () => { S.unlock.bonus = true; } },
  { id: 'flagship', t: 'Flagship facility', d: 'House 250 inmates and pass an inspection with 80 or higher while doing so.',
    ok: () => S.stats.flagship === true,
    reward: 'Career complete — everything unlocked', give: () => { CLASSES.forEach(unlockClass); S.unlock.tier3 = true; PROG_NAMES.forEach(p => S.unlock.progs[p] = true); JOB_NAMES.forEach(j => S.unlock.jobs[j] = true); } }
];

/* ================= State ================= */
let S = null; // current game state

function curDay(t = S.t) { return Math.floor(t / 1440) + 1; }
function curHour(t = S.t) { return Math.floor((t % 1440) / 60); }
function dow(d = curDay()) { return (d - 1) % 7; }
function clockStr(t = S.t) { const m = t % 1440; return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); }
function stamp(t = S.t) { return 'D' + curDay(t) + ' ' + clockStr(t); }

function newState(cfg) {
  const st = {
    v: 1, id: uid(), name: cfg.name, mode: cfg.mode, pop: cfg.pop, size: cfg.size,
    created: Date.now(), t: 6 * 60, speed: 0,
    money: cfg.funds,
    seq: { inm: 1, staff: 1, inc: 1, blk: 1, tx: 1, note: 1 }, test: cfg.mode === 'test',
    settings: {
      intake: Object.assign({}, DEFAULT_INTAKE), intakeOn: true, overflow: 'queue', queueMax: 40, queueDays: 5,
      funding: Object.assign({}, DEFAULT_FUNDING),
      mealQuality: 'Standard', autoReorder: true, reorderDays: 5,
      autoHandle: 'moderate', searches: 'weekly', screening: 'standard',
      visitDays: [false, false, true, false, false, true, true],
      autoJobs: true, autoEnroll: true, paroleMode: 'review', progChoice: 'inmate',
      disc: defaultDiscipline(), escalate: true
    },
    unlock: {
      classes: cfg.mode === 'career' ? ['Minimum', 'Medium'] : CLASSES.slice(),
      tier3: cfg.mode !== 'career',
      progs: {}, jobs: {}, bonus: cfg.mode !== 'career'
    },
    sched: {}, blocks: [], inm: [], released: [], queue: [], staff: [], cands: [],
    jobs: {}, progs: {}, food: 0, yards: cfg.size === 'Large' && cfg.mode !== 'career' ? 3 : cfg.size === 'Medium' && cfg.mode !== 'career' ? 2 : 1, weather: 'Clear', inc: [], notes: [], tx: [], hist: [], arrivals: [],
    today: null, yday: null, career: { idx: 0, done: [] },
    stats: { completions: 0, paroleApproved: 0, paroleDenied: 0, releases: 0, escapes: 0, lastEscapeDay: null, blocksBuilt: 0, bestInspection: 0, flagship: false, transfers: 0 },
    inspections: [], lastInspectDay: -99, reports: []
  };
  CLASSES.forEach(c => st.sched[c] = defaultSchedule(c));
  JOB_NAMES.forEach(j => { st.jobs[j] = { on: true, pos: JOBS[j].pos, wage: JOBS[j].wage, elig: JOBS[j].elig.slice() }; st.unlock.jobs[j] = cfg.mode !== 'career' || j !== 'Workshop'; });
  PROG_NAMES.forEach(p => { st.progs[p] = { on: true, cap: 30, elig: PROGRAMS[p].elig.slice(), completions: 0 }; st.unlock.progs[p] = cfg.mode !== 'career' || p !== 'Vocational Training'; });
  if (cfg.intake) Object.assign(st.settings.intake, cfg.intake);
  if (cfg.overflow) st.settings.overflow = cfg.overflow;
  S = st;
  S.today = blankDay();
  // Starting blocks
  const plans = {
    Small: [['A Block', 'Minimum', 10, 2, 1], ['B Block', 'Medium', 15, 2, 1]],
    Medium: [['A Block', 'Minimum', 20, 2, 1], ['B Block', 'Medium', 25, 2, 1], ['C Block', 'Maximum', 24, 1, 1], ['Segregation Unit', 'Supermax', 8, 1, 2], ['PC Unit', 'Protective', 10, 1, 2], ['Death Row', 'DeathRow', 8, 1, 2], ['Forensic Unit', 'Insane', 10, 1, 2]],
    Large: [['A Block', 'Minimum', 40, 2, 1], ['B Block', 'Medium', 30, 2, 1], ['C Block', 'Medium', 25, 2, 2], ['D Block', 'Maximum', 50, 1, 1], ['Segregation Unit', 'Supermax', 15, 1, 2], ['PC Unit', 'Protective', 15, 1, 2], ['Death Row', 'DeathRow', 12, 1, 2], ['Forensic Unit', 'Insane', 18, 1, 2]]
  };
  let plan = cfg.mode === 'career' ? plans.Small : plans[cfg.size];
  if (cfg.mode !== 'career' && cfg.classes) {
    // Redistribute beds of unchosen classes to chosen ones
    const total = sum(plan, p => p[2] * p[3]);
    plan = plan.filter(p => cfg.classes.includes(p[1]));
    const missing = cfg.classes.filter(c => !plan.some(p => p[1] === c));
    missing.forEach((c, i) => plan.push([c === 'Protective' ? 'PC Unit' : c === 'Supermax' ? 'Segregation Unit' : c === 'DeathRow' ? 'Death Row' : c === 'Insane' ? 'Forensic Unit' : String.fromCharCode(65 + plan.length) + ' Block', c, 10, BEDS_PER_CELL[c], 1]));
    let have = sum(plan, p => p[2] * p[3]);
    if (plan.length && have < total) {
      const f = total / have; plan = plan.map(p => [p[0], p[1], Math.max(1, Math.round(p[2] * f)), p[3], p[4]]);
      // fix rounding
      have = sum(plan, p => p[2] * p[3]);
      let i = 0; while (have < total && i < 400) { const p = plan[i % plan.length]; if (have + p[3] <= total) { p[2]++; have += p[3]; } i++; if (i % plan.length === 0 && plan.every(q => have + q[3] > total)) break; }
    }
    S.unlock.classes = CLASSES.filter(c => cfg.classes.includes(c));
  }
  plan.forEach(p => addBlock(p[0], p[1], p[2], p[3], p[4], true));
  // Starting staff
  if (cfg.staff !== 'none') {
    const cap = totalCapacity();
    const need = cfg.staff === 'minimal' ? { 'Correctional Officer': Math.ceil(cap / 18), 'Kitchen Worker': 1, 'Medical Staff': 1 } : recommendedStaff(cap);
    for (const r in need) for (let i = 0; i < need[r]; i++) S.staff.push(genStaff(r));
    autoAssignOfficers(true);
  }
  S.food = Math.round(totalCapacity() * 3 * 4);
  S.cands = genCandidates();
  note('info', `Welcome to ${S.name}. Inmates arrive automatically at 08:00 each day according to your intake settings.`);
  if (S.mode === 'career') note('info', 'Career mode: complete objectives on the Dashboard to unlock new facilities and grants.');
  return S;
}

function recommendedStaff(cap) {
  return {
    'Warden': cap >= 100 ? 1 : 0,
    'Correctional Officer': sum(S.blocks, b => { const r = Math.ceil(blockCap(b) / OFFICER_RATIO[b.cls]); return r + Math.max(1, Math.ceil(r / 2)); }),
    'Administrator': Math.max(1, Math.round(cap / 150)),
    'Medical Staff': Math.max(1, Math.ceil(cap / 60)),
    'Kitchen Worker': Math.max(1, Math.ceil(cap / 60)),
    'Maintenance Worker': Math.max(1, Math.ceil(cap / 100)),
    'Teacher': cap >= 100 ? 1 : 0,
    'Psychologist': cap >= 150 ? 1 : 0,
    'Rehabilitation Specialist': cap >= 100 ? 1 : 0,
    'Psychiatrist': Math.ceil(sum(S.blocks.filter(b => b.cls === 'Insane' || b.cls === 'DeathRow'), blockCap) / 15)
  };
}

function blankDay() {
  return { inc: { Minor: 0, Moderate: 0, Major: 0, Critical: 0 }, mealsServed: 0, mealsShort: 0, foodUsed: 0, income: {}, exp: {},
    intake: { recv: {}, queued: 0, rejected: 0, transferred: 0, fromQueue: 0, limited: [] },
    completions: 0, paroleA: 0, paroleD: 0, paroleC: 0, releases: 0, escapes: 0, visits: 0, contraband: 0, positive: 0, cancelled: {}, needSamples: 0 };
}

/* ---------- Blocks ---------- */
function addBlock(name, cls, cells, beds, tier, instant) {
  const b = { id: 'B' + (S.seq.blk++), name, cls, tier, status: instant ? 'Open' : 'Construction', buildLeft: instant ? 0 : 2, cells: [], contraband: 5, incidents: 0, cancelled: false };
  for (let i = 0; i < cells; i++) b.cells.push({ n: i + 1, beds, occ: [] });
  S.blocks.push(b);
  return b;
}
function blockCap(b) { return sum(b.cells, c => c.beds); }
function blockOcc(b) { return sum(b.cells, c => c.occ.length); }
function totalCapacity(cls) { return sum(S.blocks.filter(b => b.status !== 'Construction' && (!cls || b.cls === cls)), blockCap); }
function freeBeds(cls) { return sum(S.blocks.filter(b => b.cls === cls && b.status !== 'Construction' && b.status !== 'Closed'), b => blockCap(b) - blockOcc(b)); }
function getBlock(id) { return S.blocks.find(b => b.id === id); }
function findBed(cls, exclude) {
  // Prefer the open block with the most free space, fill cells that already have someone first for 2-bed cells
  const blocks = S.blocks.filter(b => b.cls === cls && b.status === 'Open' || (b.cls === cls && b.status === 'Lockdown'));
  let best = null, bestFree = -1;
  for (const b of blocks) { const f = blockCap(b) - blockOcc(b); if (f > bestFree && f > 0) { best = b; bestFree = f; } }
  if (!best) return null;
  const cell = best.cells.find(c => c.occ.length > 0 && c.occ.length < c.beds && (!exclude || !c.occ.some(id => exclude.includes(id)))) || best.cells.find(c => c.occ.length === 0) || best.cells.find(c => c.occ.length < c.beds);
  return cell ? { b: best, c: cell } : null;
}
function cellOf(i) { const b = getBlock(i.blk); return b ? b.cells.find(c => c.n === i.cell) : null; }
function vacate(i) { const c = cellOf(i); if (c) c.occ = c.occ.filter(x => x !== i.id); i.blk = null; i.cell = null; }
function place(i, b, c) { vacate(i); c.occ.push(i.id); i.blk = b.id; i.cell = c.n; }
function cellLabel(i) { const b = getBlock(i.blk); return b ? `${b.name} · Cell ${i.cell}` : '—'; }

/* ---------- Generation ---------- */
function genName(g) { return [pick(g === 'Female' ? F_FIRST : M_FIRST), pick(LAST)]; }
function genInmate(cls) {
  const id = 'P-' + String(S.seq.inm++).padStart(5, '0');
  const [fn, ln] = genName(S.pop);
  const [a, b] = SEV_RANGE[cls]; const sev = ri(a, b);
  const charges = [pick(CHARGES[sev])];
  if (rnd() < .4) { const c = pick(CHARGES[Math.max(1, sev - ri(0, 1))]); if (!charges.includes(c)) charges.push(c); }
  if (rnd() < .12) { const c = pick(CHARGES[Math.max(1, sev - 1)]); if (!charges.includes(c)) charges.push(c); }
  const priors = Math.max(0, Math.round((rnd() * rnd()) * (sev + 4)));
  const [s1, s2] = SENT_RANGE[sev];
  const sent = Math.round(ri(s1, s2) * (1 + priors * .07) * (1 + (charges.length - 1) * .15));
  // traits
  const pool = [];
  TRAIT_NAMES.forEach(t => { let w = 10; if (cls === 'Insane') { if (['Aggressive', 'Anxious', 'Easily influenced', 'Rebellious'].includes(t)) w = 16; if (['Calm', 'Hardworking'].includes(t)) w = 4; } if (cls === 'Protective') { if (['Introverted', 'Anxious', 'Cooperative', 'Calm'].includes(t)) w = 18; if (['Aggressive', 'Rebellious'].includes(t)) w = 3; } if (cls === 'Supermax' || cls === 'Maximum') { if (['Aggressive', 'Rebellious', 'Manipulative', 'Leadership-oriented'].includes(t)) w = 18; if (['Cooperative', 'Calm'].includes(t)) w = 5; } if (cls === 'Minimum' && ['Cooperative', 'Calm', 'Hardworking', 'Introverted'].includes(t)) w = 16; pool.push([t, w]); });
  const traits = [wpick(pool)]; let t2; do { t2 = wpick(pool); } while (t2 === traits[0] || (t2 === 'Calm' && traits[0] === 'Anxious') || (t2 === 'Anxious' && traits[0] === 'Calm') || (t2 === 'Cooperative' && traits[0] === 'Rebellious') || (t2 === 'Rebellious' && traits[0] === 'Cooperative'));
  traits.push(t2);
  const traitRisk = sum(traits, t => (TRAITS[t].inc - 1) * 12);
  const riskScore = sev * 12 + priors * 3 + traitRisk + ri(-5, 5);
  const risk = riskScore < 30 ? 'Low' : riskScore < 48 ? 'Moderate' : riskScore < 66 ? 'High' : 'Extreme';
  const pre = Math.floor(sent * rnd() * .15);
  const d = curDay();
  const gangP = { Minimum: .04, Medium: .14, Maximum: .3, Supermax: .45, Protective: 0, DeathRow: .15, Insane: 0 }[cls];
  const i = {
    id, fn, ln, age: ri(18, 64 - (rnd() < .6 ? 25 : 0)), g: S.pop, adm: d, cls, risk, charges, sev, priors, sent,
    start: d - pre, parole: d + Math.max(2, Math.ceil(sent * PAROLE_FRAC[cls]) - pre), release: d + sent - pre,
    blk: null, cell: null, traits,
    n: { hunger: ri(55, 80), hygiene: ri(45, 80), rec: ri(45, 75), health: ri(65, 95), social: ri(45, 75), comfort: ri(45, 70), stress: ri(25, 55), safety: ri(45, 70) },
    beh: clamp(55 + sum(traits, t => TRAITS[t].beh) - sev * 3 + ri(-8, 8), 5, 95),
    disc: 'Good', discUntil: 0, lastInc: -99, incCount: 0,
    job: null, jobSince: 0, jobHist: [], earn: 0, bal: ri(0, 40), tx: [],
    prog: null, progHrs: 0, progStart: 0, progHist: [], certs: [],
    friends: [], rivals: [], gang: rnd() < gangP ? pick(GANGS) : null,
    hist: [], hearing: null, infirm: false, sick: false, loc: 'Intake', paroleRec: 0, hearings: 0,
    pc: cls === 'Protective' ? pick(PC_REASONS) : null,
    psych: cls === 'Insane' ? ri(25, 60) : null, dx: cls === 'Insane' ? pick(INSANE_DX) : null, progWant: null, progWhy: null
  };
  if (cls === 'DeathRow') {
    i.charges = [pick(CAPITAL_CHARGES)].concat(rnd() < .4 ? [pick(CHARGES[4])] : []); i.sent = 0; i.parole = NEVER; i.release = NEVER;
    i.appeal = { stage: 0, next: d + ri(20, 40), legal: 0, support: 0, log: [], exec: null };
  }
  if (cls === 'Insane') i.charges[0] += ' (found not guilty by reason of insanity)';
  if (i.pc === 'Vulnerable (age or health)') i.age = ri(58, 79);
  ihist(i, `Admitted. Charges: ${i.charges.join(', ')}. ${cls === 'DeathRow' ? 'Sentenced to death; mandatory appeals begin.' : 'Sentence ' + i.sent + ' days.'}${i.pc ? ' Protective custody: ' + i.pc + '.' : ''}${i.dx ? ' Diagnosis: ' + i.dx + '.' : ''}`);
  return i;
}
function ihist(i, txt) { i.hist.unshift({ t: S.t, x: txt }); if (i.hist.length > 25) i.hist.length = 25; }
function itx(i, desc, amt) { i.bal += amt; i.tx.unshift({ d: curDay(), x: desc, a: amt }); if (i.tx.length > 15) i.tx.length = 15; }
function iname(i) { return i.fn + ' ' + i.ln; }
function getInm(id) { return S.inm.find(i => i.id === id); }
function served(i) { return curDay() - i.start; }
function remaining(i) { return i.release >= NEVER ? Infinity : Math.max(0, i.release - curDay()); }
function sentenceStr(i) { return i.cls === 'DeathRow' ? 'Death sentence' : i.sent + ' days'; }
function modeLabel(m) { return m === 'career' ? 'Career' : m === 'test' ? 'Test' : 'Sandbox'; }
const INC_TYPES = ['Argument', 'Refusal to follow instructions', 'Fight', 'Property damage', 'Contraband', 'Assault on staff', 'Attempted escape', 'Assault on protective custody', 'Psychotic episode', 'Medical emergency'];
function defaultDiscipline() {
  return {
    'Argument': { s: 'Verbal warning', days: 0 }, 'Refusal to follow instructions': { s: 'Loss of privileges', days: 2 }, 'Fight': { s: 'Solitary confinement', days: 3 },
    'Property damage': { s: 'Restitution', days: 0 }, 'Contraband': { s: 'Investigation', days: 0 }, 'Assault on staff': { s: 'Solitary confinement', days: 7 },
    'Attempted escape': { s: 'Refer for prosecution', days: 0 }, 'Assault on protective custody': { s: 'Solitary confinement', days: 7 }, 'Psychotic episode': { s: 'Psychiatric observation', days: 2 }, 'Medical emergency': { s: 'Medical evaluation', days: 0 }
  };
}

function genStaff(role, exp) {
  const fn = pick(STAFF_FIRST), ln = pick(LAST);
  exp = exp == null ? ri(0, 15) : exp;
  return {
    id: 'E-' + String(S.seq.staff++).padStart(4, '0'), fn, ln, role, dept: ROLES[role].dept,
    sal: Math.round(ROLES[role].sal * (1 + exp * .025) * (0.95 + rnd() * .1) / 100) * 100,
    exp, perf: clamp(Math.round(55 + exp * 2 + ri(-10, 12)), 30, 98), att: clamp(ri(86, 99), 0, 100),
    shift: rnd() < .5 ? 'Day' : 'Night', assign: null, hired: S ? curDay() : 1, present: true, morale: 70
  };
}
function genCandidates() {
  const out = [];
  const roles = ['Correctional Officer', 'Correctional Officer', 'Correctional Officer'].concat(shuffle(ROLE_NAMES.slice()).slice(0, 5));
  roles.forEach(r => out.push(genStaff(r)));
  return out;
}
function staffCount(role, presentOnly) { return S.staff.filter(s => s.role === role && (!presentOnly || s.present)).length; }

/* ---------- Ledger & notes ---------- */
function money(amt, cat, desc, post = true) {
  S.money += amt;
  const bucket = amt >= 0 ? S.today.income : S.today.exp;
  bucket[cat] = (bucket[cat] || 0) + Math.abs(amt);
  if (post) { S.tx.unshift({ id: S.seq.tx++, t: S.t, cat, desc, amt }); if (S.tx.length > 400) S.tx.length = 400; }
}
function accrue(amt, cat) { // accumulated expense posted at day end
  S.money -= amt; S.today.exp[cat] = (S.today.exp[cat] || 0) + amt;
}
function grant(amt, desc) { money(amt, 'Grants', desc); note('good', `${desc}: ${fmt$(amt)} deposited.`); }
function unlockClass(c) { if (!S.unlock.classes.includes(c)) { S.unlock.classes.push(c); S.unlock.classes.sort((a, b) => CLASSES.indexOf(a) - CLASSES.indexOf(b)); note('good', `${c} security classification unlocked. Build a ${c} block in Housing.`); } }

let toastHook = null;
function note(lvl, msg, toast) {
  S.notes.unshift({ id: S.seq.note++, t: S.t, lvl, msg, read: false });
  if (S.notes.length > 150) S.notes.length = 150;
  if (toastHook && (toast || lvl === 'bad')) toastHook(lvl, msg);
}
