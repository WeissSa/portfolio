import { Card, Text, Badge, Group, Button, ActionIcon } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconChevronDown, IconChevronUp } from '@tabler/icons-react';
import { motion, AnimatePresence } from 'framer-motion';

interface PostCardProps {
  post: {
    title: string;
    description: string;
    repo: string;
    tags: string[];
    image: string;
  };
}

export function PostCard({ post }: PostCardProps) {
  const [opened, { toggle }] = useDisclosure(false);

  return (
    <Card shadow="sm" p="lg" radius="md" withBorder>
      <Group position="apart" mt="md" mb="xs">
        <Text weight={500}>{post.title}</Text>
        <ActionIcon onClick={toggle}>
          {opened ? (
            <IconChevronUp size="1rem" />
          ) : (
            <IconChevronDown size="1rem" />
          )}
        </ActionIcon>
      </Group>

      {!opened && (
        <Group position="left" mt="md">
          {post.tags.slice(0, 3).map((tag) => (
            <Badge key={tag} color="pink" variant="light">
              {tag}
            </Badge>
          ))}
        </Group>
      )}

      <AnimatePresence initial={false}>
        {opened && (
          <motion.div
            key="content"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
          >
            <Card.Section>
              <img
                src={`/${post.image}`}
                alt={`Screenshot or picture of ${post.title}`}
                height={160}
              />
            </Card.Section>

            <div dangerouslySetInnerHTML={{ __html: post.description }} />

            <Group position="left" mt="md">
              {post.tags.map((tag) => (
                <Badge key={tag} color="pink" variant="light">
                  {tag}
                </Badge>
              ))}
            </Group>

            <a href={post.repo} target="_blank" rel="noopener noreferrer">
              <Button variant="light" color="blue" mt="md" radius="md">
                View on GitHub
              </Button>
            </a>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
