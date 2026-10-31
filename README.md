# Prison Authority — Prison Management Simulator

A browser-based prison administration game. You run a correctional facility: inmate intake, housing and cell blocks, security incidents, staff, daily regimes, the kitchen, inmate jobs, rehabilitation programs, healthcare, visitors, parole, finances and reports.

## Play

**Online:** https://annabxclu.github.io/Prison-Authority/ (once GitHub Pages is enabled — see below)

**Offline:** download `index.html` and open it in any modern browser (Chrome, Edge, Firefox, Safari). No install needed.

Your prisons are saved in your browser automatically. To move a prison to another device, use **Administration → Export save code**, then **Import save code** on the other device.

## How to play

1. Create a prison: choose **Sandbox** (full freedom) or **Career** (start small and unlock facilities through objectives).
2. Press **1x** (or faster) at the top to start the clock. Inmates arrive automatically at 08:00 every day.
3. Watch the **Dashboard** action items: hire staff, build cell blocks, handle incidents, keep food stocked and the budget positive.

Keyboard: **Space** pauses/resumes, **1–5** change speed. At 1x, one real second is one in-game minute.

## Project layout

- `index.html` — the complete, playable game (single file)
- `src/` — source files (`style.css`, `core.js`, `sim.js`, `ui.js`, `app.js`)
- `build.sh` — rebuilds `index.html` from `src/`

## Enabling GitHub Pages

Repository **Settings → Pages → Build and deployment**: Source "Deploy from a branch", branch `main`, folder `/ (root)`. The game is then live at the link above within a minute or two.
