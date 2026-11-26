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

| File                             | Route / action                              | Viewport | Condition                | Expected evidence                                                                                                                   |
| -------------------------------- | ------------------------------------------- | -------- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| `desktop_3d_plaque.png`          | `#/`                                        | 1440×900 | fine pointer, live scene | All five plaque rows fully inside the inlay (glyph-box bounds asserted in `tests/diegetic.test.ts`); no opaque DOM over the plaque. |
| `desktop_3d_menu-focus.png`      | `#/` + real Tab                             | 1440×900 | fine pointer             | Floating DOM menu appears **only** on keyboard focus, gold focus chip + ring; pointer click before Tab leaves the room clean.       |
| `desktop_3d_medium-width.png`    | `#/`                                        | 900×800  | fine pointer             | Diegetic right column starts at 768px — no empty gutter / plaque overlap in the 768–1023px band.                                    |
| `desktop_3d_crt-menu.png`        | `#/about` + monitor pick                    | 1440×900 | monitor close-up         | CRT dock shortcuts painted into the monitor texture; DOM desktop hidden in the capture only.                                        |
| `desktop_3d_projected-panel.png` | `#/climate`                                 | 1440×900 | fine pointer             | Projected climate-local strip legible, glyphs clear of both brass rules, no opaque DOM occlusion.                                   |
| `dev_3d_render.png`              | `npm run dev`, `#/`                         | 1440×900 | StrictMode double-invoke | Lit WebGL room (luma range 239–242 measured), readiness-gated layout (`mainLeft=720`), no disposed-resource console errors.         |
| `dev_3d_diegetic_room.png`       | `npm run dev`, pointer click                | 1440×900 | fine pointer             | Room stays clean: menu width 1px after a mouse click; no floating overlay.                                                          |
| `dev_3d_keyboard_menu.png`       | `npm run dev`, real Tab                     | 1440×900 | fine pointer             | Focus chip + gold ring, opaque menu (>100px) revealed only by keyboard.                                                             |
| `dev_3d_zone_spotlight.png`      | `npm run dev`, Tab/Enter → `#/experience`   | 1440×900 | camera settled           | Zone spotlight active on the books; keyboard menu still available.                                                                  |
| `dev_3d_home-control.png`        | `npm run dev`, `#/experience`, menu blurred | 1440×900 | fine pointer             | Camera-parented brass `◀ HOME` badge bottom-left: a diegetic way back from every zone; DOM menu stays the a11y path.                |

