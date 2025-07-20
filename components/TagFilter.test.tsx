import { render, screen, fireEvent } from '@testing-library/react';
import { MantineProvider, useMantineTheme } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { TagFilter } from './TagFilter';
import { TagProvider, useTags } from '../contexts/TagContext';
import React from 'react';

// Mock useMediaQuery and useMantineTheme to control their return values
jest.mock('@mantine/hooks', () => ({
  ...jest.requireActual('@mantine/hooks'),
  useMediaQuery: jest.fn(),
  useIsomorphicEffect: jest.fn(),
}));
jest.mock('react', () => ({
  ...jest.requireActual('react'),
  useId: jest.fn(() => 'mock-id'), // Mock useId from react
}));
jest.mock('@mantine/core', () => ({
  ...jest.requireActual('@mantine/core'),
  useMantineTheme: jest.fn(() => ({
    breakpoints: {
      xs: '36em',
      sm: '48em',
      md: '62em',
      lg: '75em',
      xl: '88em',
    },
    fn: {
      smallerThan: jest.fn((breakpoint) => `(max-width: ${breakpoint})`),
    },
  })),
  Chip: jest.fn(({ children, checked, onChange, value, ...props }) => (
    <button
      role="checkbox"
      aria-checked={checked}
      onClick={onChange}
      data-value={value}
      {...props}
    >
      {children}
    </button>
  )),
}));

const mockPosts = [
  {
    title: 'Post 1',
    description: 'Desc 1',
    repo: 'Repo 1',
    tags: ['react', 'typescript'],
    image: 'image1.jpg',
  },
  {
    title: 'Post 2',
    description: 'Desc 2',
    repo: 'Repo 2',
    tags: ['nextjs', 'react'],
    image: 'image2.jpg',
  },
  {
    title: 'Post 3',
    description: 'Desc 3',
    repo: 'Repo 3',
    tags: ['typescript', '★'],
    image: 'image3.jpg',
  },
];

// Helper component to test TagContext
const TestComponent = () => {
  const { selectedTags, setSelectedTags } = useTags();
  return (
    <div>
      <div data-testid="selected-tags">{selectedTags.join(',')}</div>
      <button onClick={() => setSelectedTags(['test'])}>Set Tags</button>
    </div>
  );
};

describe('TagContext', () => {
  it('provides initial empty selectedTags and a setter', () => {
    render(
      <TagProvider>
        <TestComponent />
      </TagProvider>,
    );
    expect(screen.getByTestId('selected-tags')).toHaveTextContent('');
    fireEvent.click(screen.getByText('Set Tags'));
    expect(screen.getByTestId('selected-tags')).toHaveTextContent('test');
  });

  it('throws error when useTags is not used within TagProvider', () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<TestComponent />)).toThrow(
      'useTags must be used within a TagProvider',
    );
    consoleErrorSpy.mockRestore();
  });
});

describe('TagFilter', () => {
  beforeEach(() => {
    // Default to desktop view for most tests
    (useMediaQuery as jest.Mock).mockReturnValue(false);
  });

  it('does not render on mobile screens', () => {
    (useMediaQuery as jest.Mock).mockReturnValue(true);
    render(
      <MantineProvider>
        <TagProvider>
          <TagFilter posts={mockPosts} />
        </TagProvider>
      </MantineProvider>,
    );
    expect(screen.queryByText('Filter by Tag')).not.toBeInTheDocument();
  });

  it('renders tags based on post data and sorts them correctly', () => {
    render(
      <MantineProvider>
        <TagProvider>
          <TagFilter posts={mockPosts} />
        </TagProvider>
      </MantineProvider>,
    );

    expect(screen.getByText('Filter by Tag')).toBeInTheDocument();
    // Expect tags to be sorted: ★, react (2), typescript (2), nextjs (1)
    const chips = screen.getAllByRole('checkbox');
    expect(chips).toHaveLength(4);
    expect(chips[0]).toHaveTextContent('★');
    expect(chips[1]).toHaveTextContent('react');
    expect(chips[2]).toHaveTextContent('typescript');
    expect(chips[3]).toHaveTextContent('nextjs');
  });

  it('updates selected tags when a chip is clicked', () => {
    render(
      <MantineProvider>
        <TagProvider>
          <TagFilter posts={mockPosts} />
          <TestComponent /> {/* To observe selectedTags */}
        </TagProvider>
      </MantineProvider>,
    );

    const reactChip = screen.getByText('react');
    fireEvent.click(reactChip);
    expect(screen.getByTestId('selected-tags')).toHaveTextContent('react');
    expect(reactChip).toBeChecked();

    const typescriptChip = screen.getByText('typescript');
    fireEvent.click(typescriptChip);
    expect(screen.getByTestId('selected-tags')).toHaveTextContent('react,typescript');
    expect(typescriptChip).toBeChecked();

    // Deselect
    fireEvent.click(reactChip);
    expect(screen.getByTestId('selected-tags')).toHaveTextContent('typescript');
    expect(reactChip).not.toBeChecked();
  });
});
