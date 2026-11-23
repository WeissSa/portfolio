/**
 * Game-case detail dialog (REWORK_PLAN §3.2.3/§3.7, commit 8).
 *
 * Picking a 3D case writes `selectedProjectId`; this renders the SAME PostCard
 * used by the 2D Projects list, forced open, inside a focus-managed Mantine
 * Modal on top of the canvas. Repo / demo links and tags are ordinary
 * accessible DOM (repo uses target=_blank + noopener noreferrer; demo links
 * live verbatim in the description HTML). Esc, the backdrop and the close
 * button all dismiss; focus returns to whatever opened the dialog. The Modal
 * portals OUTSIDE .app-shell, so the A2 pointer-events gating in 3D mode never
 * makes its controls inert.
 *
 * Focus model (single trap): Mantine's Modal owns Tab scoping and initial
 * focus; `useFocusRestore` returns focus to the opener on close (declared
 * AFTER `useInertBackground` so the shell un-inerts BEFORE focus is restored).
 */
import { useEffect } from 'react';
import { Modal } from '@mantine/core';
import { findPostById } from '../content/posts';
import { useFocusRestore } from '../lib/a11y';
import { useClearSceneHover, useInertBackground } from '../lib/dialog-effects';
import { usePortfolioStore } from '../state/store';
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
  useFocusRestore(open);

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
    <Modal
      opened
      onClose={() => selectProject(null)}
      // The document-level handler above owns Escape (defaultPrevented +
      // sibling-dialog deferral); Mantine must not close on its own.
      closeOnEscape={false}
      centered
      size="min(94%, 44rem)"
      title={
        <h2 className="p5-display text-lg text-p5-red">{project.title}</h2>
      }
      closeButtonProps={{
        'aria-label': `Close details for ${project.title}`,
        className: 'p5-btn p5-btn--red px-3 text-sm',
      }}
      classNames={{
        root: 'project-detail-overlay post-detail-overlay',
        overlay: 'post-detail-backdrop',
        content: 'p5-panel p5-panel--slashed post-detail-card',
      }}
      styles={{ content: { maxHeight: '90vh', overflowY: 'auto' } }}
    >
      <PostCard post={project} variant="case" expanded />
      <p role="status" aria-live="polite" className="sr-only">
        Project case opened for {project.title}
      </p>
    </Modal>
  );
}
