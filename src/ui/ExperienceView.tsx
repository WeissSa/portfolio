import { POSTS } from '../content/posts';
import { DisplayTitle } from './primitives';
import { PostCard } from './PostCard';

/** The Library — all 13 experience/project posts (REWORK_PLAN §3.2.1). */
export function ExperienceView() {
  return (
    <section aria-labelledby="experience-heading" className="p5-cut-in">
      <DisplayTitle level={2} className="mb-4 text-p5-red">
        <span id="experience-heading">Experience</span>
      </DisplayTitle>
      <ul className="flex flex-col gap-4">
        {POSTS.map((post) => (
          <li key={post.title}>
            <PostCard post={post} />
          </li>
        ))}
      </ul>
    </section>
  );
}
