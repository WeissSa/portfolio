import {
  Card,
  Text,
  Group,
  ActionIcon,
  Image,
  Box,
  Center,
} from '@mantine/core';
import { PostTag } from './PostTag';
import { useDisclosure } from '@mantine/hooks';
import { IconChevronDown, IconChevronUp } from '@tabler/icons-react';
import classes from './PostCard.module.css';
import { AnimatePresence, motion } from 'framer-motion';
import React from 'react';

interface PostCardProps {
  post: {
    title: string;
    description: string;
    repo: string;
    tags: string[];
    image: string;
  };
}

export const PostCard = React.memo(({ post }: PostCardProps) => {
  const [opened, { toggle }] = useDisclosure(false);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      if ((event.target as HTMLElement).tagName === 'A') {
        return;
      }
      event.preventDefault(); // Prevent default scroll behavior for spacebar
      toggle();
    }
  };

  const handleGithubClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation(); // Prevent the card from toggling when clicking the GitHub icon
    const link = post.repo.slice(post.repo.indexOf('http'));
    window.open(link, '_blank');
  };

  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).tagName === 'A') {
      return;
    }
    toggle();
  };

  return (
    <Card
      shadow="sm"
      p="lg"
      radius="md"
      withBorder
      role="button"
      tabIndex={0} // Make the card focusable
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      aria-expanded={opened}
      className={classes.card}
    >
      <Group mt="md" mb="xs" justify="space-between">
        <Group>
          <ActionIcon
            onClick={toggle}
            aria-label={opened ? 'Collapse post' : 'Expand post'}
            tabIndex={-1} // Prevent double tabbing on the icon itself
          >
            {opened ? (
              <IconChevronUp size="1rem" />
            ) : (
              <IconChevronDown size="1rem" />
            )}
          </ActionIcon>
          <Text fw={500} style={{ flexGrow: 1, textAlign: 'center' }}>
            {post.title}
          </Text>
        </Group>
        {post.repo !== '/private' && (
          <ActionIcon
            onClick={(event) => {
              handleGithubClick(event);
            }}
            aria-label="Open GitHub repository"
            role="link"
            className={classes.githubIcon}
          >
            <Image
              src="/portfolio/GitHub.png"
              alt="GitHub Logo"
              width={24}
              height={24}
            />
          </ActionIcon>
        )}
      </Group>
      {!opened && (
        <Group justify="flex-start" mt="md">
          {post.tags.slice(0, 3).map((tag) => (
            <PostTag key={tag} tag={tag} />
          ))}
        </Group>
      )}

      <Box pt={opened ? 'md' : 0}>
        <AnimatePresence initial={false}>
          {opened && (
            <motion.div
              key="content"
              initial={{ opacity: 0, height: 0, y: -20, scaleY: 0.95 }}
              animate={{ opacity: 1, height: 'auto', y: 0, scaleY: 1 }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              onWheel={(e) => e.stopPropagation()}
              onTouchMove={(e) => e.stopPropagation()}
              className={classes.expandedContent}
            >
              <div
                data-testid="post-description"
                dangerouslySetInnerHTML={{ __html: post.description }}
                style={{ overflow: 'auto' }}
              />

              <Card.Section>
                <Center>
                  <img
                    src={`/${post.image}`}
                    alt={`Screenshot or picture of ${post.title}`}
                    height={160}
                  />
                </Center>
              </Card.Section>

              <Group justify="flex-start" mt="md">
                {post.tags.map((tag) => (
                  <PostTag key={tag} tag={tag} />
                ))}
              </Group>
            </motion.div>
          )}
        </AnimatePresence>
      </Box>
    </Card>
  );
});

PostCard.displayName = 'PostCard'; // For better debugging in React DevTools
