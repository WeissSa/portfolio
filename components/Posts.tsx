import { PostCard } from './PostCard';
import React from 'react';

interface PostsProps {
  posts: {
    title: string;
    description: string;
    repo: string;
    tags: string[];
    image: string;
  }[];
  postsRef: React.RefObject<HTMLDivElement>;
}

export function Posts({ posts, postsRef }: PostsProps) {
  return (
    <div
      ref={postsRef}
      style={{
        display: 'flex',
        overflowX: 'auto',
        scrollSnapType: 'x mandatory',
        paddingBottom: '1rem',
        width: '100%',
      }}
      className="hide-scrollbar"
    >
      {posts.map((post) => (
        <div
          key={post.title}
          style={{
            flex: '0 0 100%',
            scrollSnapAlign: 'center',
            padding: '0 1rem', // Add horizontal padding here
            boxSizing: 'border-box',
          }}
        >
          <PostCard post={post} />
        </div>
      ))}
    </div>
  );
}
