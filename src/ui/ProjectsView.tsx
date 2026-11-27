import { PROJECTS, postId } from '../content/posts';
import { usePortfolioStore } from '../state/store';
import { DisplayTitle } from './primitives';
import { PostCard } from './PostCard';

/**
 * Game cases on the desk — the projects shelf (REWORK_PLAN §3.2.3).
 *
 * Owner fix (2026-11-26): ONE diegetic case file (brass-framed in-world page)
 * with a single scroll region. The expanded card reflows inside its own row;
 * no nested `overflow` container competes with the column/document scroll, so
 * expanding/collapsing always scrolls the same surface. Tag chips, repo links
 * and the verbatim prose come from the shared `PostCard`, never a canvas paint.
 */
export function ProjectsView() {
  // Visual parity (commit 8): a hovered/selected 3D case highlights the
  // matching DOM card. The list stays fully keyboard/screen-reader operable;
  // the scene never gates access to any project content.
  const hoveredProjectId = usePortfolioStore((state) => state.hoveredProjectId);
  const selectedProjectId = usePortfolioStore(
    (state) => state.selectedProjectId,
  );

  return (
    <section
      aria-labelledby="projects-heading"
      className="p5-cut-in projects-shelf"
    >
      <div className="projects-shelf__header">
        <DisplayTitle level={2} className="text-p5-red">
          <span id="projects-heading">Projects — Game Cases</span>
        </DisplayTitle>
        <span className="projects-shelf__count" aria-hidden="true">
          {String(PROJECTS.length).padStart(2, '0')} case files
        </span>
      </div>
      <ol className="projects-shelf__list">
        {PROJECTS.map((post, index) => {
          const id = postId(post);
          return (
            <li key={id} className="projects-shelf__item">
              <span className="projects-shelf__index" aria-hidden="true">
                {String(index + 1).padStart(2, '0')}
              </span>
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
      </ol>
    </section>
  );
}
