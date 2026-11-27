/**
 * ONE browser contract for the single detail panel. Playwright specs used to
 * disagree on the minimum reading size (14px in QA vs 15px in css), which let
 * small text ship. Both checks now come from this helper and the value matches
 * `.detail-mirror__body` in src/styles/p5.css.
 */
import { expect, type Locator, type Page } from '@playwright/test';

/** Must match `.detail-mirror__body { font-size: 15px }`. */
export const DETAIL_BODY_FONT_PX = 15;

/** Internal vocabulary that must never reach a visitor's screen. */
export const UI_JARGON = [
  'in-world readout',
  'open projector info panel',
  'projector feed',
  'back to the room',
  'room menu',
  'keyboard menu',
  'case file',
  'open case',
  'about desktop',
  'static 3d',
  '3d room mode',
  'automatic mode',
  'rendering mode',
] as const;

export async function assertPanelContract(
  page: Page,
  panel: Locator,
  viewport: { width: number; height: number },
): Promise<void> {
  await expect(panel).toHaveCount(1);
  await expect(panel).toBeVisible();
  await expect(panel).toHaveAttribute('role', 'dialog');
  await expect(panel).toHaveAttribute('aria-modal', 'true');

  // Alignment: fully inside the viewport, centred, not clipped.
  const box = await panel.boundingBox();
  expect(box, 'panel has a visible bounding box').not.toBeNull();
  const rect = box!;
  expect(rect.width, 'panel is readable').toBeGreaterThan(300);
  expect(rect.x, 'panel is not clipped on the left').toBeGreaterThanOrEqual(0);
  expect(rect.y, 'panel is not clipped at the top').toBeGreaterThanOrEqual(0);
  expect(
    rect.x + rect.width,
    'panel is not clipped on the right',
  ).toBeLessThanOrEqual(viewport.width + 1);
  expect(
    rect.y + rect.height,
    'panel is not clipped at the bottom',
  ).toBeLessThanOrEqual(viewport.height + 1);

  // The pointer menu stays reachable during a detail, but must not cover it.
  const strip = page.locator('.pointer-menu-strip');
  if (await strip.isVisible()) {
    const menu = await strip.boundingBox();
    if (menu) {
      const overlaps =
        rect.x < menu.x + menu.width &&
        menu.x < rect.x + rect.width &&
        rect.y < menu.y + menu.height &&
        menu.y < rect.y + rect.height;
      expect(overlaps, 'panel does not overlap the pointer menu').toBe(false);
    }
  }

  const body = panel.locator('.detail-mirror__body');
  const metrics = await body.evaluate((el) => ({
    overflowY: getComputedStyle(el).overflowY,
    fontPx: parseFloat(getComputedStyle(el).fontSize),
    scrollHeight: el.scrollHeight,
    clientHeight: el.clientHeight,
    wrap: getComputedStyle(el).overflowWrap,
  }));
  expect(metrics.overflowY, 'body is the one scroll container').toBe('auto');
  expect(metrics.fontPx, 'AA reading size').toBeGreaterThanOrEqual(
    DETAIL_BODY_FONT_PX,
  );
  expect(metrics.wrap, 'long tags wrap instead of clipping').toBe('anywhere');

  // Focus starts in the scroll body, so wheel/keyboard work on open — no Tab.
  const focusInBody = await page.evaluate(() => {
    const active = document.activeElement;
    return Boolean(active?.classList.contains('detail-mirror__body'));
  });
  expect(focusInBody, 'scroll body is focused on open').toBe(true);

  if (metrics.scrollHeight > metrics.clientHeight + 1) {
    await body.hover();
    const before = await body.evaluate((el) => el.scrollTop);
    await page.mouse.wheel(0, 600);
    await expect
      .poll(() => body.evaluate((el) => el.scrollTop))
      .toBeGreaterThan(before);
    await body.evaluate((el) => el.scrollTo(0, 0));
  }

  // ONE surface per content: no duplicate heading from the zone behind it.
  const duplicates = await page.evaluate(() => {
    const titles = Array.from(
      document.querySelectorAll('#main h2, .detail-mirror h2'),
    )
      .map((node) => node.textContent?.trim() ?? '')
      .filter(Boolean);
    return titles.filter((title, index) => titles.indexOf(title) !== index);
  });
  expect(duplicates, 'no duplicated heading in detail + zone').toEqual([]);

  const visibleText = (await page.locator('body').innerText()).toLowerCase();
  for (const term of UI_JARGON) {
    expect(visibleText.includes(term), `no jargon: "${term}"`).toBe(false);
  }
}
