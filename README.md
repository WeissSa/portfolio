# Sam Weiss — Portfolio ("The Room")

A painterly 3D portfolio room built with **Vite + React 19 + TypeScript + react-three-fiber**, with a complete, always-usable high-contrast arcade-styled 2D DOM experience underneath. Deployed to GitHub Pages at <https://weisssa.github.io/portfolio/>.

## Architecture

- `src/content/` — typed single source of truth (13 posts, bio, links, SEO, climate copy). `climate-config.mjs` is shared by the browser client and the build-time snapshot script.
- `src/state/store.ts` — zustand store: mode, active hash route, climate cache, About windows, 3D selection/hover, year.
- `src/ui/` — the arcade-pop design system and every content panel: main menu, mode toggle, Experience/Projects/Climate views, desktop-OS About (`DesktopZoom` shares `AboutDesktop`), focus-managed detail dialogs, scene error boundary. **Mantine-first (owner decision 2026-11-22):** buttons, panels, dialogs/modals, badges, selects, tooltips and icons are Mantine 9 components themed from the canonical design tokens (`src/styles/mantine-theme.ts` derives everything from `MANTINE_THEME_ROLES` — no raw hex); Mantine styles load as `styles.layer.css` (`@layer mantine`) so the unlayered custom P5 CSS — the diegetic jagged clip-path/skew motifs — always wins the cascade. The opened-book detail is the lazy pure-DOM **flat** `@gfazioli/mantine-book` (`src/ui/PostBook.tsx`), split into its own chunk.
- `src/scene/` — procedural painterly room (canvas-generated textures, seeded geometry, one cheap painterly pass), `CameraRig`, and four `React.lazy` zones: Library (books), Desk (monitor), Game Cases, Projector.
- `src/lib/` — hash router, device tiering, climate math/API, a11y/focus helpers. `scripts/` — climate snapshot fetch, static HTML mirror, budget checks.
- **2D-first streaming:** the built HTML ships the full styled content mirror and critical CSS, so menu + all zone content paint instantly. Capable devices then opt into the lazily imported 3D chunk in a post-paint effect; the room fades in when ready. 3D never blocks content.

## Rendering modes and controls

- **Auto (default):** a device that passes every static capability gate starts in 3D. This includes **capable desktops and capable mobile/touch devices**; mobile uses a lighter tier (DPR cap 1.5, no post pass, portrait camera framings).
- **Automatic 2D** on constrained devices: no WebGL2, save-data, `prefers-reduced-motion`, or very low memory/core count. A device whose 3D scene has crashed is also pinned to 2D via a persisted failure signal, so "Auto" and reloads cannot re-trigger the crash (error boundary + `portfolio:3d-failed`).
- **Reduced-motion opt-in:** when reduced motion is the _only_ blocker, a `Static 3D` button lets visitors choose a static-cut 3D session (zone-title HUD, frozen grain clock, no camera flights). The informed choice is persisted (`portfolio:reduced-motion-3d`); **Auto clears it** alongside the manual mode override, so Auto always returns to the authoritative capability-derived mode (2D under reduced motion) and survives a reload.
- **Manual override:** the `Rendering mode` group in the main menu has a `3D room mode` button and an `Auto` button. A chosen mode is persisted (`portfolio:mode`); `Auto` clears the override and returns to the device's safe default. Only one 3D modal dialog can be open at a time.
- Keyboard: Tab/arrow keys navigate, Enter activates, Escape closes the top dialog, and a skip link targets `#main`. Canvas is `aria-hidden`; all content has DOM equivalents.

## Climate data

Toronto coordinates, 30-year Open-Meteo archive + current-weather comparison. Runtime `fetch → localStorage cache → bundled snapshot → stale cache → graceful "unavailable" plaque`. `prebuild` refreshes `public/climate-snapshot.json` best-effort and keeps the last-good file when the API returns nothing usable. Both the 2D heatmap and the projector texture reconcile the selected year against years that actually have data.

