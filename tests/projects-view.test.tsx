/**
 * Projects shelf (owner fix 2026-11-26): ONE diegetic case file with a single
 * consistent scroll region. Expanding/collapsing a card must reflow in place
 * without introducing a second `overflow` container, and the formatting reads
 * as an in-world page (brass header, numbered files, tag chips).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { PROJECTS } from '../src/content/posts';
import { ProjectsView } from '../src/ui/ProjectsView';
import { renderWithProviders } from './helpers';

const CSS = readFileSync(resolve(__dirname, '../src/styles/p5.css'), 'utf8');

describe('diegetic projects shelf', () => {
  it('renders every case as a numbered file in ONE ordered list', () => {
    const { container } = renderWithProviders(<ProjectsView />);
    const list = container.querySelector('ol')!;
    expect(list.tagName).toBe('OL');
    expect(list.querySelectorAll(':scope > li')).toHaveLength(PROJECTS.length);
    expect(
      screen.getByRole('heading', { name: /Projects — Game Cases/i }),
    ).toBeInTheDocument();
    // Numbered case files are decorative; the accessible names come from cards.
    expect(document.querySelectorAll('.projects-shelf__index')).toHaveLength(
      PROJECTS.length,
    );
    expect(screen.getByText(/case files/i)).toBeInTheDocument();
  });

  it('expands and collapses a case in place with tag chips, no second scroller', async () => {
    const user = userEvent.setup();
    const { container } = renderWithProviders(<ProjectsView />);
    const card = container.querySelector('[data-project-id]')!;
    expect(card).toBeTruthy();

    // No nested scrolling region is created by the shelf itself.
    const nestedScrollers = [...container.querySelectorAll('*')].filter(
      (el) => el.scrollHeight > el.clientHeight + 1,
    );
    expect(nestedScrollers.length).toBeLessThanOrEqual(1);

    const toggle = within(card as HTMLElement).getByRole('button', {
      name: 'Open case',
    });
    await user.click(toggle);
    expect(
      within(card as HTMLElement).getByTestId('post-description'),
    ).toBeInTheDocument();
    expect(
      within(card as HTMLElement).getAllByRole('list', {
        name: /Tags for/i,
      }).length,
    ).toBeGreaterThan(0);
    expect(
      within(card as HTMLElement).queryByRole('button', { name: 'Open case' }),
    ).toBeNull();

    await user.click(
      within(card as HTMLElement).getByRole('button', { name: 'Close' }),
    );
    expect(
      within(card as HTMLElement).queryByTestId('post-description'),
    ).toBeNull();
  });

  it('keeps the shelf free of its own overflow container (one scroller only)', () => {
    const block = /\.projects-shelf\s*\{([^}]*)\}/.exec(CSS)?.[1] ?? '';
    expect(block).not.toMatch(/overflow/);
    expect(block).not.toMatch(/max-height/);
    // Expanded prose must be able to shrink inside a narrow 3D column.
    const item = /\.projects-shelf__item\s*\{([^}]*)\}/.exec(CSS)?.[1] ?? '';
    expect(item).toMatch(/min-width:\s*0/);
  });
});
