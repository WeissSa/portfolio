import type { NextPage } from 'next';
import { Posts } from '../components/Posts';
import { Container, Title } from '@mantine/core';
import { Post } from '../lib/posts';
import { WelcomeSection } from './WelcomeSection';
import React, { useRef } from 'react';
import { useScrollNavigation } from '../lib/useScrollNavigation';

interface HomePageProps {
  allPostsData: Post[];
}

export const HomePage: NextPage<HomePageProps> = ({ allPostsData }) => {
  const welcomeSectionRef = useRef<HTMLDivElement>(null);
  const experienceSectionRef = useRef<HTMLDivElement>(null);
  const postsScrollRef = useRef<HTMLDivElement>(null);

  const { handleWheel, handleTouchStart, handleTouchMove } =
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
      <div
        ref={welcomeSectionRef}
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <WelcomeSection />
      </div>
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
      </Container>
    </div>
  );
};