## Development and verification

Requires **Node 22** in CI (Node 21 works locally via the ESM alias in `vite.config.ts`).

```bash
npm install
npm run dev            # fast iteration (HMR) at http://localhost:5173/portfolio/#/; 3D works after the StrictMode-safe disposal fix
npm run dev:build      # build + `vite preview --host`: use this to test 3D if `npm run dev` shows the 2D fallback
npm run preview        # preview the existing build only (no rebuild)
npm run verify         # typecheck → lint → format:check → test → build → size
npm run format:check   # Prettier (also in the CI verify job)
npm run size           # shell ≤185 KB + lazy 3D chunk ≤260 KB + book chunk ≤16 KB (brotli)
```

To verify the **dev** rendering path (StrictMode double-invoke) rather than the
built preview, start `npm run dev` in one terminal and run
`npm run qa:dev-render` in another: it captures `dev_3d_render.png`, asserts the
canvas really drew lit geometry and that no disposed-resource errors were
logged, and checks the readiness-gated layout.

> **Shell budget note (Mantine-first commit, 2026-11-23; re-measured at the
> palette recolor):** the interactive shell budget was raised from 120 KB to
> **185 KB brotli** (measured 177.44 KB after adopting Mantine 9 as the primary
> UI library). This is an honest, owner-prioritized trade: the static HTML
> mirror + inline critical CSS still give an instant first paint with zero JS,
> and Mantine only hydrates the interactive shell afterwards. The lazy 3D scene
> chunk keeps its ≤260 KB cap (measured 217.5 KB), the flat-book detail is a
> separate ≤16 KB chunk (measured 7.74 KB), and the book package's
> rounded-variant WebGL chunks are emitted but **never fetched** by the flat
> integration (bucketed at ≤70 KB in `scripts/check-3d-budget.mjs` to keep the
> unbucketed-chunk guard on).

`npm run build` copies `public/404.html` (legacy Next.js path → hash-route redirector) and a no-JS static mirror into `dist/`. `dist/index.html` carries exactly one inlined `<style>` and no dev-only critical-mirror block; CI asserts both.

### Browser visual QA (`npm run capture:qa`)

The unit suite is headless (jsdom + `@react-three/test-renderer`): it verifies structure, state and a11y, **not pixels**. Pixel evidence is produced by the committed Playwright harness: install Chromium once (`npx playwright install chromium`), then run `npm run capture:qa` (build → `vite preview` → deterministic capture matrix). It writes 27 screenshots and 3 recordings to `qa-evidence/`; `qa-evidence/REPORT.md` documents conditions, the device matrix and known defects. SwiftShader software WebGL is used headlessly, so judge real smoothness from frame-time metrics, not the clips. Owner visual gates remain part of the ladder.

Manual browser hooks for inspection:

- Force 3D without relying on GPU detection: set `localStorage.setItem('portfolio:mode', '3d')` (and clear `portfolio:3d-failed`) before loading the page. Clear the key (or click `Auto`) to return to automatic mode.
- Routes (hash): `#/`, `#/about`, `#/experience`, `#/projects`, `#/climate`.
- Mode controls: `button[aria-label="3D room mode"]` and `button[aria-label="Automatic mode"]` inside the `Rendering mode` group.
- Dialogs: `role="dialog"` overlays for book/case details, the full-screen About desktop (`.desktop-zoom`), and the climate panel (`.climate-projector-overlay`).

## Deployment

GitHub Actions (`.github/workflows/deploy.yml`) builds on push to `main` and deploys via `actions/upload-pages-artifact` + `actions/deploy-pages` — no force-push, no `gh-pages` commits. **Before merging, switch the repository's Pages source to "GitHub Actions"** and retire the stale `gh-pages` branch after cutover; otherwise the old site keeps serving. `ci.yml` runs the same `verify` chain on PRs plus the built-HTML guards.
