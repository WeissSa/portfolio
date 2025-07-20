import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTags } from '../contexts/TagContext';
import { Post } from '../lib/posts';
import { Chip, Stack, Title, Card, useMantineTheme } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import classes from './TagFilter.module.css';
import {
  ANIMATION_INITIAL_OPACITY,
  ANIMATION_INITIAL_X,
  ANIMATION_ANIMATE_OPACITY,
  ANIMATION_ANIMATE_X,
  ANIMATION_EXIT_OPACITY,
  ANIMATION_EXIT_X,
  ANIMATION_DURATION,
  TAG_FILTER_TOP,
  TAG_FILTER_RIGHT,
  TAG_FILTER_WIDTH,
  TAG_FILTER_HEIGHT,
  TAG_FILTER_BORDER_RADIUS,
  TAG_FILTER_Z_INDEX,
  CARD_PADDING,
  TITLE_ORDER,
  TITLE_MARGIN_Y,
  STACK_GAP,
  CHIP_MARGIN_Y,
  CHIP_LABEL_WIDTH,
  CHIP_LABEL_PADDING,
} from '../constants/TagFilter';

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
          initial={{
            opacity: ANIMATION_INITIAL_OPACITY,
            x: ANIMATION_INITIAL_X,
          }}
          animate={{
            opacity: ANIMATION_ANIMATE_OPACITY,
            x: ANIMATION_ANIMATE_X,
          }}
          exit={{ opacity: ANIMATION_EXIT_OPACITY, x: ANIMATION_EXIT_X }}
          transition={{ duration: ANIMATION_DURATION }}
          className={classes.tagFilterContainer}
        >
          <Card
            className={classes.tagFilterCard}
            onWheel={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}
          >
            <Title order={4} ta="center" my="sm">
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
