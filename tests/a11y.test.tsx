import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useFocusTrap } from '../src/lib/a11y';

function TrapHarness({
  active,
  restoreFocus,
}: {
  active: boolean;
  restoreFocus: boolean;
}) {
  const ref = useFocusTrap<HTMLDivElement>(active, restoreFocus);
  return (
    <>
      <button type="button" data-testid="outside">
        Outside
      </button>
      <div ref={ref} data-testid="trap" tabIndex={-1}>
        <button type="button" data-testid="first">
          First
        </button>
        <button type="button" data-testid="last">
          Last
        </button>
      </div>
    </>
  );
}

describe('useFocusTrap', () => {
  it('does not tear down and steal focus when restoreFocus flips mid-trap', async () => {
    const { rerender } = render(<TrapHarness active={false} restoreFocus />);
    const outside = screen.getByTestId('outside');
    outside.focus();

    rerender(<TrapHarness active restoreFocus />);
    const first = screen.getByTestId('first');
    await waitFor(() => expect(first).toHaveFocus());

    // A caller flip of `isOnlyWindow` changes restoreFocus while the trap is
    // still active. The effect must not re-run (and restore to `outside`).
    const last = screen.getByTestId('last');
    last.focus();
    rerender(<TrapHarness active restoreFocus={false} />);

    expect(last).toHaveFocus();
    expect(outside).not.toHaveFocus();
  });

  it('wraps Shift+Tab from the container itself to the last focusable', async () => {
    render(<TrapHarness active restoreFocus={false} />);
    const trap = screen.getByTestId('trap');
    await waitFor(() => expect(screen.getByTestId('first')).toHaveFocus());

    // A click on the dialog's padding can leave focus on the container, which
    // is inside the trap but neither its first nor last focusable child.
    trap.focus();
    const event = new KeyboardEvent('keydown', {
      key: 'Tab',
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });
    trap.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(screen.getByTestId('last')).toHaveFocus();
  });
});
