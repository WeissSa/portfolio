import { Badge } from '@mantine/core';
import classes from './PostCard.module.css';
import React from 'react';

interface PostTagProps {
  tag: string;
}

export function PostTag({ tag }: PostTagProps) {
  return (
    <Badge color="pink" variant="light">
      <span className={classes.tag}>{tag}</span>
    </Badge>
  );
}
