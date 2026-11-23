/**
 * Opened-book detail (owner decision 2026-11-22): the Library/Experience book
 * detail renders its inside as the @gfazioli/mantine-book FLAT variant —
 * pure DOM, lazy-loaded into its own chunk, keyboard-operable, reduced-motion
 * aware — inside the existing dialog focus/inert model.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from './helpers';
import { PostDetailOverlay } from '../src/ui/PostDetailOverlay';
import { POSTS, postId } from '../src/content/posts';
import { usePortfolioStore } from '../src/state/store';

const first = POSTS[0]!;

/** Mount the overlay with a real focus opener, like the 3D pick flow. */
async function openBook() {
  const opener = document.createElement('button');
  document.body.appendChild(opener);
  opener.focus();
  usePortfolioStore.setState({ selectedPostId: postId(first) });
  renderWithProviders(<PostDetailOverlay />);
  const dialog = await screen.findByRole('dialog', {
    name: new RegExp(first.title),
  });
  // The lazy book chunk resolves; the Suspense fallback (PostCard) is replaced.
  const book = await screen.findByTestId('post-book');
  return { opener, dialog, book };
}

function bookRoot(book: HTMLElement): HTMLElement {
  return book.querySelector('[aria-roledescription="book"]') as HTMLElement;
}

beforeEach(() => {
  usePortfolioStore.setState({ selectedPostId: null });
});

describe('opened book — flat variant, lazy chunk', () => {
  it('lazy-loads a pure-DOM FLAT book inside the dialog (no WebGL variant)', async () => {
    const { dialog, book } = await openBook();
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(within(dialog).getByTestId('post-book')).toBeInTheDocument();
    const root = bookRoot(book);
    expect(root).toBeInTheDocument();
    // Flat variant contract: the integration marks the book flat AND the
    // rounded renderer's canvas/WebGL layer is never mounted.
    expect(root).toHaveAttribute('data-flat', 'true');
    expect(book.querySelector('canvas')).toBeNull();
  });

  it('pages carry the verbatim post content (description, tags, repo/NDA)', async () => {
    const { dialog } = await openBook();
    // The description page keeps the trusted verbatim HTML hook.
    await waitFor(() =>
      expect(screen.getByTestId('post-description')).toBeInTheDocument(),
    );
    expect(dialog).toHaveTextContent(
      /After graduating I happily took a return offer to Gusto/,
    );
    expect(dialog).toHaveTextContent(
      'Repository is private — details under NDA.',
    );
  });

  it('is keyboard-operable: arrows turn pages with a polite announcement', async () => {
    const { book } = await openBook();
    const next = within(book).getByRole('button', { name: 'Next page' });
    const previous = within(book).getByRole('button', {
      name: 'Previous page',
    });
    expect(previous).toBeDisabled();
    expect(next).toBeEnabled();

    const announcement = () =>
      book.querySelector('[aria-live="polite"][aria-atomic="true"]')
        ?.textContent ?? '';
    expect(announcement()).toMatch(/^Page 1 of 4$/);

    // The book root is focusable and owns Arrow/Home/End natively.
    bookRoot(book).focus();
    await userEvent.keyboard('{ArrowRight}');
    await waitFor(() => expect(previous).toBeEnabled());
    await waitFor(() => expect(announcement()).toMatch(/^Pages 2–3 of 4$/));

    await userEvent.keyboard('{ArrowLeft}');
    await waitFor(() => expect(previous).toBeDisabled());
  });

  it('prev/next buttons keep ≥44px-class targets and turn the book', async () => {
    const { book } = await openBook();
    const next = within(book).getByRole('button', { name: 'Next page' });
    expect(next.className).toContain('min-h-[44px]');
    await userEvent.click(next);
    await waitFor(() =>
      expect(
        within(book).getByRole('button', { name: 'Previous page' }),
      ).toBeEnabled(),
    );
  });

  it('clamps at both ends: End opens the back cover, Home closes the book', async () => {
    const { book } = await openBook();
    const next = within(book).getByRole('button', { name: 'Next page' });
    const previous = within(book).getByRole('button', {
      name: 'Previous page',
    });
    bookRoot(book).focus();
    await userEvent.keyboard('{End}');
    // The multi-page riffle animates through intermediate faces (each one
    // reports onPageChange), so allow the full riffle budget to land.
    await waitFor(() => expect(next).toBeDisabled(), { timeout: 4000 });
    await userEvent.keyboard('{Home}');
    await waitFor(() => expect(previous).toBeDisabled(), { timeout: 4000 });
  });

  it('stays usable with prefers-reduced-motion (instant turns, same content)', async () => {
    const spy = vi.spyOn(window, 'matchMedia').mockImplementation(((
      query: string,
    ) => ({
      matches: query.includes('prefers-reduced-motion'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as unknown as typeof window.matchMedia);
    try {
      const { book } = await openBook();
      expect(bookRoot(book)).toHaveAttribute('data-flat', 'true');
      bookRoot(book).focus();
      await userEvent.keyboard('{ArrowRight}');
      await waitFor(() =>
        expect(
          within(book).getByRole('button', { name: 'Previous page' }),
        ).toBeEnabled(),
      );
    } finally {
      spy.mockRestore();
    }
  });
});

describe('opened book — dialog a11y model preserved', () => {
  it('keeps ONE focus trap: focus lives in the dialog and returns to the opener on Esc', async () => {
    const { opener, dialog } = await openBook();
    await waitFor(() =>
      expect(dialog).toContainElement(
        document.activeElement as HTMLElement | null,
      ),
    );

    await userEvent.keyboard('{Escape}');
    expect(usePortfolioStore.getState().selectedPostId).toBeNull();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => expect(opener).toHaveFocus());
    opener.remove();
  });

  it('marks the background shell inert while the book dialog is open', async () => {
    // The overlay inerts .app-shell; render a stand-in shell to observe it.
    const shell = document.createElement('div');
    shell.className = 'app-shell';
    document.body.appendChild(shell);
    const { opener } = await openBook();
    await waitFor(() => expect(shell).toHaveAttribute('inert'));
    expect(shell).toHaveAttribute('aria-hidden', 'true');

    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(shell).not.toHaveAttribute('inert'));
    opener.remove();
    shell.remove();
  });
});
