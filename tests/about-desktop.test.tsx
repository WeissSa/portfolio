import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import App from '../src/App';
import { usePortfolioStore } from '../src/state/store';

function renderAbout() {
  usePortfolioStore.getState().closeAllWindows();
  window.location.hash = '#/about';
  render(<App />);
}

describe('About desktop-OS (2D)', () => {
  it('renders the five desktop icons', () => {
    renderAbout();
    for (const label of ['Bio', 'Now', 'Hobbies', 'Skills', 'Links']) {
      expect(
        screen.getByRole('button', { name: new RegExp(label) }),
      ).toBeInTheDocument();
    }
  });

  it('opens a focus-managed Bio window with the verbatim bio', async () => {
    const user = userEvent.setup();
    renderAbout();
    const bioIcon = screen.getByRole('button', { name: /Bio/ });
    await user.click(bioIcon);

    const dialog = await screen.findByRole('dialog', {
      name: 'Bio window',
    });
    expect(dialog).toContainHTML('Welcome to my Website!');
    expect(dialog).toHaveTextContent(
      'I am also learning Japanese in my free time.',
    );
    await waitFor(() =>
      expect(dialog).toContainElement(
        document.activeElement as HTMLElement | null,
      ),
    );
    expect(bioIcon).toHaveAttribute('aria-expanded', 'true');
  });

  it('closes the top window with Escape and restores focus to its icon', async () => {
    const user = userEvent.setup();
    renderAbout();
    const bioIcon = screen.getByRole('button', { name: /Bio/ });
    await user.click(bioIcon);
    await screen.findByRole('dialog', { name: 'Bio window' });

    await user.keyboard('{Escape}');
    expect(
      screen.queryByRole('dialog', { name: 'Bio window' }),
    ).not.toBeInTheDocument();
    expect(bioIcon).toHaveFocus();
    expect(bioIcon).toHaveAttribute('aria-expanded', 'false');
  });

  it('closes only the top-most window when several are open', async () => {
    const user = userEvent.setup();
    renderAbout();
    await user.click(screen.getByRole('button', { name: /Bio/ }));
    await screen.findByRole('dialog', { name: 'Bio window' });
    await user.click(screen.getByRole('button', { name: /Now/ }));
    await screen.findByRole('dialog', { name: 'Now window' });

    await user.keyboard('{Escape}');
    expect(
      screen.queryByRole('dialog', { name: 'Now window' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('dialog', { name: 'Bio window' }),
    ).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes a window via its close button', async () => {
    const user = userEvent.setup();
    renderAbout();
    await user.click(screen.getByRole('button', { name: /Hobbies/ }));
    const dialog = await screen.findByRole('dialog', {
      name: 'Hobbies window',
    });
    await user.click(
      within(dialog).getByRole('button', { name: 'Close Hobbies window' }),
    );
    expect(dialog).not.toBeInTheDocument();
  });

  it('derives the Skills window from post tags', async () => {
    const user = userEvent.setup();
    renderAbout();
    await user.click(screen.getByRole('button', { name: /Skills/ }));
    const dialog = await screen.findByRole('dialog', {
      name: 'Skills window',
    });
    expect(dialog).toHaveTextContent('React');
    expect(dialog).toHaveTextContent('Ruby/Rails');
    const skillList = within(dialog).getByRole('list', {
      name: 'Skills derived from project tags',
    });
    expect(skillList).not.toHaveTextContent('★');
  });

  it('links GitHub and LinkedIn from the Links window', async () => {
    const user = userEvent.setup();
    renderAbout();
    await user.click(screen.getByRole('button', { name: /Links/ }));
    const dialog = await screen.findByRole('dialog', {
      name: 'Links window',
    });
    expect(
      within(dialog).getByRole('link', { name: /GitHub/ }),
    ).toHaveAttribute('href', 'https://github.com/WeissSa');
    expect(
      within(dialog).getByRole('link', { name: /LinkedIn/ }),
    ).toHaveAttribute('href', 'https://linkedin.com/in/samuelbsweiss');
  });
});
