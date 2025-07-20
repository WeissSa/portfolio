import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { Posts } from './Posts';
import React from 'react';
import { TagProvider, useTags } from '../contexts/TagContext';

// Mock PostCard component
jest.mock('./PostCard', () => ({
  PostCard: ({ post }: { post: { title: string } }) => (
    <div data-testid="postcard">{post.title}</div>
  ),
}));

// Mock TagFilter component
jest.mock('./TagFilter', () => ({
  TagFilter: ({ posts }: { posts: { title: string; description: string; repo: string; tags: string[]; image: string; }[] }) => (
    <div data-testid="tag-filter">TagFilter for {posts.length} posts</div>
  ),
}));

const mockPosts = [
  {
    title: 'Post 1',
    description: 'Desc 1',
    repo: 'Repo 1',
    tags: ['tag1', 'react'],
    image: 'image1.jpg',
  },
  {
    title: 'Post 2',
    description: 'Desc 2',
    repo: 'Repo 2',
    tags: ['tag2', 'nextjs'],
    image: 'image2.jpg',
  },
  {
    title: 'Post 3',
    description: 'Desc 3',
    repo: 'Repo 3',
    tags: ['tag1', 'typescript'],
    image: 'image3.jpg',
  },
];

describe('Posts', () => {
  it('renders the correct number of PostCard components', () => {
    const postsRef = React.createRef<HTMLDivElement>();

    render(
      <MantineProvider>
        <TagProvider>
          <Posts posts={mockPosts} postsRef={postsRef} />
        </TagProvider>
      </MantineProvider>,
    );

    const postCards = screen.getAllByTestId('postcard');
    expect(postCards).toHaveLength(mockPosts.length);
    expect(screen.getByText('Post 1')).toBeInTheDocument();
    expect(screen.getByText('Post 2')).toBeInTheDocument();
    expect(screen.getByText('Post 3')).toBeInTheDocument();
  });

  it('renders 0 postcards when no posts are provided', () => {
    const postsRef = React.createRef<HTMLDivElement>();

    render(
      <MantineProvider>
        <TagProvider>
          <Posts posts={[]} postsRef={postsRef} />
        </TagProvider>
      </MantineProvider>,
    );

    const postCards = screen.queryAllByTestId('postcard');
    expect(postCards).toHaveLength(0);
  });

  it('assigns the postsRef correctly', () => {
    const postsRef = React.createRef<HTMLDivElement>();

    render(
      <MantineProvider>
        <TagProvider>
          <Posts posts={[]} postsRef={postsRef} />
        </TagProvider>
      </MantineProvider>,
    );

    expect(postsRef.current).toBeInTheDocument();
  });

  it('renders the TagFilter component', () => {
    const postsRef = React.createRef<HTMLDivElement>();

    render(
      <MantineProvider>
        <TagProvider>
          <Posts posts={mockPosts} postsRef={postsRef} />
        </TagProvider>
      </MantineProvider>,
    );

    expect(screen.getByTestId('tag-filter')).toBeInTheDocument();
    expect(screen.getByTestId('tag-filter')).toHaveTextContent(
      `TagFilter for ${mockPosts.length} posts`,
    );
  });

  it('filters posts based on selected tags from TagContext', () => {
    const postsRef = React.createRef<HTMLDivElement>();

    const TestWrapper = () => {
      const { setSelectedTags } = useTags();
      React.useEffect(() => {
        setSelectedTags(['react']);
      }, []);
      return <Posts posts={mockPosts} postsRef={postsRef} />;
    };

    render(
      <MantineProvider>
        <TagProvider>
          <TestWrapper />
        </TagProvider>
      </MantineProvider>,
    );

    expect(screen.getByText('Post 1')).toBeInTheDocument(); // Has 'react'
    expect(screen.queryByText('Post 2')).not.toBeInTheDocument(); // Does not have 'react'
    expect(screen.queryByText('Post 3')).not.toBeInTheDocument(); // Does not have 'react'
  });
});
