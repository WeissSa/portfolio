import { PROJECTS, postId } from '../content/posts';
import { usePortfolioStore } from '../state/store';
import { DisplayTitle } from './primitives';
import { PostCard } from './PostCard';

/** Game cases on the desk — the projects shelf (REWORK_PLAN §3.2.3). */
export function ProjectsView() {
  // Visual parity (commit 8): a hovered/selected 3D case highlights the
  // matching DOM card. The list stays fully keyboard/screen-reader operable;
  // the scene never gates access to any project content.
  const hoveredProjectId = usePortfolioStore((state) => state.hoveredProjectId);
  const selectedProjectId = usePortfolioStore(
    (state) => state.selectedProjectId,
  );

  return (
    <section aria-labelledby="projects-heading" className="p5-cut-in">
      <DisplayTitle level={2} className="mb-4 text-p5-red">
        <span id="projects-heading">Projects — Game Cases</span>
      </DisplayTitle>
      <ul className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {PROJECTS.map((post) => {
          const id = postId(post);
          return (
            <li key={id}>
              <PostCard
                post={post}
                variant="case"
                highlighted={
                  id === hoveredProjectId || id === selectedProjectId
                }
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
