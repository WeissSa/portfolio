import userEvent from '@testing-library/user-event';
import { render, screen } from '@testing-library/react';
import { PostCard } from './PostCard';
import { MantineProvider } from '@mantine/core';

describe('PostCard', () => {
  const mockPost = {
    title: 'Test Post Title',
    description: 'This is a test post description.',
    repo: 'https://github.com/test/test-repo',
    tags: ['test', 'react'],
    image: 'test-image.png',
  };

  it('renders the post card with correct content', async () => {
    render(
      <MantineProvider>
        <PostCard post={mockPost} />
      </MantineProvider>,
    );

    expect(screen.getByText(/test post title/i)).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', { name: /test post title/i }),
    );
    expect(screen.getByTestId('post-description')).toHaveTextContent(
      /this is a test post description./i,
    );
    expect(
      screen.getByAltText(/screenshot or picture of test post title/i),
    ).toBeInTheDocument();
    expect(screen.getByText('test', { selector: '.tag' })).toBeInTheDocument();
    expect(screen.getByText(/react/i)).toBeInTheDocument();
  });

  it('renders a link to the post detail page', () => {
    render(
      <MantineProvider>
        <PostCard post={mockPost} />
      </MantineProvider>,
    );

    const githubLink = screen.getByRole('link', { name: /github logo/i });
    expect(githubLink).toBeInTheDocument();
    expect(githubLink).toHaveAttribute(
      'href',
      'https://github.com/test/test-repo',
    );
  });

  it('expands and collapses the card to show/hide full content', async () => {
    render(
      <MantineProvider>
        <PostCard post={mockPost} />
      </MantineProvider>,
    );

    // Initially, the full description and image should not be visible
    expect(screen.queryByTestId('post-description')).not.toBeInTheDocument();
    expect(
      screen.queryByAltText(/screenshot or picture of test post title/i),
    ).not.toBeInTheDocument();

    // Click to expand
    await userEvent.click(
      screen.getByRole('button', { name: /test post title/i }),
    );

    // After clicking, the full description and image should be visible
    expect(screen.getByTestId('post-description')).toBeInTheDocument();
    expect(
      screen.getByAltText(/screenshot or picture of test post title/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /test post title/i }),
    ).toHaveAttribute('aria-expanded', 'true');

    // Click again to collapse
    await userEvent.click(
      screen.getByRole('button', { name: /test post title/i }),
    );

    // After clicking again, the full description and image should not be visible
    expect(screen.queryByTestId('post-description')).not.toBeInTheDocument();
    expect(
      screen.queryByAltText(/screenshot or picture of test post title/i),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /test post title/i }),
    ).toHaveAttribute('aria-expanded', 'false');
  });

  it('does not expand when the GitHub button is clicked', async () => {
    render(
      <MantineProvider>
        <PostCard post={mockPost} />
      </MantineProvider>,
    );

    // Initially, the card should not be expanded
    expect(
      screen.getByRole('button', { name: /test post title/i }),
    ).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByTestId('post-description')).not.toBeInTheDocument();

    // Click the GitHub link
    await userEvent.click(screen.getByRole('link', { name: /github logo/i }));

    // The card should still not be expanded
    expect(
      screen.getByRole('button', { name: /test post title/i }),
    ).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByTestId('post-description')).not.toBeInTheDocument();
  });
});