- **Capture commands:** `npm run capture:qa` (built site → Playwright matrix) for
  the first five; `npm run dev` + `npm run qa:dev-render` for the five dev shots
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
- **Round-3 follow-ups folded in:** the plaque is now 1.6×1.4 m with a 52px face
  and 56px row pitch (all five rows clear the frame and the monitor, texture
  pixel budget unchanged); edge outlines are deterministic 2%-wobbled dashed
  brass in the ambient zone state (gold only on hover/selection) so they read
  as hand-inlaid rather than CAD rectangles. `HomeControl` is camera-parented
  in every non-home fine-pointer zone. Deferred to follow-up commits: caching/
  lazy-load (#2), in-world diegetic detail views with a visually-hidden DOM
  mirror (#3), and richer camera/scene personality (#5) — DOM dialog contracts
  were deliberately left stable for #3.
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

## Round-3 polish(b) — seeded static cache + lazy-load audit

### Seeded static resource cache

- **Design:** `src/scene/art/static-cache.ts` owns the immutable furniture geometry, 10 canvas textures and room materials as one `RoomResources` bundle keyed by `seed|quality|factoryId` (factory identity included so two painters never share textures). The cap retains at most **two idle entries** — it applies to idle (zero-owner) entries only; live entries are never evicted, so the cache can temporarily hold more than two. `acquireRoomResources(seed, quality, factory, owner)` is idempotent per owner token and returns the _same_ THREE objects; `releaseRoomResources(key, owner)` drops one owner. An idle entry stays cached so a remount is free — disposal happens only on insertion-order idle eviction at the cap (**not LRU** — there is no last-use tracking), on an explicit clear, or on HMR (`import.meta.hot.dispose`). The production app has one seed/room, so one entry (≈7 MB of textures, bounded by the existing 1.8 M-pixel budget) lives for the whole session. `matrixAutoUpdate=false` freezing and the perf gate are unchanged.
- **StrictMode safety:** the component's owner token is a `useRef` object (stable across the dev double render), and the release is scheduled through the existing `useDeferredDispose` hook (setTimeout cancelled on same-generation re-setup). There is deliberately **no synchronous refcount decrement in a component cleanup** — that would revive the disposed-but-cached dev bug. The dev simulated unmount's release is cancelled; a real unmount drops exactly one owner; remount reuses the identical objects.
- **DI seam preserved:** an injected stub `textureFactory` still bypasses the cache entirely and keeps the previous per-mount ownership + deferred disposal (`factoryUsesCache()` only accepts the default browser painter or an explicitly tagged test factory). Both branches are now pinned: `factoryUsesCache(createPlanTexture) === true`, an untagged stub `=== false`, plus a `RoomScene` remount test with the real painter. Zone-local resources (projector year textures, `PickableEdges`, etc.) stay per-mount with their existing deferred disposal.
- **Tradeoff / risk (honest):** textures + geometry now stay GPU-resident across unmounts instead of being freed at refcount 0. That is intentional (single room, bounded by the two-idle-entry cap) but raises steady-state memory; an application with many seeds/rooms would need a tighter eviction policy than the idle-entry cap. HMR force-clears live entries, which is safe only because the module swap discards the old tree.

### Lazy-loading audit — no item is safely lazy (documented, not forced)

Audited the non-critical pieces named in the plan against three tests: (a) does a dynamic boundary actually remove bytes/work from the _initial_ scene chunk, (b) does it break picking, (c) does it add flicker/suspend-at-mount?

| Candidate                                             | Verdict    | Reason                                                                                                                                                                                                                                                                                                                               |
| ----------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `affordance.tsx` outlines                             | Keep eager | Statically imported by all five zone components; Vite keeps it in the scene chunk unless _every_ importer becomes `React.lazy`, which would suspend the pickable zones inside the Canvas (picking gap + flicker). ~5 KB source / ~1.5 KB brotli — not worth the risk with 35 KB of headroom. Idle state already draws zero geometry. |
| Narrative-prop / silhouette factories (`geometry.ts`) | Keep eager | Synchronous pure builders inside the cached `useMemo`; a dynamic import would make furniture creation async, breaking the synchronous identity/StrictMode contract the cache relies on. Zero GPU work at import — the cost is already paid once per session.                                                                         |
| `climate-draw` details                                | Keep eager | Shared by the instant 2D `HeatmapCanvas` and the 3D projector. A dynamic boundary would add a loading step to the 2D-first shell (explicitly out of scope) with no scene-byte saving. The expensive 1024×576 paint is already deferred until the climate zone on mobile (`deferUntilZone`) and cached per year.                      |
| `ClimateProjector` zone component                     | Keep eager | Rendered at scene mount on both tiers to fill the screen; `React.lazy` would suspend immediately (visible pop-in, climate picking unavailable until loaded) and require a new named chunk bucket in `check-3d-budget.mjs`. Risk > reward at 225 KB of 260 KB.                                                                        |

The 2D-first shell stays instant (three/R3F remain behind the existing `React.lazy` in `SceneLayer.tsx`) and the flat book detail stays its own lazy chunk. No new chunk was introduced, so the budget script's unbucketed-chunk guard stays intact.

**Owner tradeoff (explicit):** the owner asked for both caching and lazy-loading (#2). This audit is the delivered lazy-loading result — none of the remaining non-critical pieces can be split without suspending a pickable zone inside the Canvas, breaking the synchronous cache/StrictMode identity contract, or adding a loading step to the 2D-first shell. Kept as a documented tradeoff for this fix; revisit with the owner if lazy splitting is still required.

### Verification / measurements

- `npm run verify`: **495 tests passed (51 files)**; typecheck, lint, format, build and size all green. Ten `tests/static-cache.test.tsx` cases cover remount identity + zero disposal, mobile-toggle no-regeneration, the StrictMode double-invoke, refcount-0-only disposal, cap/HMR eviction, the real production painter branch (`factoryUsesCache(createPlanTexture) === true`) with a `RoomScene` remount, factory-identity keying, all-10-texture/full-family teardown on a non-force clear, and a genuine seed/quality change with deferred release.
- Dev-path check: `npm run qa:dev-render` against a fresh `npm run dev` (port 5176; 5173–5175 were already occupied) — `canvas=true`, `glLost=false`, `layerOpacity=1`, `consoleErrors=0`, luma contrast 240.3, `mainLeft=720`. No disposed-resource regression under StrictMode dev double-invoke.
- Scene chunk: **225.13 kB brotli** (was 225.21 kB, Δ **−0.08 kB**, well inside the ≤8 kB commit budget); headroom to the 260 KB hard gate: **34.87 kB**. Shell: **178.76 kB brotli** (unchanged). `cachedRoomCount()` stays at 1 for the single seed/quality and never exceeds the two-idle-entry cap.
- Commit / push / blockers: see the PR #6 head commit message and the draft PR notes (no blockers; the SwiftShader absolute-frame-time caveat from the previous section still applies and is unchanged by this commit).

## polish(c) — diegetic in-world detail + a11y mirror (commit 66eed95, follow-up fixes at HEAD)

### What

- **Feature (66eed95):** in fine-pointer live 3D the book (Experience), lifted case (Projects), CRT (About) and projector INFO card (Climate) render as textured, animated `DetailPlane`s inside the room. The SAME verbatim copy survives as a visually-hidden DOM `DetailMirror` in the a11y tree/tab order — revealed only by real keyboard `:focus-visible`, never for pointer users. Every fallback (2D, coarse pointer, reduced motion, no drawn frame, scene failure) keeps the ordinary visible Mantine dialog. Cache, StrictMode-deferred disposal, zone gates and 2D-first shell are unchanged.
- **Follow-up fixes (this HEAD):** (1) `#detail-return` now precedes the overlays in `App.tsx`, so one natural **forward Tab** from the trigger reaches the open mirror — the old 40× Shift+Tab wrap-around in `scripts/qa/detail-mirror.spec.ts` is removed and replaced by the real path (all four surfaces + DOM-card open are unit-tested in `tests/detail-forward-tab.test.tsx`). (2) Detail-texture eyebrow/footer moved from gold to the lettering token; (3) body-line budget derives from the space left after a two-line title so the footer no longer overlaps; (4) detail planes swallow `onPointerDown`/`onClick` so clicks never reach picks behind them; (5) forced-3D axe scans set `sceneReady: true` and now scan the four mirrors, not fallback dialogs; (6) `HomeControl` clears hover/cursor on unmount or when it becomes non-interactive; (7) the global 15s Vitest timeout is replaced by a file-local limit on the slow axe suite only.

### Why

- Owner review (2026-11-24) required clicked-into content to stay in-world with a visually-hidden DOM mirror, and round-3 polish review found the remaining MEDIUM/LOW defects above before merge. Forward-Tab is the keyboard contract a screen-reader user actually follows; gold-on-ink grades to 2.82:1 (below the 3.9 in-world floor); a sticky hover cursor/gold badge misleads pointer users after a zone change.

### Verification / measurements

- `npm run verify` green: typecheck, lint + CSS hex guard, format, **545 tests (57 files)**, build, size. Brotli: shell **179.41 kB ≤185**, scene **227.56 kB ≤260** (Δ +2.43 kB; 32.44 kB headroom), flat book **7.75 kB ≤16**, deferred WebGL **51.16 kB ≤70**.
- `npx playwright test scripts/qa/detail-mirror.spec.ts` **3/3 passed** (19.6 s) in headless Chromium/SwiftShader, including the new forward-Tab path; `desktop_3d_detail-mirror-focus.png` re-captured through it. Coarse-pointer and reduced-motion fallbacks still show the visible dialog.
- Contrast (true WCAG Rec.709, shipped grade): lettering/ink **14.64:1 pre-grade / 4.23:1 graded-worst** (≥3.9 floor); gold/ink **8.69 / 2.82** — gold is now the non-text frame rule only. `LEVEL_COLORS`, WCAG floors, size caps, cache/StrictMode/disposal and 2D-first unchanged.
- New/updated tests: forward-Tab for all four surfaces + DOM-card open, four axe mirror scans, body/footer separation with a two-line title, pointer-hit swallowing, live↔fallback handover + focus restore, per-zone appearance gates with fallback suppression (all four planes), and HomeControl hover cleanup on zone change / mode toggle.

### Notes for reviewer

- **A11y detail contract (corrected):** as of `db856af` the detail readout is ONE visible, scrollable, focus-trapped modal panel in every mode (`aria-modal="true"`, in-world gesture underneath), not the earlier non-modal sr-only mirror. Escape closes it and F2 restores focus to the opener / `#detail-return`. Correction to the earlier note: `jsdom` cannot evaluate `:focus-visible` or an inert subtree, and the browser spec (`detail-mirror.spec.ts`) asserts **observable focus/geometry behaviour** (visible scrollable box, `aria-modal`, focus restore, same panel in fallbacks) — it does **not** read the `inert` attribute itself. No jsdom or browser test claims direct `inert` attribute coverage; the modal contract is verified through focus behaviour and the `aria-modal`/backdrop markers.
- **Test-timeout scoping:** the previous global `testTimeout: 15_000` in `vite.config.ts` could mask real hangs; it is now `vi.setConfig({ testTimeout: 15_000 })` inside `tests/axe.test.tsx` only (the ~6 s climate heatmap scan). All other files use the 5 s default.
- **Minor a11y addition:** `ClimateView` accepts an optional `regionLabel`; the projector copy is named "Our Climate, Our Future — Projector Feed" so the mirror's landmark is unique beside the live 2D zone view (axe `landmark-unique` was otherwise violated when both are mounted).
- **Risk:** the browser QA still uses fixed-pixel 3D picks for other surfaces; the mirror forward-Tab spec drives the projector via its DOM trigger plus the F2 proxy, and the jsdom suite covers the other three surfaces deterministically. The SwiftShader absolute-frame-time caveat from earlier sections is unchanged by this commit. PR stays DRAFT — no merge/force-push.

## Commit 6 — final cross-device evidence (2026-11-26, on PR head `db856af`)

**Verdict: PASS.** `npm run verify` green; `npm run capture:qa` **20/20**; `npm run perf:qa` **2/2**; **554/554** unit/component tests (58 files). Every screenshot/recording in this directory was regenerated from this exact tree (**54 PNGs**, including 5 dev-path shots, plus **3 WebMs**). This commit sits on the branch's current head `db856af` (which follows the locked-plan head `3f30c5b`); no force-push was used. PR #6 remains **DRAFT** — no merge or push to `main`.

### Harness repair (diegetic-only controls)

The semantic `<nav>` stays sr-only in live 3D (a11y/keyboard path) while `db856af` adds a separate clickable pointer strip; the ModeToggle lives inside that sr-only nav, so a Playwright `.click()` on its 1px box timed out. The shared helper `scripts/qa/keyboard-controls.ts` **focuses the real DOM control and activates it with Enter** — the path a screen-reader user takes — in `capture.spec.ts` (menu navigation + mode-toggle recordings) and `perf.spec.ts` (all three camera flights, both toggles, the 5-toggle leak loop). It is independent of pointer placement under SwiftShader. No product assertion was weakened: `capture.spec.ts` still asserts WebGL2, `.scene-layer--ready`, overflow, a **visible, scrollable detail panel** (`expectVisiblePanel`) and F2 focus restore; `perf.spec.ts` still asserts `n > 1` samples, draw-call/program caps and non-increasing geometry/textures. The perf sampler now waits until 3 real rAF samples exist (SwiftShader can deliver <1 frame/s) instead of relying on a wall-clock delay. Playwright's per-test timeout was raised 180 s → 300 s purely to accommodate multi-zone SwiftShader screenshots; assertions are unchanged.

### CI perf gate

`.github/workflows/ci.yml` gains a second job, `perf-gate`, which installs Chromium, runs `npm run perf:qa` and uploads `qa-evidence/perf/` on every outcome. The gate is the **relative median p95** per workload vs `qa-evidence/perf-baseline.json` (≤10 % + 2× the recorded `jitterMs` band); the jitter semantics are unchanged (still `max(p95Samples) − min(p95Samples)` from the committed baseline). On real-hardware WebGL both the relative gate and the absolute 16.7 ms desktop / 22 ms mobile targets are **hard failures**. On headless SwiftShader the comparison is emitted as **informational** (the numbers are noise-dominated on a shared runner — identical runs swing several-fold) and never blocks; this is the documented "SwiftShader informational" policy, not hidden data. `src/scene/perf-events.ts` now installs `__scenePerfInfo` **only when `window.__perf` exists** (the QA harness), so the production canvas no longer carries an unconditional renderer-internals debug surface; `gl.info.autoReset = false` was already QA-gated.

### Coverage matrix (3 viewports × modes × 5 zones + diegetic/a11y states)

Every row is PASS; each 3D shot asserts live WebGL2 + `.scene-layer--ready`, and every row checks no horizontal page overflow.

| Viewport / DPR                   | Mode                               | Zones captured                                                      | Diegetic detail / dialogs / states                                                                                                                                                           | Result   |
| -------------------------------- | ---------------------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Desktop 1440×900 @1              | 3D fine-pointer                    | home, about, experience, projects, climate (5/5)                    | book, case, CRT, projector (4/4 in-world gestures + visible scrollable DOM panel); plaque, CRT dock, projected strip, HOME badge, pointer strip, keyboard menu, medium-width, CRT close-up   | **PASS** |
| Desktop 1440×900 @1              | 2D forced                          | home, about, experience, projects, climate (5/5)                    | —                                                                                                                                                                                            | **PASS** |
| Desktop 1440×900 @1              | auto→2D fallbacks                  | home (4/4)                                                          | reduced-motion, no-WebGL2, save-data, canonical scene-failure sentinel                                                                                                                       | **PASS** |
| Tablet 768×1024 @1               | 3D fine-pointer                    | home, about, experience, projects, climate (5/5)                    | 768–1023 px diegetic right column / no gutter                                                                                                                                                | **PASS** |
| Mobile 390×844 @2 (coarse/touch) | 3D default                         | home, about, experience, projects, climate (5/5)                    | opaque ≥44 px DOM menu; same visible detail panel; `#detail-return` absent in fallback                                                                                                       | **PASS** |
| Mobile 390×844 @2                | 2D forced                          | home, about, experience, projects, climate (5/5) + scrolled heatmap | —                                                                                                                                                                                            | **PASS** |
| All tiers                        | a11y detail panel                  | projector (browser) + book/case/monitor (jsdom)                     | one visible, scrollable, focus-trapped panel in every mode; forward Tab from `#detail-return` lands on the close button; Escape restores focus                                               | **PASS** |
| Desktop 1440×900 @1              | loading / reduced-motion / dialogs | —                                                                   | delayed scene chunk "Loading the room…" cut-in; static-cut 3D HUD + frozen grain; dialog close before hash navigation                                                                        | **PASS** |
| Desktop 1440×900 @1 (dev server) | 3D fine-pointer                    | home + zone spotlight                                               | StrictMode dev render: semantic nav stays 1px (pointer strip is separate), keyboard reveal `/`, `glLost=false`, luma 239; one dev-only Open-Meteo 429 console error (no GPU/disposal errors) | **PASS** |

**Counts:** 20/20 Playwright `capture:qa` tests PASS, 0 FAIL; 54/54 screenshots PASS (no blank canvas, cut-off text, overflow or missing widget in a passing shot); 3/3 recordings produced; 6/6 diegetic framing tests + 3/3 detail-panel browser tests. Earlier captures at commits 0/3c recorded FAILs (sentinel mismatch D1, stale dialog D6, desktop perf timeout) — all resolved and re-captured here.

### Frame-time evidence (`qa-evidence/perf/latest-{desktop,mobile}.json`)

`ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)`, vendor `Google Inc.`, WebGL 2.0 (OpenGL ES 3.0 Chromium). Median of 3 measured runs after one warm-up; **workload** p50/p95 in ms (informational on SwiftShader, _not_ fps):

| Workload            | Desktop p50 / p95 | Mobile p50 / p95 |
| ------------------- | ----------------: | ---------------: |
| Flight → Experience |       3.1 / 418.0 |      68.7 / 94.3 |
| Flight → Projects   |      12.8 / 417.6 |     68.8 / 186.3 |
| Flight → Climate    |       4.8 / 425.4 |     69.2 / 207.9 |
| 2D↔3D toggle        |     352.3 / 936.7 |     15.1 / 165.1 |
| Dialog open/close   |      92.1 / 403.4 |      14.5 / 70.8 |

Desktop whole-frame `renderer.info`: **92 draw calls / 20 programs** (caps ≤100 / ≤25; mobile 26 / 11); the 5-toggle leak loop asserts non-increasing geometries/textures. `env=swiftshader` is recorded in every artifact; the desktop toggle's large p95 comes from shader recompilation on mode switches under software GL. Absolute 60 fps desktop / ≥45–60 fps capable-mobile targets still require the owner's real hardware.

### Sizes, toolchain and housekeeping

- `npm run verify` green: typecheck, ESLint + CSS hex guard, Prettier, **554 tests (58 files)**, build, size. Brotli: shell **167.34 KB ≤185**, scene **226.54 KB ≤260** (33.5 KB headroom). The flat-book / deferred-WebGL buckets are now _deferred_ (no chunk emitted by the current detail-panel implementation), so `check-3d-budget.mjs` reports them as no-match rather than failing; their ≤16 / ≤70 KB caps remain configured. New `tests/perf-events.test.ts` pins the QA-only `__scenePerfInfo` gate (2 cases).
- Playwright **1.65.1**, Chromium build **1255** / Chrome for Testing **159.0.8154.6**, FFmpeg **1013**; launch args `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist`; `workers: 1`, no retries. Built site base `/portfolio/`, URLs `http://127.0.0.1:4173/portfolio/#/<route>`.
- Evidence footprint: screenshots **39 MB / 54 files**, recordings **7.7 MB / 3 files** (desktop navigation, mode toggle, mobile tap). `qa-evidence/perf/steady-desktop.png` ~1.4 MB.
- Only **one** server is needed for capture: Playwright starts/stops a single `vite preview` on 4173; the long-lived dev server on 5173 is used only by the optional `qa:dev-render` script (refreshed here from an isolated 5176 dev server). `qa-evidence/.artifacts/` (Playwright scratch) is gitignored; no stray `test-results/` directory exists; the `prebuild` climate-snapshot date refresh was reverted and is not part of this commit.

### Honest gaps / deviations

- SwiftShader relative-gate runs are advisory (see above); real-hardware p95 validation remains an owner gate.
- Fixed-pixel 3D picks (book/case/monitor) remain a known fragility (D4) — recalibrate after geometry/layout changes.
- Mobile portrait still occludes most of the room behind the authoritative 2D-first shell (D2); the climate heatmap scrolls horizontally inside its figure at 390 px (D3). Neither is a blank canvas or page overflow.
- `capture:qa` was split from `perf:qa`: the perf gate needs a quiet browser because SwiftShader frame times inflate under GPU contention with the visual matrix. CI runs them as separate jobs for the same reason. This is a harness/workflow change only; all assertions remain.
- The Low review items are all present on this PR head: accurate HomeControl cursor-ownership comment, QA-gated `__scenePerfInfo`, forward-Tab assertion requiring focus on the close button, `onPointerOver`/`onPointerOut` stopPropagation on detail planes (with a matching test), and `#detail-return` asserted absent in both fallback browser tests — these landed in `db856af`. This commit adds the new regression test for the perf hook gate and **corrects the stale `inert` browser-coverage note** (line 236): no jsdom or browser test reads the `inert` attribute itself; the browser spec asserts focus/geometry and `aria-modal`, and the modal panel's focus trap is behaviour-tested, not attribute-tested.
