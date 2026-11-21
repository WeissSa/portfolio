import { PROJECTS } from '../content/posts';
import { DisplayTitle } from './primitives';
import { PostCard } from './PostCard';

/** Game cases on the desk — the projects shelf (REWORK_PLAN §3.2.3). */
export function ProjectsView() {
  return (
    <section aria-labelledby="projects-heading" className="p5-cut-in">
      <DisplayTitle level={2} className="mb-4 text-p5-red">
        <span id="projects-heading">Projects — Game Cases</span>
      </DisplayTitle>
      <ul className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {PROJECTS.map((post) => (
          <li key={post.title}>
            <PostCard post={post} variant="case" />
          </li>
        ))}
      </ul>
    </section>
  );
}
