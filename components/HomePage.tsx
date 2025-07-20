import type { NextPage } from 'next';
import { Posts } from '../components/Posts';
import { Box, Container, Title } from '@mantine/core';
import { Post } from '../lib/posts';
import { WelcomeSection } from './WelcomeSection';
import React, { useRef } from 'react';
import { useScrollNavigation } from '../lib/useScrollNavigation';
import { TagFilter } from './TagFilter';
import styles from './HomePage.module.css';
import { OVERLAY_OPACITY } from '../constants/styles';

interface HomePageProps {
  allPostsData: Post[];
}

export const HomePage: NextPage<HomePageProps> = ({ allPostsData }) => {
  const welcomeSectionRef = useRef<HTMLDivElement>(null!);
  const experienceSectionRef = useRef<HTMLDivElement>(null!);
  const postsScrollRef = useRef<HTMLDivElement>(null!);

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
      className={styles.mainContainer}
    >
      <Box ref={welcomeSectionRef} className={styles.welcomeSection}>
        <div
          className={styles.overlay}
          style={
            { '--overlay-opacity': OVERLAY_OPACITY } as React.CSSProperties
          }
        />
        <div className={styles.contentZIndex}>
          <WelcomeSection />
        </div>
      </Box>
      <Container
        ref={experienceSectionRef} // Apply ref here
        className={styles.experienceSection}
      >
        <Title order={1} ta="center" my="lg">
          Experience & Projects
        </Title>
        <Posts posts={allPostsData} postsRef={postsScrollRef} />
        <TagFilter posts={allPostsData} currentSection={currentSection} />
      </Container>
    </div>
  );
};
