import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTags } from '../contexts/TagContext';
import { Post } from '../lib/posts';
import { Chip, Stack, Title, Card, useMantineTheme } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';

interface TagFilterProps {
  posts: Post[];
  currentSection?: number;
}

export const TagFilter = ({ posts, currentSection }: TagFilterProps) => {
  const { selectedTags, setSelectedTags } = useTags();
  const theme = useMantineTheme();
  const isMobile = useMediaQuery(`(max-width: ${theme.breakpoints.lg})`);
  const isAtTop = !currentSection;

  const tagCount: { [key: string]: number } = {};
  posts.forEach((post) => {
    post.tags.forEach((tag) => {
      tagCount[tag] = (tagCount[tag] || 0) + 1;
    });
  });

  const sortedTags = useMemo(
    () =>
      Object.keys(tagCount).sort((a, b) => {
        if (a === '★') return -1;
        if (b === '★') return 1;
        return tagCount[b] - tagCount[a];
      }),
    [tagCount],
  );

  const handleTagChange = (tag: string) => {
    const newSelectedTags = selectedTags.includes(tag)
      ? selectedTags.filter((t) => t !== tag)
      : [...selectedTags, tag];
    setSelectedTags(newSelectedTags);
  };

  if (isMobile) {
    return null;
  }

  return (
    <AnimatePresence>
      {!isAtTop && (
        <motion.div
          initial={{ opacity: 0, x: 100 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 100 }}
          transition={{ duration: 0.5 }}
          style={{
            position: 'absolute',
            top: '20vh',
            right: '2rem',
            width: '200px',
            height: '60vh',
            overflowY: 'auto',
            borderRadius: '8px',
            zIndex: 100, // Ensure it's above other content
          }}
        >
          <Card
            style={{
              height: '100%', // Make card fill the motion.div
              padding: '1rem',
              overflowY: 'auto',
            }}
            withBorder
            shadow="lg"
            className="hide-scrollbar"
            onWheel={(e) => e.stopPropagation()}
          >
            <Title order={4} align="center" my="sm">
              Filter by Tag
            </Title>
            <Stack align="center" gap="0">
              {sortedTags.map((tag) => (
                <Chip
                  key={tag}
                  value={tag}
                  checked={selectedTags.includes(tag)}
                  onChange={() => handleTagChange(tag)}
                  my={6}
                  styles={{
                    label: {
                      width: '150px',
                      textAlign: 'center',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      padding: '0.5rem 1rem',
                    },
                  }}
                >
                  {tag}
                </Chip>
              ))}
            </Stack>
          </Card>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
