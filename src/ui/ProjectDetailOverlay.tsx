/**
 * Game-case detail dialog (REWORK_PLAN §3.2.3/§3.7, commit 8).
 *
 * Picking a 3D case writes `selectedProjectId`; this renders the SAME PostCard
 * used by the 2D Projects list, forced open, inside a focus-managed DOM dialog
 * on top of the canvas. Repo / demo links and tags are ordinary accessible DOM
 * (repo uses target=_blank + noopener noreferrer; demo links live verbatim in
 * the description HTML). Esc, the backdrop and the close button all dismiss;
 * focus returns to whatever opened the dialog. Rendered OUTSIDE .app-shell, so
 * the A2 pointer-events gating in 3D mode never makes its controls inert.
 */
import { useEffect } from 'react';
import { findPostById } from '../content/posts';
import { useFocusTrap } from '../lib/a11y';
import { useClearSceneHover, useInertBackground } from '../lib/dialog-effects';
import { usePortfolioStore } from '../state/store';
import { PostCard } from './PostCard';

export function ProjectDetailOverlay() {
  const selectedProjectId = usePortfolioStore(
    (state) => state.selectedProjectId,
  );
  const selectProject = usePortfolioStore((state) => state.selectProject);
  const project = findPostById(selectedProjectId);
  const trapRef = useFocusTrap<HTMLDivElement>(Boolean(project));
  useInertBackground(Boolean(project));
  useClearSceneHover(Boolean(project));

  useEffect(() => {
    if (!project) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      event.preventDefault();
      selectProject(null);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [project, selectProject]);

  if (!project) return null;

  return (
    <div className="project-detail-overlay post-detail-overlay fixed inset-0 z-20 flex items-center justify-center p-3">
      <div
        className="post-detail-backdrop absolute inset-0 bg-p5-black/70"
        aria-hidden="true"
        onClick={() => selectProject(null)}
      />
      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="project-detail-heading"
        tabIndex={-1}
        className="p5-panel p5-panel--slashed post-detail-card relative max-h-[90vh] w-[min(94%,44rem)] overflow-y-auto p-4"
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2
            id="project-detail-heading"
            className="p5-display text-lg text-p5-red"
          >
            {project.title}
          </h2>
          <button
            type="button"
            onClick={() => selectProject(null)}
            aria-label={`Close details for ${project.title}`}
            className="p5-btn p5-btn--red px-3 text-sm"
          >
            ✕
          </button>
        </div>
        <PostCard post={project} variant="case" expanded />
        <p role="status" aria-live="polite" className="sr-only">
          Project case opened for {project.title}
        </p>
      </div>
    </div>
  );
}
