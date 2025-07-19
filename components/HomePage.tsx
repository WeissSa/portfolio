import type { NextPage } from 'next';
import { Posts } from '../components/Posts';
import { Container, Title } from '@mantine/core';
import { Post } from '../lib/posts';
import { WelcomeSection } from './WelcomeSection';
import React, { useRef, useState } from 'react';

interface HomePageProps {
  allPostsData: Post[];
}

export const HomePage: NextPage<HomePageProps> = ({ allPostsData }) => {
  const welcomeSectionRef = useRef<HTMLDivElement>(null);
  const experienceSectionRef = useRef<HTMLDivElement>(null);
  const postsScrollRef = useRef<HTMLDivElement>(null);

  const [currentSection, setCurrentSection] = useState(0); // 0: Welcome, 1: Experience/Projects

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const deltaY = e.deltaY;

    if (currentSection === 0) {
      // Currently on Welcome section
      if (deltaY > 0) {
        // Scrolling down
        experienceSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
        setCurrentSection(1);
      }
    } else if (currentSection === 1) {
      // Currently on Experience/Projects section
      if (deltaY > 0) {
        // Scrolling down (trying to go into carousel)
        if (postsScrollRef.current) {
          const { scrollWidth, clientWidth, scrollLeft } =
            postsScrollRef.current;
          if (scrollLeft + clientWidth < scrollWidth) {
            // More to scroll horizontally
            postsScrollRef.current.scrollBy({
              left: clientWidth,
              behavior: 'smooth',
            }); // Scroll one card width
          }
        }
      } else {
        // Scrolling up (trying to go back to Welcome or previous carousel card)
        if (postsScrollRef.current) {
          const { scrollLeft } = postsScrollRef.current;
          if (scrollLeft > 0) {
            // More to scroll horizontally to the left
            postsScrollRef.current.scrollBy({
              left: -postsScrollRef.current.clientWidth,
              behavior: 'smooth',
            }); // Scroll one card width back
          } else {
            // At the beginning of the carousel, go back to Welcome
            welcomeSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
            setCurrentSection(0);
          }
        }
      }
    }
  };

  return (
    <div
      onWheel={handleWheel}
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
