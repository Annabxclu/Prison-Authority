# Prison Authority — Prison Management Simulator

A browser-based prison administration game. You run a correctional facility: inmate intake, housing and cell blocks, security incidents, staff, daily regimes, the kitchen, inmate jobs, rehabilitation programs, healthcare, visitors, parole, finances and reports.

## Play

**Online:** https://annabxclu.github.io/Prison-Authority/ (once GitHub Pages is enabled — see below)

**Offline:** download `index.html` and open it in any modern browser (Chrome, Edge, Firefox, Safari). No install needed.

**Accounts:** sign in (email/password or Google) on the main menu to save your prisons online and play them on any device. Without an account, prisons are saved in your browser automatically. To move a prison to another device, use **Administration → Export save code**, then **Import save code** on the other device.

## How to play

1. Create a prison: choose **Sandbox** (full freedom), **Career** (start small and unlock facilities through objectives) or **Test mode** (sandbox plus tools to spawn inmates, trigger incidents and skip time).
2. Press **1x** (or faster) at the top to start the clock. Inmates arrive automatically at 08:00 every day.
3. Watch the **Dashboard** action items: hire staff, build cell blocks, handle incidents, keep food stocked and the budget positive.

Keyboard: **Space** pauses/resumes, **1–5** change speed. At 1x, one real second is one in-game minute.

## Features

- Security classifications: Minimum, Medium, Maximum, Supermax, Protective Custody, Death Row, Criminally Insane
- Daily regimes with outdoor yard time, weather and yard capacity
- Inmates choose their own rehabilitation programs (or let administration assign them)
- Death row appeals: four stages, legal teams, clemency, commutation or execution
- Psychiatrists and psychiatric treatment for criminally insane and death row inmates
- Discipline tab: set the punishment and its duration for every incident type

## Project layout

- `index.html` — the complete, playable game (single file)
- `src/` — source files (`style.css`, `core.js`, `sim.js`, `ui.js`, `app.js`)
- `build.sh` — rebuilds `index.html` from `src/`

## Enabling GitHub Pages

Repository **Settings → Pages → Build and deployment**: Source "Deploy from a branch", branch `main`, folder `/ (root)`. The game is then live at the link above within a minute or two.
