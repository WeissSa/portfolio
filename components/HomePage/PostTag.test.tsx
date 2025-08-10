import { render, screen } from '@testing-library/react';
import { PostTag } from './PostTag';
import React from 'react';

import { MantineProvider } from '@mantine/core';

describe('PostTag', () => {
  it('renders the tag text correctly', () => {
    const testTag = 'TestTag';

    render(
      <MantineProvider>
        <PostTag tag={testTag} />
      </MantineProvider>
    );
    const tagElement = screen.getByText(testTag);
    expect(tagElement).toBeInTheDocument();
  });
});
