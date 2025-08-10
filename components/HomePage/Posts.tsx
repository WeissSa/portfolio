import { PostCard } from './PostCard';
import { TagFilter } from './TagFilter';
import React, { useMemo } from 'react';
import { useTags } from '../../contexts/TagContext';
import styles from './Posts.module.css';

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

  const filteredPosts = useMemo(
    () =>
      posts.filter((post) => {
        if (selectedTags.length === 0) {
          return true;
        }
        return selectedTags.every((tag) => post.tags.includes(tag));
      }),
    [posts, selectedTags],
  );

  return (
    <>
      <TagFilter posts={posts} />
      <div ref={postsRef} className={`${styles.postsContainer} hide-scrollbar`}>
        {filteredPosts.map((post) => (
          <div key={post.title} className={styles.postCardWrapper}>
            <PostCard post={post} />
          </div>
        ))}
      </div>
    </>
  );
}
