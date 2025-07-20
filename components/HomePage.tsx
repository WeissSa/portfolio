import type { NextPage } from 'next';
import { Posts } from '../components/Posts';
import { Box, Container, Title } from '@mantine/core';
import { Post } from '../lib/posts';
import { WelcomeSection } from './WelcomeSection';
import React, { useRef } from 'react';
import { useScrollNavigation } from '../lib/useScrollNavigation';
import { TagFilter } from './TagFilter';

interface HomePageProps {
  allPostsData: Post[];
}

export const HomePage: NextPage<HomePageProps> = ({ allPostsData }) => {
  const welcomeSectionRef = useRef<HTMLDivElement>(null);
  const experienceSectionRef = useRef<HTMLDivElement>(null);
  const postsScrollRef = useRef<HTMLDivElement>(null);

  const { handleWheel, handleTouchStart, handleTouchMove, currentSection } =
    useScrollNavigation({
      welcomeSectionRef,
      experienceSectionRef,
      postsScrollRef,
    });

  return (
    <div
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      style={{
        height: '100vh',
        overflow: 'hidden', // Hide main scrollbar
      }}
    >
      <Box
        ref={welcomeSectionRef}
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          backgroundImage: 'url(/banner.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.4)',
            zIndex: 1,
          }}
        />
        <div style={{ zIndex: 2 }}>
          <WelcomeSection />
        </div>
      </Box>
      <Container
        ref={experienceSectionRef} // Apply ref here
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Title order={1} align="center" my="lg">
          Experience & Projects
        </Title>
        <Posts posts={allPostsData} postsRef={postsScrollRef} />
        <TagFilter posts={allPostsData} currentSection={currentSection} />
      </Container>
    </div>
  );
};
