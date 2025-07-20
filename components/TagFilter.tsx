import { useTags } from '../contexts/TagContext';
import { Post } from '../lib/posts';
import { Chip, Stack, Title, Card, useMantineTheme } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';

interface TagFilterProps {
  posts: Post[];
}

export const TagFilter = ({ posts }: TagFilterProps) => {
  const { selectedTags, setSelectedTags } = useTags();
  const theme = useMantineTheme();
  const isMobile = useMediaQuery(`(max-width: ${theme.breakpoints.lg})`);

  const tagCount: { [key: string]: number } = {};
  posts.forEach((post) => {
    post.tags.forEach((tag) => {
      tagCount[tag] = (tagCount[tag] || 0) + 1;
    });
  });

  const sortedTags = Object.keys(tagCount).sort((a, b) => {
    if (a === '★') return -1;
    if (b === '★') return 1;
    return tagCount[b] - tagCount[a];
  });

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
    <Card
      style={{
        position: 'absolute',
        top: '20vh',
        right: '2rem',
        width: '200px',
        height: '60vh',
        overflowY: 'auto',
        padding: '1rem',
        borderRadius: '8px',
      }}
      withBorder
      shadow="lg"
      className="hide-scrollbar"
      onWheel={(e) => e.stopPropagation()}
    >
      <Title order={4} align="center" my="sm">
        Filter by Tag
      </Title>
      <Stack align="center" gap="xs">
        {sortedTags.map((tag) => (
          <Chip
            key={tag}
            value={tag}
            checked={selectedTags.includes(tag)}
            onChange={() => handleTagChange(tag)}
            styles={{
              label: {
                width: '150px',
                textOverflow: 'ellipsis',
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                display: 'inline-block',
                textAlign: 'center',
              },
            }}
          >
            {tag}
          </Chip>
        ))}
      </Stack>
    </Card>
  );
};
