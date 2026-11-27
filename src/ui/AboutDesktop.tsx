/**
 * About as a small desktop-OS metaphor (REWORK_PLAN §3.2.2): icons open
 * focus-managed windows; Esc closes the top window; focus is trapped in the
 * top window and restored to its icon on close. Business logic (window stack
 * ordering, focus restoration) lives in the store and in AboutWindow.
 */
import { useEffect } from 'react';
import { Button } from '@mantine/core';
import { BIO_PARAGRAPH } from '../content/bio';
import { UI_COPY } from '../content/ui-copy';
import { usePortfolioStore } from '../state/store';
import { DisplayTitle, P5Panel } from './primitives';
import { AboutWindow, focusAfterClose, type WindowSpec } from './AboutWindow';

const WINDOWS: readonly WindowSpec[] = [
  { id: 'bio', label: 'Bio', glyph: '👤' },
  { id: 'now', label: 'Now', glyph: '⏱' },
  { id: 'hobbies', label: 'Hobbies', glyph: '🥾' },
  { id: 'skills', label: 'Skills', glyph: '★' },
  { id: 'links', label: 'Links', glyph: '🔗' },
];

export function AboutDesktop({
  hideHeading = false,
}: {
  /** The single detail frame already shows the title — do not repeat it. */
  hideHeading?: boolean;
} = {}) {
  const openWindows = usePortfolioStore((s) => s.openWindows);
  const openWindow = usePortfolioStore((s) => s.openWindow);
  const closeTopWindow = usePortfolioStore((s) => s.closeTopWindow);
  const closeAllWindows = usePortfolioStore((s) => s.closeAllWindows);

  useEffect(() => closeAllWindows, [closeAllWindows]);

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      const top = closeTopWindow();
      if (top) {
        event.preventDefault();
        focusAfterClose(top);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [closeTopWindow]);

  return (
    <section
      {...(hideHeading
        ? { 'aria-label': UI_COPY.aboutTitle }
        : { 'aria-labelledby': 'about-heading' })}
      className="p5-cut-in relative min-h-[70vh]"
    >
      {!hideHeading && (
        <DisplayTitle level={2} className="mb-4 text-p5-red">
          <span id="about-heading">{UI_COPY.aboutTitle}</span>
        </DisplayTitle>
      )}
      <P5Panel className="relative min-h-[60vh] overflow-hidden">
        <div
          className="p5-halftone pointer-events-none absolute inset-0 text-p5-red"
          aria-hidden="true"
        />
        <ul
          aria-label={UI_COPY.aboutIconsLabel}
          className="relative grid grid-cols-3 gap-4 p-4 sm:grid-cols-5"
        >
          {WINDOWS.map((spec) => (
            <li key={spec.id}>
              <Button
                id={`about-icon-${spec.id}`}
                type="button"
                onClick={() => openWindow(spec.id)}
                aria-expanded={openWindows.includes(spec.id)}
                radius={0}
                className="p5-btn min-h-[72px] w-full text-xs"
                classNames={{
                  label: 'flex flex-col items-center gap-1',
                }}
              >
                <span aria-hidden="true" className="text-2xl">
                  {spec.glyph}
                </span>
                <span>{spec.label}</span>
              </Button>
            </li>
          ))}
        </ul>
        {openWindows.map((id, index) => {
          const spec = WINDOWS.find((w) => w.id === id);
          if (!spec) return null;
          return (
            <AboutWindow
              key={id}
              spec={spec}
              index={index}
              isTop={index === openWindows.length - 1}
              isOnlyWindow={openWindows.length === 1}
            />
          );
        })}
      </P5Panel>
    </section>
  );
}
