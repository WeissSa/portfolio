import userEvent from '@testing-library/user-event';
import { render, screen, waitFor, waitForElementToBeRemoved } from '@testing-library/react';
import { PostCard } from './PostCard';
import { MantineProvider } from '@mantine/core';

// Mock PostTag component
jest.mock('./PostTag', () => ({
  PostTag: ({ tag }: { tag: string }) => <span className="tag">{tag}</span>,
}));

global.open = jest.fn();

describe('PostCard', () => {
  const mockPost = {
    title: 'Test Post Title',
    description: 'This is a test post description.',
    repo: 'https://github.com/test/test-repo',
    tags: ['test', 'react', 'typescript', 'nextjs', 'mantine'],
    image: 'test-image.png',
  };

  const renderPostCard = (post = mockPost) => {
    render(
      <MantineProvider>
        <PostCard post={post} />
      </MantineProvider>,
    );
  };

  it('renders the title', () => {
    renderPostCard();
    expect(screen.getByText(/Test Post Title/i)).toBeInTheDocument();
  });

  it('only 3 tags render when closed', () => {
    renderPostCard();
    expect(screen.getByText('test')).toBeInTheDocument();
    expect(screen.getByText('react')).toBeInTheDocument();
    expect(screen.getByText('typescript')).toBeInTheDocument();
    expect(screen.queryByText('nextjs')).not.toBeInTheDocument();
    expect(screen.queryByText('mantine')).not.toBeInTheDocument();
  });

  it('all tags render when open', async () => {
    renderPostCard();
    await userEvent.click(
      screen.getByRole('button', { name: /Test Post Title/i }),
    );
    expect(screen.getByText('test')).toBeInTheDocument();
    expect(screen.getByText('react')).toBeInTheDocument();
    expect(screen.getByText('typescript')).toBeInTheDocument();
    expect(screen.getByText('nextjs')).toBeInTheDocument();
    expect(screen.getByText('mantine')).toBeInTheDocument();
  });

  it('picture renders when open', async () => {
    renderPostCard();
    expect(
      screen.queryByAltText(/screenshot or picture of Test Post Title/i),
    ).not.toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', { name: /Test Post Title/i }),
    );
    expect(
      screen.getByAltText(/screenshot or picture of Test Post Title/i),
    ).toBeInTheDocument();
  });

  

  it('links do not close the card', async () => {
    renderPostCard();
    await userEvent.click(
      screen.getByRole('button', { name: /Test Post Title/i }),
    ); // Open
    expect(screen.getByTestId('post-description')).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('link', { name: /Open GitHub repository/i }),
    );
    expect(screen.getByTestId('post-description')).toBeInTheDocument(); // Should still be open
  });

  it('the github link does not open the card', async () => {
    renderPostCard();
    expect(screen.queryByTestId('post-description')).not.toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('link', { name: /Open GitHub repository/i }),
    );
    expect(screen.queryByTestId('post-description')).not.toBeInTheDocument();
  });
});
