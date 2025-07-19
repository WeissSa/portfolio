import fs from 'fs';
import path from 'path';

export interface Post {
  title: string;
  description: string;
  repo: string;
  tags: string[];
  image: string;
}

const postsDirectory = path.join(process.cwd(), 'data');

export function getSortedPostsData() {
  const fullPath = path.join(postsDirectory, 'posts.json');
  const fileContents = fs.readFileSync(fullPath, 'utf8');
  const posts: Post[] = JSON.parse(fileContents);

  return posts.reverse();
}
