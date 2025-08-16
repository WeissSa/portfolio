import type { NextPage } from 'next';
import { getSortedPostsData, Post } from '../lib/posts';
import { HomePage } from '../components/HomePage';

export async function getStaticProps() {
  const allPostsData = getSortedPostsData();
  return {
    props: {
      allPostsData,
    },
  };
}

const Index: NextPage<{ allPostsData: Post[] }> = ({ allPostsData }) => {
  return (
    <>
      <HomePage allPostsData={allPostsData} />
    </>
  );
};

export default Index;
