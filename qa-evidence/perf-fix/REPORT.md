# Real-browser performance fix — `perf(ux): eliminate first-load freeze + flight/interaction jank`

Date: 2026-11-26. Branch `rework/3d-room` (PR #6, stays DRAFT). Method: the SAME
dev-server instrumentation as the UX diagnosis (`/tmp/opencode/ux-diagnosis/REPORT.md`):
headless Chromium + SwiftShader (`--use-gl=angle --use-angle=swiftshader
--enable-unsafe-swiftshader --ignore-gpu-blocklist`), 1440×900, real pointer
coordinates discovered by grid-scanning the live canvas (no store writes),
`window.__perf` rAF sampler + `PerformanceObserver('longtask')`, and the app's
QA-only `canvas.__scenePerfInfo()` (`gl.info`, `autoReset=false`, reset + one
frame). Harness: `scripts/qa/perf-fix.mjs`; raw artifacts `before.json`,
`after.json` and six PNGs in this directory. **No headless-only claims.**

## Before / after (wall-clock ms, browser `performance.now`)

| Metric                                       | BEFORE (base `db856af`)    | AFTER (this commit) | Verdict                                                     |
| -------------------------------------------- | -------------------------- | ------------------- | ----------------------------------------------------------- |
| FCP                                          | 156                        | 168–204             | unchanged; 2D-first intact                                  |
| React shell (mirror gone)                    | 711                        | 662–667             | unchanged (instant shell)                                   |
| first `<canvas>` mounted                     | **1463**                   | **942–1275**        | improved (~35% at median)                                   |
| `.scene-layer--ready` (first drawn 3D frame) | **2668**                   | **1784–2047**       | improved (~25–33%)                                          |
| longest main-thread task during load         | **922**                    | **484–522**         | ~45% shorter; first-frame software-GL compile still ~480 ms |
| idle draw calls (`gl.info`, one frame)       | **169**                    | **96**              | budget ≤100 now passes                                      |
| in-zone draw calls                           | 121                        | 58                  | improved                                                    |
| camera-flight rAF p95                        | 383 (other runs: 516–1350) | 267–1033            | **no reliable improvement** under SwiftShader               |
| hover → `cursor:pointer`                     | 160                        | 148–1292            | **no improvement**; noise-dominated                         |
| click → panel visible p95                    | 249 (other run: 520)       | 378–616             | **no improvement / apparent regression**                    |

Honesty note: SwiftShader software rendering on this shared host swings
several-fold between identical runs (the BEFORE flight p95 was 383 ms in the
final baseline run but 516–1350 ms in earlier runs; AFTER hover was 148 ms in
one run and 1292 ms in the next). The load-timeline and **draw-call** numbers
are stable and repeatable; the per-frame interaction numbers are NOT. They are
reported as ranges above, not as a success claim. The absolute 60/45 fps
targets still require the owner's real hardware.

## What was fixed

1. **First-load freeze** — `src/scene/art/textures.ts`: the 10 seeded paint
   plans now paint in `requestIdleCallback` slices (base fill at creation,
   ≤160 ops/slice, one redraw per three slices), with `setTimeout(0)` fallback
   and cancellation. The SAME ops run in the SAME order on the SAME canvas, so
   textures are byte-identical to the old synchronous painter (seeded
   determinism and texture caps unchanged). `paintOp` no longer does
   `save()`/`restore()` for every op — only the two transform-mutating ops do.
   Wood/plaster/rug/book-atlas plans dropped 512→256 px (~4× less fill).
   `static-cache.ts` carries the idle painter with the cached resources;
   `Room.tsx` starts it idempotently and invalidates after each painted batch;
   disposal cancels it before the canvases are freed.
2. **Draw calls ≤100** — `geometry.ts` gained `mergePartsByMaterial` (bakes
   static same-material siblings into one geometry, preserves baked AO colour
   and never merges pickable/animated families). `static-cache.ts` merges the
   shell, desk, tower, bookshelf, lamp, projector, window, chair, frames and
   narrative props. `Room.tsx` restricts shadow _casting_ to desk/chair/tower/
   bookshelf; every other mesh still receives the key shadow but skips the
   shadow-map draw. Measured 169→96 idle, 121→58 in-zone.
3. **Flight frame cost** — `effects/PainterlyPass.tsx`: offscreen target MSAA
   2→0 (the painted grain/stroke dither already softens edges). This removed
   the last consistent per-frame fill multiplier. Flight p95 remains
   noise-dominated under SwiftShader; relative improvement is **unproven**.
4. **Dev bundle** — `vite.config.ts`: explicit `optimizeDeps.include` for the
   three/R3F/Mantine/react/zustand graph so Vite prebundles it at server start
   instead of transforming ~6 MB of unbundled ESM on first request. This is a
   **dev-server** change only; production shell (167.47 kB brotli) and scene
   (227.47 kB brotli) budgets are unchanged.

## Deferred / explicitly not fixed

- Book-click and hover latency: a deferred-body experiment in `DetailMirror`
  made click p95 measurably WORSE (378/409 vs 249 ms) and was reverted. The old
  1217 ms synchronous detail-texture paint path is gone (the UX-fix commit
  made details DOM), but click latency under SwiftShader is still ~250–600 ms
  and is dominated by software rasterisation, not by app JS. No claim of a win.
- Shader pre-compilation at idle, lowering the 1024² shadow map, and merging
  the pickable monitor/plaque/case families were NOT done: the first two are
  visual-contract changes and the last would break per-object picking.
- CI perf gate stays advisory on SwiftShader by design (documented policy);
  it is not converted to a hard software-rendering failure.

## Verification

- `npm run verify` green (typecheck, lint + CSS hex guard, format, Vitest,
  production build, size-limit + 3D budget): **559 tests / 59 files** green;
  shell **167.39 kB ≤185**, scene **227.21 kB ≤260** brotli.
- Real-browser harness re-run against the exact final tree (three AFTER runs;
  the last one is the committed `after.json`). Screenshots: `after-ready.png`,
  `after-flight.png`, `after-book-panel.png` and the matching `before-*.png`.
- Accessibility/2D-first/contrast contracts untouched: no token, CSS, router,
  menu or dialog logic changed in this commit. Scene stays ≤260 KB, shell ≤185 KB.
