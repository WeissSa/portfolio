# Visual QA evidence — PR #6 (`rework/3d-room`)

Reproducible baseline captured at **commit 0 of the hardened art-overhaul ladder** (`chore(qa): reproducible capture harness + measured baseline + sentinel/budget fixes`). The anchor is the harness command below, not a frozen SHA: re-run `npm run capture:qa` after any later ladder commit to regenerate directly comparable evidence. Screenshots/recordings in this directory are produced from the built site in headless Chromium with SwiftShader WebGL2 — the 3D shots are genuine WebGL renders, not 2D stand-ins.

## Tooling & conditions

- **Harness:** `@playwright/test@1.65.1` is a committed devDependency; `playwright.config.ts` pins the launch args, one worker, `vite preview` on `127.0.0.1:4173` and the production build; `scripts/qa/capture.spec.ts` defines the matrix. `npm run capture:qa` = build (via `npm run build`) + `playwright test` (config starts/stops preview).
- **Browser:** Playwright Chromium build `1255` / Chrome for Testing `159.0.8154.6` + FFmpeg `1013` (installed once with `npx playwright install chromium`). Node `v21.1.0`, npm `10.2.0`; `npm i` emits a pre-existing `EBADENGINE` warning for `camera-controls@3.1.2` (wants Node ≥22) — it did not affect build or capture.
- **WebGL2:** asserted in-page for every 3D shot (`canvas.getContext('webgl2') !== null`, probe context released with `WEBGL_lose_context`). Renderer: `ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)`, vendor `Google Inc.`, version `WebGL 2.0 (OpenGL ES 3.0 Chromium)`. Launch args: `['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']`.
- **Determinism:** fixed room seed (`the-room`, the app default in `src/scene/Room.tsx`), pinned viewports/DPR below, `workers: 1`, no retries; 3D shots wait for `.scene-layer--ready` plus a 2.4 s settle (520 ms fade + damped camera flight).
- **Built site:** `npm run build` green (109 modules; shell `dist/assets/index-CZp9KJhn.js` 243.47 kB raw, scene `dist/assets/Room-B7NgBXbP.js` 975.08 kB raw). Base path `/portfolio/`; URLs `http://127.0.0.1:4173/portfolio/#/<route>`. `public/climate-snapshot.json` was left byte-identical (prebuild drift guard: "data unchanged"; SHA verified before/after by the build script's guard).
- **Mode forcing:** 2D via `addInitScript(() => localStorage.setItem('portfolio:mode','2d'))`; no-WebGL2 stub overrides `HTMLCanvasElement.prototype.getContext` for `webgl`/`webgl2`/`experimental-webgl` while leaving `2d` intact (the heatmap uses a 2D canvas); save-data stub defines `navigator.connection.saveData = true`; reduced-motion via Playwright `reducedMotion:'reduce'`; scene failure via the **canonical sentinel** `localStorage.setItem('portfolio:3d-failed','true')` (`SCENE_FAILURE_VALUE` in `src/lib/device-tier.ts`). The historical `'1'` probe in earlier evidence was a documentation mismatch, not a supported value (see D1).
- **Loading state:** `page.route('**/assets/Room-*.js', …)` delays the scene chunk by 2 s, then captures the visible "Loading the room…" cut-in.

## Measured baseline (commit 0)

Command: `npm run size` (= `size-limit` + `node scripts/check-3d-budget.mjs`) on the build above. Brotli is the enforced metric; gzip is informational.

| Bucket                       | Files                                                  |        Brotli |  Limit |     Headroom |
| ---------------------------- | ------------------------------------------------------ | ------------: | -----: | -----------: |
| App shell (JS + CSS + woff2) | `index-CZp9KJhn.js`, `index-BXk3zbxM.css`, Anton woff2 |  **89.77 kB** | 120 KB | **30.23 KB** |
| Lazy 3D scene                | `Room-B7NgBXbP.js`                                     | **219.04 kB** | 260 KB | **40.96 KB** |

- Scene gzip (informational): 264,662 B. The budget script now buckets by name (`Room-*.js` = 3D scene); an unbucketed non-shell chunk fails loudly instead of silently disabling the gate or being mistaken for 3D bytes.
- **Measured-baseline numbers are informational drift references, not extra CI gates.** Only the documented hard limits (120 KB shell / 260 KB scene, enforced by `size-limit` + `check-3d-budget.mjs`) fail builds; no phantom baseline test artifact is committed. Re-run `npm run size` after visual commits to see drift.
- **Scene inventory** (headless `RoomScene`, desktop quality, seed `the-room`): **102 meshes** (2 `InstancedMesh`), **5 lights** (1 ambient, 1 directional, 3 point), **9 canvas-generated textures** (`wood, plaster, brass, paper, rug, bookAtlas, caseLabels, monitor, projector`). No downloaded models or textures.
- **Device matrix:** desktop 1440×900 @1 (fine pointer, 8 cores / 16 GB → default 3D), tablet 768×1024 @1 (default 3D), mobile 390×844 @2 with touch/coarse pointer (mobile tier, default 3D). Fallback paths verified on desktop: reduced-motion, no-WebGL2, save-data, persisted scene failure.

## Capture matrix

`Result` is the honest visual/programmatic verdict for each shot. "Room visible" means the WebGL canvas rendered scene content behind the authoritative 2D DOM shell. Every row checks horizontal overflow (`documentElement.scrollWidth <= innerWidth`) unless stated; no blank canvases, cut-off text or missing widgets were observed in passing shots.

| #   | File                                     | Route                    | Viewport / DPR | Mode         | What's visible                                                         | Result | Glitch / note                                                                             |
| --- | ---------------------------------------- | ------------------------ | -------------- | ------------ | ---------------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------- |
| 1   | `desktop_3d_home.png`                    | `#/`                     | 1440×900 @1    | 3d (default) | Room + desk/floor, hero panel & menu; canvas ready                     | PASS   | Room largely covered by DOM hero panel by design                                          |
| 2   | `desktop_3d_about.png`                   | `#/about`                | 1440×900 @1    | 3d           | Desk/monitor framed behind About desktop DOM                           | PASS   | —                                                                                         |
| 3   | `desktop_3d_experience.png`              | `#/experience`           | 1440×900 @1    | 3d           | Bookshelf framed behind experience list                                | PASS   | —                                                                                         |
| 4   | `desktop_3d_projects.png`                | `#/projects`             | 1440×900 @1    | 3d           | Game cases on desk behind project cards                                | PASS   | —                                                                                         |
| 5   | `desktop_3d_climate.png`                 | `#/climate`              | 1440×900 @1    | 3d           | Projector screen + heatmap behind climate widgets                      | PASS   | —                                                                                         |
| 6   | `desktop_2d_home.png`                    | `#/`                     | 1440×900 @1    | 2d (forced)  | 2D shell, no scene layer                                               | PASS   | —                                                                                         |
| 7   | `desktop_2d_about_windows.png`           | `#/about`                | 1440×900 @1    | 2d (forced)  | About desktop DOM, no scene layer                                      | PASS   | —                                                                                         |
| 8   | `desktop_2d_experience_list.png`         | `#/experience`           | 1440×900 @1    | 2d (forced)  | Experience card list, no scene layer                                   | PASS   | —                                                                                         |
| 9   | `desktop_2d_projects_list.png`           | `#/projects`             | 1440×900 @1    | 2d (forced)  | Project card grid, no scene layer                                      | PASS   | —                                                                                         |
| 10  | `desktop_2d_climate_heatmap.png`         | `#/climate`              | 1440×900 @1    | 2d (forced)  | Statement, today widget, 2026 heatmap + legend + attribution           | PASS   | —                                                                                         |
| 11  | `mobile_3d_home.png`                     | `#/`                     | 390×844 @2     | 3d (default) | Portrait framing; room slivers between panels; hero + menu             | PASS   | Room mostly occluded by DOM panels (D2); menu scrolls horizontally by design              |
| 12  | `mobile_3d_experience.png`               | `#/experience`           | 390×844 @2     | 3d (default) | Portrait zone; room visible at edges behind list                       | PASS   | Same occlusion note (D2)                                                                  |
| 13  | `mobile_3d_climate.png`                  | `#/climate`              | 390×844 @2     | 3d (default) | Portrait zone; projector trigger + climate widgets                     | PASS   | Same occlusion note (D2)                                                                  |
| 14  | `mobile_2d_home.png`                     | `#/`                     | 390×844 @2     | 2d (forced)  | 2D home, no scene layer                                                | PASS   | —                                                                                         |
| 15  | `mobile_2d_climate.png`                  | `#/climate`              | 390×844 @2     | 2d (forced)  | Statement + today widget; no scene layer                               | PASS   | Heatmap below fold — see #16                                                              |
| 16  | `mobile_2d_climate_heatmap.png`          | `#/climate` (scrolled)   | 390×844 @2     | 2d (forced)  | Year selector, heatmap, legend, Open-Meteo / CDF attribution           | PASS   | Heatmap scrolls horizontally inside its figure at 390px; page itself has no overflow (D3) |
| 17  | `desktop_auto2d_reduced-motion_home.png` | `#/`                     | 1440×900 @1    | auto→2d      | 2D shell; 3D button disabled/dimmed; no scene layer                    | PASS   | —                                                                                         |
| 18  | `desktop_auto2d_no-webgl2_home.png`      | `#/`                     | 1440×900 @1    | auto→2d      | 2D shell fully usable; 3D button disabled; no scene layer              | PASS   | —                                                                                         |
| 19  | `desktop_auto2d_save-data_home.png`      | `#/`                     | 1440×900 @1    | auto→2d      | 2D shell; 3D button disabled; no scene layer                           | PASS   | —                                                                                         |
| 20  | `desktop_auto2d_scene-failed_home.png`   | `#/`                     | 1440×900 @1    | auto→2d      | 2D shell after canonical `portfolio:3d-failed='true'`; no scene layer  | PASS   | D1 resolved: `'true'` is the single canonical write/read sentinel                         |
| 21  | `tablet_3d_home.png`                     | `#/`                     | 768×1024 @1    | 3d (default) | Room behind hero; canvas ready                                         | PASS   | —                                                                                         |
| 22  | `tablet_3d_climate.png`                  | `#/climate`              | 768×1024 @1    | 3d (default) | Projector + climate widgets; canvas ready                              | PASS   | —                                                                                         |
| 23  | `desktop_3d_loading.png`                 | `#/` (chunk delayed 2 s) | 1440×900 @1    | 3d (loading) | "Loading the room…" cut-in visibly centered above shell; no canvas yet | PASS   | —                                                                                         |
| 24  | `desktop_3d_book-detail.png`             | `#/experience`           | 1440×900 @1    | 3d           | Book detail DOM dialog over dimmed room; content + close button        | PASS   | Opened by a real 3D pick                                                                  |
| 25  | `desktop_3d_case-detail.png`             | `#/projects`             | 1440×900 @1    | 3d           | Game-case detail dialog over dimmed room, screenshot + tags            | PASS   | Opened by a real 3D pick; hit areas are fiddly (D4)                                       |
| 26  | `desktop_3d_monitor-zoom.png`            | `#/about`                | 1440×900 @1    | 3d           | Full-screen About desktop after 3D monitor pick; "BACK TO ROOM"        | PASS   | Opened by a real 3D pick; icon bar empty before a window opens                            |
| 27  | `desktop_3d_climate-projector-panel.png` | `#/climate`              | 1440×900 @1    | 3d           | Projector info dialog over room: statement, widget, heatmap, legend    | PASS   | Opened via the accessible "Open projector info panel" trigger                             |

**Result: 27 screenshots on disk (27 in the capture spec). 26 regenerated by the commit-0 harness run; `desktop_3d_climate-projector-panel.png` was regenerated by the follow-up harness run after the D6 dialog-lifecycle fix (see D6 — RESOLVED). The earlier `'1'`-sentinel FAIL shot was deleted.** The follow-up harness run was **9/9 tests passing**; the combined dialog test now closes each dialog before navigating and waits for real content before capturing.

## Recordings

| File                         | Route/action                                       | Capture size | Verified content                                                   |
| ---------------------------- | -------------------------------------------------- | ------------ | ------------------------------------------------------------------ |
| `desktop-3d-navigation.webm` | 3D Home → Experience → Projects → Climate via menu | 960×600      | All three camera flights; ends on Climate with projector visible   |
| `desktop-mode-toggle.webm`   | 3D → 2D → Auto                                     | 960×600      | Room disappears into 2D shell, then returns on Auto (ends "3D ON") |
| `mobile-3d-home.webm`        | Mobile 3D Home → tap Experience                    | 390×844      | Portrait room + tap-driven zone flight (ends on Experience)        |

## Honest defects / observations

- **D1 — RESOLVED (was the one FAIL).** An earlier QA doc probed `localStorage.setItem('portfolio:3d-failed','1')`; the writer and reader both use `'true'`. Commit 0 picks `'true'` as the single canonical value (`SCENE_FAILURE_VALUE`), updates both paths, pins the exact stored string + write→resolve behavior in tests, and points the harness at `'true'`. The old FAIL was a **documentation mismatch, not a product bug**; behavior is unchanged. The obsolete sentinel-`'1'` screenshot was removed.
- **D2 — mobile portrait 3D room occlusion.** At 390×844 the authoritative DOM panels cover most of the viewport; the WebGL room renders correctly (canvas present, ready, portrait pull-back applied) but is visible only in slivers. Not a blank canvas or overflow, but 3D fidelity on a phone is mostly hidden by the 2D-first shell.
- **D3 — mobile climate heatmap scrolls horizontally inside its figure** (`overflow-x-auto`) at 390px; a full-year view needs a horizontal swipe inside the panel. Legend, year selector and attribution remain readable; the page itself has no horizontal overflow.
- **D4 — 3D pick hit areas are fiddly.** Hover-grid searches found books/projector but initially missed game cases/monitor; direct coordinates opened them. Picks work, but effective hit targets are small relative to the overlaid DOM cards. The harness uses fixed pixel coordinates recorded from this baseline for the book/case/monitor picks; they may need recalibration after geometry/layout changes (captured in the spec comment).
- **D6 — RESOLVED (was: projector dialog shot retained from the prior pass).** Root cause: the combined dialog test navigated by hash without unmounting each detail/desktop dialog; `useInertBackground(true)` kept the rest of the app inert, so the accessible "Open projector info panel" trigger could not be clicked (3 min timeout). The monitor pick also left a stale dialog that a generic `getByRole('dialog')` assertion accepted as success. Fix in `scripts/qa/capture.spec.ts`: close every dialog (Escape, up to 5 times for nested About windows) after each pick and before each navigation, assert the monitor dialog by its accessible name, and wait for the projector panel's actual content with CSS animations disabled so the PNG is not blank. The harness now runs 9/9 and `desktop_3d_climate-projector-panel.png` was freshly regenerated. The three fixed-pixel 3D picks remain intentionally real-3D evidence but a **known fragility** (D4) — recalibrate after geometry/layout changes.
- **D5 — screencast frame starvation** under SwiftShader + demand frameloop; screenshots between steps force frames. Software rendering understates real-device smoothness; do not judge real FPS from these clips.
- **No blank WebGL canvas, horizontal page overflow, cut-off text or missing climate widgets were observed in any passing shot.** All four fallback gates, the loading indicator and all four 3D dialogs behaved as intended.

## How to reproduce

```bash
cd portfolio
npm ci
npx playwright install chromium   # once; browsers are cached after this
npm run capture:qa                # build → vite preview → 27 PNGs + 3 WebMs
```

The command writes `qa-evidence/screenshots/` and `qa-evidence/recordings/` in place. Temporary Playwright artifacts go to the gitignored `qa-evidence/.artifacts/`. The 3D paths use the SwiftShader launch args in `playwright.config.ts`; to inspect manually, serve `npm run preview -- --host 127.0.0.1 --port 4173` and open `http://127.0.0.1:4173/portfolio/#/<route>` in Chromium with those args.

## Smoothness / frame-time evidence (art-overhaul commit 3c, 2026-11-24)

**Honest headline:** these numbers were captured on headless Chromium with `ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)` — **software WebGL**. They are valid as a _relative regression baseline_ and prove the harness works, but they **cannot validate the owner's absolute targets** (60fps desktop / ≥45-60fps capable mobile). `env=swiftshader` is recorded in every JSON artifact; absolute thresholds are only asserted when the harness runs on hardware WebGL. The 60/45fps acceptance remains an owner-real-hardware check.

### Method

- `src/lib/perf-probe.ts` is a dev/test-only sampler installed via Playwright `addInitScript` (transpiled with esbuild); **no app code imports it, so it ships zero production bytes**. `window.__perf.start(label)/stop()/report()` returns `{n,p50,p95,max,longFrames,raf:{...},gpu:{...},histogram,env}`.
- Primary metric = per-frame **workload**: main-thread busy time between the previous frame's end (MessageChannel end-of-frame signal) and this frame's start, with async GPU time from `EXT_disjoint_timer_query_webgl2` where available. Raw **rAF deltas are reported separately** (`raf`), never used as the gate. `longFrames` = workload >34ms.
- `scripts/qa/perf.spec.ts` warms up once, then drives 3 measured runs of three camera flights, a 2D↔3D toggle and dialog open/close on both viewports; reported values are the **median of the 3 runs**. Gate: p95 ≤ 110% of `qa-evidence/perf-baseline.json` **plus 2× the recorded run-to-run jitter** (SwiftShader p95 spread on identical runs reaches 40–100%; the 10% gate is the real rule on hardware, where jitter is small). Baseline promotion is improvement-only via `node scripts/qa/promote-perf-baseline.mjs` (needs `--force` with owner approval for regressions). This noise band is a deliberate deviation from the bare 10% gate in the plan — without it CI fails on SwiftShader jitter alone.
- Command: `npm run build && npx playwright test scripts/qa/perf.spec.ts` → 2/2 passing against the committed baseline. Artifacts: `qa-evidence/perf/latest-desktop.json`, `latest-mobile.json`, `steady-desktop.png`, and `qa-evidence/perf-baseline.json`.

### Measured p50 / p95 workload (ms, SwiftShader — informational, not fps)

| Workload            | Desktop p50 / p95 | Mobile p50 / p95 |
| ------------------- | ----------------: | ---------------: |
| Flight → Experience |         272 / 372 |         64 / 174 |
| Flight → Projects   |        349 / 1001 |         78 / 190 |
| Flight → Climate    |         406 / 696 |        111 / 277 |
| 2D↔3D toggle        |         296 / 528 |         15 / 118 |
| Dialog open/close   |          89 / 358 |         16 / 106 |

Per-frame GPU timer (SwiftShader): desktop p95 ≈ 330–550ms; mobile has no `EXT_disjoint_timer_query_webgl2`, so `gpu` is `null`. Raw rAF deltas and 5-bucket histograms are in the JSON artifacts. **Do not read these as real-device frame rates.**

### Static budgets and leak check

- `renderer.info` (whole-frame count, autoReset off in the QA hook): desktop **92 draw calls / 17 programs** (limits ≤100 / ≤25); mobile **21 calls / 7 programs**.
- Merged static families (commit 3c P6): 3 skirting boards → 1, 4 tower vents → 1, 2 drawer pulls → 1, 4 frame trim rails per framed print → 1 (×3 prints): **21 meshes → 6, i.e. 15 fewer draw calls**, with transforms baked into vertex data and no per-frame work.
- Five consecutive 2D↔3D toggles: no geometry or texture growth (`renderer.info.memory` asserted non-increasing). Desktop keeps the Canvas warm (`frameloop='never'` + hidden); mobile/low unmount to save GPU memory (conscious memory-vs-stall tradeoff).
- Scene chunk: **221.12 kB brotli** (baseline 220.37 kB, Δ **+0.75 kB**; ≤8 kB commit budget, 260 kB hard limit). Sampler ships 0 bytes. `npm run verify` green: **427 tests** (43 files), typecheck/lint/format/build/size all pass.

## Diegetic-only + dev-render evidence (2026-11-24, `rework/3d-room`)

Owner direction: in live 3D desktop **no floating DOM overlay menu for pointer
users** — navigation is entirely in-world (brass wall plaque, CRT dock in the
monitor close-up, climate-local projected strip). The DOM menu stays in the a11y
tree and tab order; only genuine keyboard focus (`:has(:focus-visible)`)
un-hides it, so a mouse click can no longer float it over the room.

| File                             | Route / action                            | Viewport | Condition                | Expected evidence                                                                                                                   |
| -------------------------------- | ----------------------------------------- | -------- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| `desktop_3d_plaque.png`          | `#/`                                      | 1440×900 | fine pointer, live scene | All five plaque rows fully inside the inlay (glyph-box bounds asserted in `tests/diegetic.test.ts`); no opaque DOM over the plaque. |
| `desktop_3d_menu-focus.png`      | `#/` + real Tab                           | 1440×900 | fine pointer             | Floating DOM menu appears **only** on keyboard focus, gold focus chip + ring; pointer click before Tab leaves the room clean.       |
| `desktop_3d_medium-width.png`    | `#/`                                      | 900×800  | fine pointer             | Diegetic right column starts at 768px — no empty gutter / plaque overlap in the 768–1023px band.                                    |
| `desktop_3d_crt-menu.png`        | `#/about` + monitor pick                  | 1440×900 | monitor close-up         | CRT dock shortcuts painted into the monitor texture; DOM desktop hidden in the capture only.                                        |
| `desktop_3d_projected-panel.png` | `#/climate`                               | 1440×900 | fine pointer             | Projected climate-local strip legible, glyphs clear of both brass rules, no opaque DOM occlusion.                                   |
| `dev_3d_render.png`              | `npm run dev`, `#/`                       | 1440×900 | StrictMode double-invoke | Lit WebGL room (luma range 239–242 measured), readiness-gated layout (`mainLeft=720`), no disposed-resource console errors.         |
| `dev_3d_diegetic_room.png`       | `npm run dev`, pointer click              | 1440×900 | fine pointer             | Room stays clean: menu width 1px after a mouse click; no floating overlay.                                                          |
| `dev_3d_keyboard_menu.png`       | `npm run dev`, real Tab                   | 1440×900 | fine pointer             | Focus chip + gold ring, opaque menu (>100px) revealed only by keyboard.                                                             |
| `dev_3d_zone_spotlight.png`      | `npm run dev`, Tab/Enter → `#/experience` | 1440×900 | camera settled           | Zone spotlight active on the books; keyboard menu still available.                                                                  |

- **Capture commands:** `npm run capture:qa` (built site → Playwright matrix) for
  the first five; `npm run dev` + `npm run qa:dev-render` for the four dev shots
  (`QA_DEV_URL` overrides the port if Vite moves off 5173). Measured dev run:
  `pointerMenuWidth=1`, `keyboardRevealedRoute="/"`, `consoleErrors=0`,
  `glLost=false`, luma range 239–242, `mainLeft=720`.
- **Frozen-grain assertion:** the reduced-motion QA test no longer reads a
  `grainTime` dataset written inside `useFrame` (a demand frameloop with instant
  cuts fires zero frames, so it passed regardless of the freeze logic). It now
  asserts the one-shot `data-grain-frozen` flag published by an effect plus the
  pure `advancePainterlyTime(..., frozen)` step the pass actually calls.
- **Click affordance / zone spotlights:** all six diegetic pick families share
  one four-state treatment (`src/scene/affordance.tsx`): idle → zone (gold edge
  after the camera settles) → hover → selected. Idle draws no extra geometry;
  no new lights are added. DOM mirror and `LEVEL_COLORS` are unchanged.
- **Honest gap:** the SwiftShader `perf.spec.ts` desktop relative-gate run timed
  out (180 s, then 400 s on retry) in this environment before reaching its
  assertion; mobile passed. The one-frame `renderer.info` QA probe showed 18
  programs (was 17, +1 for the shared gold-line material) and stable geometry/
  texture counts. The absolute frame-time gate still needs a re-run on a quiet
  machine / real hardware — it is NOT part of `npm run verify`.

### Optimizations applied

- P1 DPR caps desktop `[1,1.5]`, mobile `[1,1.25]`; mobile far plane 60→24.
- P2 pointermove raycasts coalesced to ≤1/frame; hover/out picking disabled for coarse pointers by the existing fine-pointer-only interactive gate.
- P3 MSAA samples 4→2; P4 UnsignedByte render target by default (grain/stroke dither banding), HalfFloat only opt-in behind `EXT_color_buffer_float`.
- P5 frustum culling restored on all book/clutter InstancedMeshes with `computeBoundingSphere()` after matrices; grain `uTime` only advances on rendered frames (demand loop ⇒ paused when idle); no per-frame allocations added.
- P6 merged static same-material families (above); P7 per-year CanvasTexture cache (FIFO 10) with mobile deferral until the climate zone is entered; P10 desktop warm-start mode toggle.
- Mobile light budget: 1 point light (ambient + moon directional), key spot/monitor spill removed (existing emissive materials carry the glow); filler books 160→80.
- Known limitation: SwiftShader screenshots/clips still show frame starvation; judge smoothness from the frame-time artifacts and owner hardware, not the recordings (see D5).
