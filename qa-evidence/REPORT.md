# Visual QA evidence — PR #6 (`rework/3d-room`, HEAD `e9cd4dc`)

Real-browser screenshot + recording pass for the portfolio rework. **No source-code changes.**
All 3D shots below are genuine WebGL2 renders (SwiftShader/ANGLE in headless Chromium), not 2D stand-ins.

## Tooling & conditions

- **Playwright:** `npm i -D @playwright/test` → added `@playwright/test@1.x` (3 packages). `npx playwright install chromium` → Chrome for Testing `159.0.8154.6` (playwright build `1255`) + FFmpeg `1013` + headless shell. Both installs completed successfully; no download was blocked.
  - `package.json` / `package-lock.json` were touched by the install and **restored to HEAD before the commit** — only `qa-evidence/` is staged.
  - Node `v21.1.0`, npm `10.2.0`. `npm i` emitted a pre-existing `EBADENGINE` warning for `camera-controls@3.1.2` (wants Node ≥22); it did not affect the build or the capture run.
- **WebGL2:** verified in-page on every 3D context. `canvas.getContext('webgl2') !== null` → **true**.
  - Renderer: `ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)`, vendor `Google Inc.`, version `WebGL 2.0 (OpenGL ES 3.0 Chromium)`.
  - Launch args: `['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']`.
  - Capability probes on the default desktop context: `hardwareConcurrency=8`, `deviceMemory=16`, `pointer:fine`, no reduced-motion, no save-data → capable desktop → **default 3D with no override**. Mobile emulation (`390x844`, `deviceScaleFactor:2`, `hasTouch:true`, `isMobile:true`) reports `pointer:coarse` → mobile tier → **default 3D**.
