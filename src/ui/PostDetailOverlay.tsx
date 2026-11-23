/**
 * Detail panel for a picked 3D book (REWORK_PLAN §3.2.1/§3.7, commit 6).
 *
 * Selecting a book writes `selectedPostId` into the store; this component
 * renders the opened book's detail as a focus-managed Mantine Modal on top of
 * the canvas. Nothing about the detail lives in WebGL: screen readers and
 * keyboard users reach it through ordinary DOM, Esc closes, and focus returns
 * to whatever opened it. The inside is the lazy `PostBook` — a pure-DOM flat
 * @gfazioli/mantine-book whose pages carry the SAME verbatim post content
 * (cover / tags / description / repo link). Until that chunk arrives, the
 * Suspense fallback shows the classic PostCard detail, so the dialog is
 * complete and accessible from the first frame.
 *
 * Focus model (single trap): Mantine's Modal owns Tab scoping and initial
 * focus; `useFocusRestore` returns focus to the opener on close (declared
 * AFTER `useInertBackground` so the shell un-inerts BEFORE focus is restored).
 */
import { Suspense, lazy, useEffect } from 'react';
import { Modal } from '@mantine/core';
import { findPostById } from '../content/posts';
import { useFocusRestore } from '../lib/a11y';
import { useClearSceneHover, useInertBackground } from '../lib/dialog-effects';
import { usePortfolioStore } from '../state/store';
import { PostCard } from './PostCard';

const PostBook = lazy(() => import('./PostBook'));

export function PostDetailOverlay() {
  const selectedPostId = usePortfolioStore((state) => state.selectedPostId);
  const selectPost = usePortfolioStore((state) => state.selectPost);
  const post = findPostById(selectedPostId);
  const open = Boolean(post);
  useInertBackground(open);
  useClearSceneHover(open);
  useFocusRestore(open);

  useEffect(() => {
    if (!post) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      event.preventDefault();
      selectPost(null);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [post, selectPost]);

  if (!post) return null;

  return (
    <Modal
      opened
      onClose={() => selectPost(null)}
      // The document-level handler above owns Escape (defaultPrevented +
      // sibling-dialog deferral); Mantine must not close on its own.
      closeOnEscape={false}
      centered
      size="min(94%, 44rem)"
      title={<h2 className="p5-display text-lg text-p5-red">{post.title}</h2>}
      closeButtonProps={{
        'aria-label': `Close details for ${post.title}`,
        className: 'p5-btn p5-btn--red px-3 text-sm',
      }}
      classNames={{
        root: 'post-detail-overlay',
        overlay: 'post-detail-backdrop',
        content: 'p5-panel p5-panel--slashed post-detail-card',
      }}
      styles={{ content: { maxHeight: '90vh', overflowY: 'auto' } }}
    >
      <Suspense fallback={<PostCard post={post} expanded />}>
        <PostBook post={post} />
      </Suspense>
      <p role="status" aria-live="polite" className="sr-only">
        Details opened for {post.title}
      </p>
    </Modal>
  );
}
