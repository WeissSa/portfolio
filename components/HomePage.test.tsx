import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { HomePage } from './HomePage';
import React from 'react';
import { TagProvider } from '../contexts/TagContext';

// Mock the child components to simplify testing HomePage
jest.mock('./HomePage/Posts', () => ({
  Posts: ({ postsRef }: { postsRef: unknown }) => (
    <div ref={postsRef}>Mocked Posts Component</div>
  ),
}));
jest.mock('./HomePage/WelcomeSection', () => ({
  WelcomeSection: () => <div>Mocked Welcome Section</div>,
}));

// Mock the useScrollNavigation hook
jest.mock('../lib/useScrollNavigation', () => ({
  useScrollNavigation: () => ({
    handleWheel: jest.fn(),
    onTouchStart: jest.fn(),
    onTouchMove: jest.fn(),
  }),
}));

describe('HomePage', () => {
  it('renders the welcome section and experience section titles', () => {
    const mockPosts = [
      {
        id: 'test-post',
        title: 'Test Post',
        date: '2023-01-01',
        tags: ['test'],
        contentHtml: '<p>Test content</p>',
      },
    ];

    render(
      <MantineProvider>
        <TagProvider>
          <HomePage allPostsData={mockPosts} />
        </TagProvider>
      </MantineProvider>,
    );

    expect(screen.getByText('Mocked Welcome Section')).toBeInTheDocument();
    expect(screen.getByText('Experience & Projects')).toBeInTheDocument();
    expect(screen.getByText('Mocked Posts Component')).toBeInTheDocument();
  });
});
