import { POSTS, postId } from '../content/posts';
import { usePortfolioStore } from '../state/store';
import { DisplayTitle } from './primitives';
import { PostCard } from './PostCard';

/** The Library — all 13 experience/project posts (REWORK_PLAN §3.2.1). */
export function ExperienceView() {
  // Visual parity (commit 6): a hovered/selected 3D book highlights the
  // matching DOM card. The list itself is fully keyboard/screen-reader usable
  // regardless — the 3D scene never gates access to the content.
  const hoveredPostId = usePortfolioStore((state) => state.hoveredPostId);
  const selectedPostId = usePortfolioStore((state) => state.selectedPostId);

  return (
    <section aria-labelledby="experience-heading" className="p5-cut-in">
      <DisplayTitle level={2} className="mb-4 text-p5-red">
        <span id="experience-heading">Experience</span>
      </DisplayTitle>
      <ul className="flex flex-col gap-4">
        {POSTS.map((post) => {
          const id = postId(post);
          return (
            <li key={id}>
              <PostCard
                post={post}
                highlighted={id === hoveredPostId || id === selectedPostId}
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
