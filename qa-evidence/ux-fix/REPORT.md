# Real-browser UX fix evidence (2026-11-26)

Method: `npm run dev` at `http://127.0.0.1:5173/portfolio/`, headless Chromium

- SwiftShader (`--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader
--ignore-gpu-blocklist`), desktop 1440×900 and mobile 390×844/DPR2. Real pointer
  coordinates were found by grid-scanning the live canvas and waiting for
  `document.body.style.cursor === 'pointer'` — no zustand writes, no headless
  shortcuts. Camera-return was verified by hashing two real canvas captures.

## Defects and evidence

| Defect                                              | Result                                                                                                                                                                                                                                                                                                      | Evidence                                          |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| BLOCKER 1 — details truncated / 2×2px hidden mirror | Fixed. One visible, scrollable DOM panel in every mode; book panel 736×720, 15px text, `overflow-y:auto`, full verbatim prose, 3 tag chips, repo link.                                                                                                                                                      | `02-book-panel.png`, `03-book-panel-scrolled.png` |
| BLOCKER 2 — monitor detail clipped                  | Fixed. Painted 3D CRT card removed; readable About panel fits viewport (736×720, y=146–866).                                                                                                                                                                                                                | `05-monitor-panel.png`                            |
| MAJOR 4 — no pointer menu                           | Fixed. Persistent brass strip, 617×93, five 44px targets, outside `.app-shell` so it stays clickable while a panel is open.                                                                                                                                                                                 | `01-pointer-menu.png`                             |
| MAJOR 5 — HOME fails during detail                  | Fixed. Strip click closes all detail state and navigates; canvas hashes `c090c0d8 → fab94652`.                                                                                                                                                                                                              | `04-home-after-detail.png`                        |
| MAJOR 7 — mobile nav cut off                        | Fixed. All five routes wrap inside 390px, ≥44px, last route clickable through to `#/climate`.                                                                                                                                                                                                               | `06-mobile-all-routes.png`                        |
| MAJOR 8 — overlap / desync                          | Fixed. No in-world detail planes remain; panel framed below the menu strip (asserted: panel.y ≥ strip.bottom); DOM zone content gated on `cameraSettled`.                                                                                                                                                   | `02-book-panel.png`, `05-monitor-panel.png`       |
| MINOR 9 — joined tag string                         | Fixed. Real chips in the DOM panel (3 found on the picked book).                                                                                                                                                                                                                                            | `02-book-panel.png`                               |
| MINOR 10 — sticky pointer                           | Fixed. `pointerleave`/`pointercancel` on the canvas clears body cursor and hover flags; simulated leave verified.                                                                                                                                                                                           | console log of verification run                   |
| MINOR 11 — console warnings                         | Partly fixed. `PCFSoftShadowMap` warning eliminated by explicit `shadows="percentage"` (PCFShadowMap). `THREE.Clock` warning remains: it is emitted by `@react-three/fiber`'s internal `new THREE.Clock()` (v9.8.2), not by app source; fixing it needs a dependency upgrade/patch, which was out of scope. | verification log                                  |

## What was deliberately NOT fixed

- BLOCKER 3 / MAJOR 6 (load freeze, flight jank, draw-call budget) were not in
  this fix-pass scope. First paint still precedes a slow React/scene boot under
  SwiftShader, and camera flights still spike on first program/shadow compile.
- The one `THREE.Clock` deprecation warning described above.
- An occasional `429` from the live Open-Meteo climate API appeared in one
  dev run; the app already falls back to its cached/snapshot data.

## Test counts

- `npm run verify`: green — 57 files / 552 tests passed, typecheck, lint,
  format check, build and size gates all passed.
- Playwright QA: 11/11 passed (`detail-mirror.spec.ts`, `diegetic.spec.ts`);
  capture spec's `desktop 3D details` case passed.
- Size-limit: 167.38 KB brotlied (limit 185 KB); 3D scene chunk 226.45 KB
  brotlied (limit 260 KB). The deferred book chunk is no longer emitted.
