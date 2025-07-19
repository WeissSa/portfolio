import type { NextPage } from 'next';
import { Posts } from '../components/Posts';
import { Container, Title } from '@mantine/core';
import { Post } from '../lib/posts';
import { WelcomeSection } from './WelcomeSection';

interface HomePageProps {
  allPostsData: Post[];
}

const HomePage: NextPage<HomePageProps> = ({ allPostsData }) => {
  return (
    <Container>
      <WelcomeSection />
      <Title order={1} align="center" my="lg">
        Experience & Projects
      </Title>
      <Posts posts={allPostsData} />
    </Container>
  );
};

export default HomePage;
