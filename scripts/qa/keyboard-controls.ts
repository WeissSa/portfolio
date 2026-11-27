import type { Locator, Page } from '@playwright/test';

/**
 * Activate a real semantic control through its keyboard path (focus + Enter).
 * The semantic <nav> stays sr-only in live 3D (the a11y/keyboard path); the
 * separate PointerMenuStrip is the clickable affordance for mouse users. The
 * harnesses therefore activate nav and mode-toggle links through the keyboard
 * route a screen reader user takes — the element's own handler runs
 * identically, and this keeps them independent of pointer placement under
 * SwiftShader.
 */
export async function activateControl(
  page: Page,
  control: Locator,
): Promise<void> {
  await control.focus();
  await page.keyboard.press('Enter');
}
