import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { Posts } from './Posts';
import React from 'react';

// Mock PostCard component
jest.mock('./PostCard', () => ({
  PostCard: ({ post }: { post: { title: string } }) => (
    <div data-testid="postcard">{post.title}</div>
  ),
}));

describe('Posts', () => {
  it('renders the correct number of PostCard components', () => {
    const mockPosts = [
      {
        title: 'Post 1',
        description: 'Desc 1',
        repo: 'Repo 1',
        tags: ['tag1'],
        image: 'image1.jpg',
      },
      {
        title: 'Post 2',
        description: 'Desc 2',
        repo: 'Repo 2',
        tags: ['tag2'],
        image: 'image2.jpg',
      },
    ];
    const postsRef = React.createRef<HTMLDivElement>();

    render(
      <MantineProvider>
        <Posts posts={mockPosts} postsRef={postsRef} />
      </MantineProvider>,
    );

    const postCards = screen.getAllByTestId('postcard');
    expect(postCards).toHaveLength(mockPosts.length);
    expect(screen.getByText('Post 1')).toBeInTheDocument();
    expect(screen.getByText('Post 2')).toBeInTheDocument();
  });

  it('renders 0 postcards', () => {
    const mockPosts = [] as {
      title: string;
      description: string;
      repo: string;
      tags: string[];
      image: string;
    }[];
    const postsRef = React.createRef<HTMLDivElement>();

    render(
      <MantineProvider>
        <Posts posts={mockPosts} postsRef={postsRef} />
      </MantineProvider>,
    );

    const postCards = screen.queryAllByTestId('postcard');
    expect(postCards).toHaveLength(mockPosts.length);
  });

  it('assigns the postsRef correctly', () => {
    const mockPosts = [];
    const postsRef = React.createRef<HTMLDivElement>();

    render(
      <MantineProvider>
        <Posts posts={mockPosts} postsRef={postsRef} />
      </MantineProvider>,
    );

    expect(postsRef.current).toBeInTheDocument();
  });
});
