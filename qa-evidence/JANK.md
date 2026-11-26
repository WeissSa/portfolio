# Focused jank investigation — PR #6 (`perf(scene): reduce flight/interaction jank`)

Date: 2026-11-26. Base: `71b3802` (remote `rework/3d-room` head). Browser: headless
Chromium + SwiftShader (`--use-gl=angle --use-angle=swiftshader
--enable-unsafe-swiftshader --ignore-gpu-blocklist`), 1440×900, live dev server
`http://127.0.0.1:5173/portfolio/#/`. Method: `scripts/qa/perf-fix.mjs`-compatible
rAF probe + `PerformanceObserver('longtask')`, CDP CPU profiler (200 µs), and
GL method wrappers (`compileShader` / `getProgramInfoLog` / …). Raw data:
`qa-evidence/jank/*.json`. **Three before and three after runs, reported as
ranges. No single-run win is claimed.**

## Before / after (wall-clock ms, ranges across 3 runs)

| Metric                        | BEFORE (`71b3802`) | AFTER (this change) | Verdict                                 |
| ----------------------------- | ------------------ | ------------------- | --------------------------------------- |
| flight rAF p50                | 16.7 / 16.7 / 16.7 | 16.7 / 16.7 / 16.7  | unchanged                               |
| flight rAF p95                | **500 – 983.3**    | **550 – 1116.6**    | overlapping → **no proven improvement** |
| flight rAF max                | 916.6 – 983.3      | 783.3 – 1116.6      | overlapping                             |
| long frames (>34 ms)          | 4 – 7              | 4 – 7               | overlapping                             |
| hover → `cursor:pointer`      | 48 – 2028          | 1184 – 1531         | overlapping (both widely scattered)     |
| click → panel p50             | 70.7 – 266.3       | 190.5 – 253.4       | overlapping                             |
| click → panel p95             | 308.5 – 387.4      | 248.2 – 498.2       | overlapping                             |
| idle draw calls               | 96 / 96 / 96       | 96 / 96 / 96        | preserved (budget ≤100)                 |
| shader programs (idle → zone) | 17 → 17            | 17 → 17             | preserved; no lazy compile in flight    |
| in-zone draw calls            | 0 / 61 / 53        | 0 / 0 / 58          | noise (settled frames can render 0)     |

The UX-diagnosis baseline (`/tmp/opencode/ux-diagnosis/final-results.json`)
reported flight p95 350–417 ms and click p95 131–662 ms on a different set of
runs; the spread across identical runs is larger than any change measured here.

## What the attribution actually showed

1. **Shader compilation is a load cost, not a flight/hover/click cost.**
   GL wrappers recorded six `getProgramInfoLog` calls of 40–58 ms each during
   first draw (~300 ms total, part of the known first-frame compile). Twelve
   hover transitions produced **zero** compile/link/log events; a direct book
   click produced zero. `gl.info.programs` stayed at 17 from idle through a
   full flight (and geometries +4 / textures +1 are affordance/detail objects,
   not programs). `renderer.compileAsync` prewarming would only move those
   ~300 ms from first draw to an idle callback — it cannot remove them, and it
   risks regressing the already-fixed first-load freeze. **Not applied.**
2. **Raycast coalescing is already active** (`src/scene/perf-events.ts` L83–97):
   at most one `onPointerMove` → one R3F raycast per rAF, with pointerleave
   cleanup; coarse pointers never reach picking (`SceneLayer` gate). No extra
   raycast cap was added because there is no measured raycast CPU cost to fix.
3. **Detail click does not synchronously build content.** Climate data is
   loaded in an effect (`ClimateView`) from the snapshot; post/case HTML is
   build-time data; the in-world `DetailPlane` texture painter is not mounted
   by any zone. No click-path change was justified.
4. **Flight frames are native-raster bound.** CDP profile over a flight:
   `main` p95 1110 ms, of which the V8 profiler attributes ~896 ms to
   `(idle)`/native — i.e. time blocked inside SwiftShader `gl.render`, not JS.
   Identifiable JS was ~67 ms of React element creation (`jsxDEV`/`jsx`/`jsxs`)
   and ~7 ms of three.js `setProgram`/`getProgram` calls. A GL query wrapper
   showed no per-frame texture recreation; `PainterlyPass` target size is a
   `useEffect` of viewport size only and is stable across camera flights. The
   pass does two full `gl.render` calls per frame by design; removing or
   dynamically rescaling it would change the painted visual contract to help
   a software renderer that the owner already asked us not to optimise for.
   **Not applied.**
5. **Two structural causes were fixed** (they reduce work in the long frames
   without touching visuals): `SceneLayer` was not memoized, so every App
   re-render on `cameraSettled` / detail state reconciled the entire lazy
   Canvas tree — the ~67 ms of React element work in the flight profile. It is
   now `memo`-wrapped; its own store subscriptions still drive scene updates.
   `CameraRig` clamped `delta` to 0.1 s; a 350 ms SwiftShader frame therefore
   advanced 0.1 s of damp and stretched one flight into ~12+ expensive frames.
   The clamp is now 0.25 s: identical motion on 60 fps hardware (delta ~0.017),
   ~5 frames to settle when frames are severely delayed. A unit test pins the
   slow-frame settle contract.

## Verdict / honesty note

Under SwiftShader the interaction metrics swing several-fold between identical
runs; the before and after ranges overlap on every metric. **No interaction
jank win is claimed.** The two applied changes are low-risk structural work
(less React reconciliation mid-flight, fewer slow frames to render) and are
retained because they cannot regress the preserved contracts. Real-hardware
frame-time evidence is still required to judge smoothness; the QA videos use
software WebGL and under-represent it.

## Verification

- `npm run verify` green: typecheck, lint + CSS hex guard (2 pre-existing
  warnings, 0 errors), format, **560 tests / 59 files**, production build,
  size + 3D budget. Shell **167.49 kB ≤185**, scene **227.35 kB ≤260** brotli.
- No token, CSS, router, menu, dialog, draw-call, texture or shader change.
  2D-first, contrast/a11y, cache/StrictMode, shell ≤185 KB and scene ≤260 KB
  contracts untouched.
