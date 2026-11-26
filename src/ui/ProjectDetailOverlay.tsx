/**
 * Game-case detail panel (REWORK_PLAN §3.2.3/§3.7, UX fix pass 2026-11-25).
 *
 * Picking a 3D case (or a DOM card) writes `selectedProjectId`; this renders
 * the SAME PostCard used by the 2D Projects list through the shared, visible,
 * scrollable `DetailMirror` dialog. Repo / demo links and tag chips remain
 * ordinary accessible DOM. One code path for every mode and pointer type.
 */
import { findPostById } from '../content/posts';
import { useClearSceneHover, useInertBackground } from '../lib/dialog-effects';
import { usePortfolioStore } from '../state/store';
import { DetailMirror } from './DetailMirror';
import { PostCard } from './PostCard';

export function ProjectDetailOverlay() {
  const selectedProjectId = usePortfolioStore(
    (state) => state.selectedProjectId,
  );
  const selectProject = usePortfolioStore((state) => state.selectProject);
  const project = findPostById(selectedProjectId);
  const open = Boolean(project);
  useInertBackground(open);
  useClearSceneHover(open);

  if (!project) return null;

  return (
    <DetailMirror
      label={`Project details for ${project.title}`}
      title={project.title}
      surface="case"
      onClose={() => selectProject(null)}
      closeLabel={`Close details for ${project.title}`}
    >
      <PostCard post={project} variant="case" expanded />
      <p role="status" aria-live="polite" className="sr-only">
        Project case opened for {project.title}
      </p>
    </DetailMirror>
  );
}
