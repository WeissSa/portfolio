/**
 * Book detail content component (@gfazioli/mantine-book FLAT variant).
 *
 * The UX fix pass made the READABLE detail panel the shared `PostCard`-backed
 * `DetailMirror` (full text visible + scrollable immediately). This pure-DOM
 * turnable book remains an independent content component with its own keyboard
 * and reduced-motion contract; those behaviours are asserted here directly,
 * while dialog focus/inert/ARIA is asserted by diegetic-detail + axe tests.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from './helpers';
import PostBook from '../src/ui/PostBook';
import { POSTS } from '../src/content/posts';

const first = POSTS[0]!;

/** Mount the book content directly; it is dialog-agnostic. */
async function openBook() {
  renderWithProviders(<PostBook post={first} />);
  const book = await screen.findByTestId('post-book');
  return { book };
}

function bookRoot(book: HTMLElement): HTMLElement {
  return book.querySelector('[aria-roledescription="book"]') as HTMLElement;
}

describe('opened book — flat variant', () => {
  it('renders a pure-DOM FLAT book (no WebGL variant)', async () => {
    const { book } = await openBook();
    const root = bookRoot(book);
    expect(root).toBeInTheDocument();
    expect(root).toHaveAttribute('data-flat', 'true');
    expect(book.querySelector('canvas')).toBeNull();
  });

  it('pages carry the verbatim post content (description, tags, repo/NDA)', async () => {
    const { book } = await openBook();
    await waitFor(() =>
      expect(within(book).getByTestId('post-description')).toBeInTheDocument(),
    );
    expect(book).toHaveTextContent(
      /After graduating I happily took a return offer to Gusto/,
    );
    expect(book).toHaveTextContent(
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
