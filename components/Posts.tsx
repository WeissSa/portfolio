import { Grid } from '@mantine/core';
import { PostCard } from './PostCard';

interface PostsProps {
  posts: {
    title: string;
    description: string;
    repo: string;
    tags: string[];
    image: string;
  }[];
}

export function Posts({ posts }: PostsProps) {
  return (
    <Grid>
      {posts.map((post) => (
        <Grid.Col key={post.title} span={12}>
          <PostCard post={post} />
        </Grid.Col>
      ))}
    </Grid>
  );
}