- **Built site:** `npm run build` green (109 modules; shell `index-C5iotO9Q.js` 243.47 kB, scene `Room-BeELv-3c.js` 975.08 kB), served with `npm run preview -- --host 127.0.0.1 --port 4173`. Base path `/portfolio/`; URLs `http://127.0.0.1:4173/portfolio/#/<route>`. Preview server was stopped after capture. `public/climate-snapshot.json` was left byte-identical (prebuild drift guard reported "data unchanged"; SHA-256 verified before/after).
- **Mode forcing:** persisted override via `addInitScript(() => localStorage.setItem('portfolio:mode','2d'))`; no-WebGL2 stub overrides `HTMLCanvasElement.prototype.getContext` to return `null` for `webgl`/`webgl2`/`experimental-webgl` while leaving `2d` intact; save-data stub defines `navigator.connection.saveData = true`; reduced-motion via Playwright `reducedMotion:'reduce'`; scene failure via the sentinel the code actually reads (`'true'` — see defect D1).
- **Loading state:** `page.route('**/assets/Room-*.js', …)` delayed the scene chunk by 2 s before continuing.
- **Screenshot timing:** after `.scene-layer--ready`, waited ~2.4 s (520 ms fade + damped camera flight settle) before each 3D shot. Dialogs were opened by **real 3D pointer picks** (hover detected via R3F's `document.body.style.cursor = 'pointer'`), except where noted.

## Capture matrix

`Result` is the honest visual/programmatic verdict for that exact shot. "Room visible" means the WebGL canvas rendered scene content behind the authoritative 2D DOM shell. Every row: `overflow = 0 px` (document `scrollWidth === innerWidth`) unless stated. No blank canvases, cut-off text or missing widgets were observed in any passing shot.

| #   | File                                              | Route                    | Viewport / DPR | Mode         | What's visible                                                                | Result   | Glitch / note                                                                                                |
| --- | ------------------------------------------------- | ------------------------ | -------------- | ------------ | ----------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------ |
| 1   | `desktop_3d_home.png`                             | `#/`                     | 1440×900 @1    | 3d (default) | Room + desk/floor, hero panel & menu; canvas ready                            | PASS     | Room largely covered by DOM hero panel by design                                                             |
| 2   | `desktop_3d_about.png`                            | `#/about`                | 1440×900 @1    | 3d           | Desk/monitor framed behind About desktop DOM                                  | PASS     | —                                                                                                            |
| 3   | `desktop_3d_experience.png`                       | `#/experience`           | 1440×900 @1    | 3d           | Bookshelf framed behind experience list                                       | PASS     | —                                                                                                            |
| 4   | `desktop_3d_projects.png`                         | `#/projects`             | 1440×900 @1    | 3d           | Game cases on desk behind project cards                                       | PASS     | —                                                                                                            |
| 5   | `desktop_3d_climate.png`                          | `#/climate`              | 1440×900 @1    | 3d           | Projector screen + heatmap behind climate widgets                             | PASS     | —                                                                                                            |
| 6   | `desktop_2d_home.png`                             | `#/`                     | 1440×900 @1    | 2d (forced)  | 2D shell, no canvas                                                           | PASS     | —                                                                                                            |
| 7   | `desktop_2d_about_windows.png`                    | `#/about`                | 1440×900 @1    | 2d (forced)  | About desktop DOM, no canvas                                                  | PASS     | —                                                                                                            |
| 8   | `desktop_2d_experience_list.png`                  | `#/experience`           | 1440×900 @1    | 2d (forced)  | Experience card list, no canvas                                               | PASS     | —                                                                                                            |
| 9   | `desktop_2d_projects_list.png`                    | `#/projects`             | 1440×900 @1    | 2d (forced)  | Project card grid, no canvas                                                  | PASS     | —                                                                                                            |
| 10  | `desktop_2d_climate_heatmap.png`                  | `#/climate`              | 1440×900 @1    | 2d (forced)  | Statement, today widget, 2026 heatmap + legend + attribution                  | PASS     | —                                                                                                            |
| 11  | `mobile_3d_home.png`                              | `#/`                     | 390×844 @2     | 3d (default) | Portrait framing; room slivers between panels; hero + menu                    | PASS     | Room mostly occluded by tall DOM content (see D2); menu scrolls horizontally by design                       |
| 12  | `mobile_3d_experience.png`                        | `#/experience`           | 390×844 @2     | 3d (default) | Portrait zone; room visible at edges behind list                              | PASS     | Same occlusion note (D2)                                                                                     |
| 13  | `mobile_3d_climate.png`                           | `#/climate`              | 390×844 @2     | 3d (default) | Portrait zone; projector trigger + climate widgets                            | PASS     | Same occlusion note (D2)                                                                                     |
| 14  | `mobile_2d_home.png`                              | `#/`                     | 390×844 @2     | 2d (forced)  | 2D home, no canvas                                                            | PASS     | —                                                                                                            |
| 15  | `mobile_2d_climate.png`                           | `#/climate`              | 390×844 @2     | 2d (forced)  | Statement + today widget; no canvas                                           | PASS     | Heatmap below fold — see #16                                                                                 |
| 16  | `mobile_2d_climate_heatmap.png`                   | `#/climate` (scrolled)   | 390×844 @2     | 2d (forced)  | Year selector, heatmap, legend, Open-Meteo / CDF attribution                  | PASS     | Heatmap scrolls horizontally **inside its figure** at 390px (full year needs a swipe); no page overflow (D3) |
| 17  | `desktop_auto2d_reduced-motion_home.png`          | `#/`                     | 1440×900 @1    | auto→2d      | 2D shell; 3D button disabled/dimmed; no canvas                                | PASS     | —                                                                                                            |
| 18  | `desktop_auto2d_no-webgl2_home.png`               | `#/`                     | 1440×900 @1    | auto→2d      | 2D shell fully usable; 3D button disabled; no canvas                          | PASS     | —                                                                                                            |
| 19  | `desktop_auto2d_save-data_home.png`               | `#/`                     | 1440×900 @1    | auto→2d      | 2D shell; 3D button disabled; no canvas                                       | PASS     | —                                                                                                            |
| 20  | `desktop_auto2d_scene-failed_home.png`            | `#/`                     | 1440×900 @1    | auto→2d      | 2D shell after `portfolio:3d-failed='true'`; no canvas                        | PASS     | —                                                                                                            |
| 21  | `desktop_auto2d_scene-failed-sentinel-1_home.png` | `#/`                     | 1440×900 @1    | **3d**       | Stayed in 3D with `portfolio:3d-failed='1'`                                   | **FAIL** | Defect D1 — task-specified sentinel `'1'` is not the value the code reads                                    |
| 22  | `tablet_3d_home.png`                              | `#/`                     | 768×1024 @1    | 3d (default) | Room behind hero; canvas ready                                                | PASS     | —                                                                                                            |
| 23  | `tablet_3d_climate.png`                           | `#/climate`              | 768×1024 @1    | 3d (default) | Projector + climate widgets; canvas ready                                     | PASS     | —                                                                                                            |
| 24  | `desktop_3d_loading.png`                          | `#/` (chunk delayed 2 s) | 1440×900 @1    | 3d (loading) | P5 **"LOADING THE ROOM…"** cut-in visibly centered above shell; no canvas yet | PASS     | Past bug not reproduced — indicator is visible                                                               |
| 25  | `desktop_3d_book-detail.png`                      | `#/experience`           | 1440×900 @1    | 3d           | Book detail DOM dialog over dimmed room; content + close button               | PASS     | Opened by 3D pick at (664,378)                                                                               |
| 26  | `desktop_3d_case-detail.png`                      | `#/projects`             | 1440×900 @1    | 3d           | Game-case detail dialog over dimmed room, screenshot + tags                   | PASS     | Opened by 3D pick at (900,440) (see D4)                                                                      |
| 27  | `desktop_3d_monitor-zoom.png`                     | `#/about`                | 1440×900 @1    | 3d           | Full-screen About desktop after 3D monitor pick; "BACK TO ROOM"               | PASS     | Opened by 3D pick at (850,350); desktop shows empty icon bar before a window is opened                       |
| 28  | `desktop_3d_climate-projector-panel.png`          | `#/climate`              | 1440×900 @1    | 3d           | Projector info dialog over room: statement, widget, heatmap, legend           | PASS     | Opened via the accessible "Open projector info panel" trigger after 3D hover search                          |

**PASS 27 / FAIL 1** (the single FAIL is the `'1'` sentinel scenario, defect D1 — the real `'true'` signal passes in #20).

## Recordings

| File                         | Route/action                                       | Capture size | Duration | Verified content                                                   |
| ---------------------------- | -------------------------------------------------- | ------------ | -------- | ------------------------------------------------------------------ |
| `desktop-3d-navigation.webm` | 3D Home → Experience → Projects → Climate via menu | 960×600      | 18.6 s   | All three camera flights; ends on Climate with projector visible   |
| `desktop-mode-toggle.webm`   | 3D → 2D → Auto                                     | 960×600      | 9.7 s    | Room disappears into 2D shell, then returns on Auto (ends "3D ON") |
| `mobile-3d-home.webm`        | Mobile 3D Home → tap Experience                    | 390×844      | 7.3 s    | Portrait room + tap-driven zone flight (ends on Experience)        |

- **28 screenshots** (16,324,318 bytes) + **3 recordings** (4,710,573 bytes) ≈ **21.0 MB** total.
- The navigation clip is longer than the suggested 5–10 s because Playwright's screencast stopped receiving frames once the R3F demand loop idled; a screenshot was taken after each step to force frames. 18.6 s was the shortest capture that still shows all three flights. The other two clips are within the target range (see D5).

## Honest defects / observations (nothing hidden)

- **D1 — scene-failure sentinel mismatch (the one FAIL).** The task asked to test `localStorage.setItem('portfolio:3d-failed','1')`. The implementation reads `localStorage.getItem(SCENE_FAILURE_STORAGE_KEY) === 'true'` (`src/lib/device-tier.ts`, `readSceneFailure()`), so `'1'` does **not** trip the gate and the page stays in 3D (screenshot #21). The genuine signal, `'true'`, correctly forces auto-2D (screenshot #20). This is a task-description vs. code-sentinel mismatch, not a runtime crash; no source change was made. If the owner expects `'1'` to work, that needs a separate product decision/code change.
- **D2 — mobile portrait 3D room occlusion.** On 390×844 the authoritative DOM panels (hero, lists, widgets) cover most of the viewport; the WebGL room renders correctly (canvas present, ready, portrait pull-back applied) but is visible only in slivers between panels. Not a blank canvas or overflow, but the 3D fidelity on a phone is mostly hidden by the 2D-first shell.
- **D3 — mobile climate heatmap scrolls horizontally inside its figure** (`overflow-x-auto`) at 390px; a full-year view needs a horizontal swipe inside the panel. The legend, year selector and attribution are readable and the page itself has no horizontal overflow.
- **D4 — 3D pick hit areas are fiddly.** The first automated hover-grid pass (26 px steps) found the book and projector screen but missed the game cases and monitor; a fresh page with direct coordinates opened both. The picks work, but the effective hit targets are small relative to the overlaid DOM cards — worth a manual pointer review.
- **D5 — screencast frame starvation** under SwiftShader + demand frameloop (see Recordings). Worked around for evidence capture; not an app bug.
- **No blank WebGL canvas, no horizontal page overflow, no cut-off text and no missing climate widgets were observed in any passing shot.** All four fallback gates, the loading indicator and all four 3D dialogs behaved as intended.

## How to reproduce

```bash
cd /home/samerius/Portfolio/portfolio
npm i -D @playwright/test && npx playwright install chromium
npm run build
npm run preview -- --host 127.0.0.1 --port 4173
# open http://127.0.0.1:4173/portfolio/#/<route> in Chromium launched with:
# --use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist
# Force 2D: addInitScript localStorage.setItem('portfolio:mode','2d')
# Force fallbacks: reducedMotion:'reduce' | stub getContext('webgl2')=null |
#   stub navigator.connection.saveData=true | localStorage.setItem('portfolio:3d-failed','true')
# Loading: route('**/assets/Room-*.js', delay 1.5-2s)
```
