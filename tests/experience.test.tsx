import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import App from '../src/App';
import { POSTS, PROJECTS } from '../src/content/posts';

function renderExperience() {
  window.location.hash = '#/experience';
  render(<App />);
}

describe('Experience library (2D)', () => {
  it('renders all 13 posts as headings', () => {
    renderExperience();
    for (const post of POSTS) {
      const escaped = post.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      expect(
        screen.getByRole('heading', {
          level: 3,
          // anchored: 'Gusto - Software Engineer' is a prefix of the
          // 'Gusto - Software Engineering Intern' title
          name: new RegExp(`${escaped}$`),
        }),
      ).toBeInTheDocument();
    }
  });

  it('stars featured posts and exposes the star to screen readers', () => {
    renderExperience();
    const gusto = screen.getByRole('heading', {
      level: 3,
      name: /Featured Gusto - Software Engineer$/,
    });
    expect(gusto).toHaveTextContent('★');
    const savi = screen.getByRole('heading', {
      level: 3,
      name: /Savi Finance - Industry Partnership/,
    });
    expect(savi).not.toHaveTextContent('Featured');
  });

  it('expands a private post to the verbatim description + NDA note', async () => {
    const user = userEvent.setup();
    renderExperience();
    const details = screen.getAllByRole('button', { name: 'Details' });
    await user.click(details[0]!); // Gusto - Software Engineer (first)
    const description = await screen.findByTestId('post-description');
    expect(description).toContainElement(
      screen.getByText(
        /After graduating I happily took a return offer to Gusto/,
      ),
    );
    expect(
      screen.getByText('Repository is private — details under NDA.'),
    ).toBeInTheDocument();
    expect(details[0]).toHaveAttribute('aria-expanded', 'true');
  });

  it('links public repositories with an accessible name', () => {
    renderExperience();
    const link = screen.getByRole('link', {
      name: 'Open repository for DreamZzz - Game Development Project (opens in a new tab)',
    });
    expect(link).toHaveAttribute('href', 'https://github.com/WeissSa/DreamZzz');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });
});

describe('Projects game cases (2D)', () => {
  it('shows exactly the five project cases', () => {
    window.location.hash = '#/projects';
    render(<App />);
    expect(PROJECTS).toHaveLength(5);
    for (const project of PROJECTS) {
      const escaped = project.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      expect(
        screen.getByRole('heading', {
          level: 3,
          name: new RegExp(`${escaped}$`),
        }),
      ).toBeInTheDocument();
    }
    // Library-only entries must not appear here.
    expect(
      screen.queryByRole('heading', { level: 3, name: /Savi Finance/ }),
    ).not.toBeInTheDocument();
  });

  it('offers an Open case toggle per project', () => {
    window.location.hash = '#/projects';
    render(<App />);
    expect(screen.getAllByRole('button', { name: 'Open case' })).toHaveLength(
      5,
    );
  });
});
