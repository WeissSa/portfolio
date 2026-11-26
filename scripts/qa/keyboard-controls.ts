import type { Locator, Page } from '@playwright/test';

/**
 * Activate a real semantic control through its keyboard path (focus + Enter).
 * The DOM nav is now pointer-visible in live 3D, but the perf/capture harnesses
 * still drive nav and mode-toggle links through the keyboard route a screen
 * reader user takes — the element's own handler runs identically, and this
 * keeps those harnesses independent of pointer placement under SwiftShader.
 */
export async function activateControl(
  page: Page,
  control: Locator,
): Promise<void> {
  await control.focus();
  await page.keyboard.press('Enter');
}
