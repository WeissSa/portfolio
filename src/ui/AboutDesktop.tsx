import { useEffect } from 'react';
import {
  BIO_PARAGRAPH,
  HOBBIES_EXCERPT,
  NOW_EXCERPTS,
  WELCOME_TITLE,
} from '../content/bio';
import { LINKS } from '../content/links';
import { SKILLS } from '../content/posts';
import { useFocusTrap } from '../lib/a11y';
import { usePortfolioStore, type AboutWindowId } from '../state/store';
import { DisplayTitle, P5Panel } from './primitives';

interface WindowSpec {
  id: AboutWindowId;
  label: string;
  glyph: string;
}

const WINDOWS: readonly WindowSpec[] = [
  { id: 'bio', label: 'Bio', glyph: '👤' },
  { id: 'now', label: 'Now', glyph: '⏱' },
  { id: 'hobbies', label: 'Hobbies', glyph: '🥾' },
  { id: 'skills', label: 'Skills', glyph: '★' },
  { id: 'links', label: 'Links', glyph: '🔗' },
];

/**
 * Focus the dialog that is still on top after a close; only go back to the
 * desktop icon when no dialog remains. Reads the store *after* the close so
 * the remaining stack is already up to date.
 */
function focusAfterClose(closedId: AboutWindowId): void {
  const remaining = usePortfolioStore.getState().openWindows;
  if (remaining.length > 0) {
    const top = remaining[remaining.length - 1]!;
    document.getElementById(`about-window-${top}`)?.focus();
  } else {
    document.getElementById(`about-icon-${closedId}`)?.focus();
  }
}

function WindowBody({ id }: { id: AboutWindowId }) {
  switch (id) {
    case 'bio':
      return (
        <>
          <h3 className="p5-display mb-2 text-lg">{WELCOME_TITLE}</h3>
          <p className="max-w-prose text-sm leading-relaxed">{BIO_PARAGRAPH}</p>
        </>
      );
    case 'now':
      return (
        <>
          <h3 className="p5-display mb-2 text-lg">Now</h3>
          {NOW_EXCERPTS.map((excerpt) => (
            <p key={excerpt} className="max-w-prose text-sm leading-relaxed">
              “{excerpt}”
            </p>
          ))}
        </>
      );
    case 'hobbies':
      return (
        <>
          <h3 className="p5-display mb-2 text-lg">Hobbies</h3>
          <p className="max-w-prose text-sm leading-relaxed">
            {HOBBIES_EXCERPT}
          </p>
        </>
      );
    case 'skills':
      return (
        <>
          <h3 className="p5-display mb-2 text-lg">Skills</h3>
          <ul
            aria-label="Skills derived from project tags"
            className="flex flex-wrap gap-1"
          >
            {SKILLS.map((skill) => (
              <li key={skill} className="p5-tag">
                {skill}
              </li>
            ))}
          </ul>
        </>
      );
    case 'links':
      return (
        <>
          <h3 className="p5-display mb-2 text-lg">Links</h3>
          <ul className="flex flex-col gap-2">
            <li>
              <a
                href={LINKS.github.url}
                target="_blank"
                rel="noopener noreferrer"
                className="p5-btn text-sm"
              >
                GitHub — WeissSa
              </a>
            </li>
            <li>
              <a
                href={LINKS.linkedin.url}
                target="_blank"
                rel="noopener noreferrer"
                className="p5-btn text-sm"
              >
                LinkedIn — samuelbsweiss
              </a>
            </li>
          </ul>
        </>
      );
  }
}

function DesktopWindow({
  spec,
  index,
  isTop,
  isOnlyWindow,
}: {
  spec: WindowSpec;
  index: number;
  isTop: boolean;
  isOnlyWindow: boolean;
}) {
  const closeWindow = usePortfolioStore((s) => s.closeWindow);
  // Only the last remaining window restores focus itself; when another dialog
  // stays open, focusAfterClose() moves focus to that dialog instead.
  const trapRef = useFocusTrap<HTMLDivElement>(isTop, isOnlyWindow);

  const close = () => {
    closeWindow(spec.id);
    focusAfterClose(spec.id);
  };

  return (
    <div
      ref={trapRef}
      id={`about-window-${spec.id}`}
      role="dialog"
      aria-label={`${spec.label} window`}
      tabIndex={-1}
      className="p5-panel p5-panel--slashed absolute z-10 w-[min(92%,34rem)] p5-cut-in"
      style={{ top: `${16 + index * 28}px`, left: `${16 + index * 28}px` }}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="p5-display text-base">
          {spec.glyph} {spec.label}
        </p>
        <button
          type="button"
          onClick={close}
          aria-label={`Close ${spec.label} window`}
          className="p5-btn p5-btn--red px-3 text-sm"
        >
          ✕
        </button>
      </div>
      <WindowBody id={spec.id} />
    </div>
  );
}

/**
 * About as a full-screen 2D desktop-OS interface (REWORK_PLAN §3.2.2):
 * icons open focus-managed windows; Esc closes the top window; focus is
 * trapped in the top window and restored to its icon on close.
 */
export function AboutDesktop() {
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
      aria-labelledby="about-heading"
      className="p5-cut-in relative min-h-[70vh]"
    >
      <DisplayTitle level={2} className="mb-4 text-p5-red">
        <span id="about-heading">About — Desktop</span>
      </DisplayTitle>
      <P5Panel className="relative min-h-[60vh] overflow-hidden">
        <div
          className="p5-halftone pointer-events-none absolute inset-0 text-p5-red"
          aria-hidden="true"
        />
        <ul
          aria-label="Desktop icons"
          className="relative grid grid-cols-3 gap-4 p-4 sm:grid-cols-5"
        >
          {WINDOWS.map((spec) => (
            <li key={spec.id}>
              <button
                id={`about-icon-${spec.id}`}
                type="button"
                onClick={() => openWindow(spec.id)}
                aria-expanded={openWindows.includes(spec.id)}
                className="p5-btn flex min-h-[72px] w-full flex-col items-center gap-1 text-xs"
              >
                <span aria-hidden="true" className="text-2xl">
                  {spec.glyph}
                </span>
                <span>{spec.label}</span>
              </button>
            </li>
          ))}
        </ul>
        {openWindows.map((id, index) => {
          const spec = WINDOWS.find((w) => w.id === id);
          if (!spec) return null;
          return (
            <DesktopWindow
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
