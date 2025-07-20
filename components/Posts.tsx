import { PostCard } from './PostCard';
import { TagFilter } from './TagFilter';
import React from 'react';
import { useTags } from '../contexts/TagContext';

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
  const { selectedTags } = useTags();

  const filteredPosts = posts.filter((post) => {
    if (selectedTags.length === 0) {
      return true;
    }
    return selectedTags.every((tag) => post.tags.includes(tag));
  });

  return (
    <>
      <TagFilter posts={posts} />
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
        {filteredPosts.map((post) => (
          <div
            key={post.title}
            style={{
              flex: '0 0 90%',
              scrollSnapAlign: 'center',
              padding: '0 0.5rem', // Adjust padding to show hint
              boxSizing: 'border-box',
            }}
          >
            <PostCard post={post} />
          </div>
        ))}
      </div>
    </>
  );
}
