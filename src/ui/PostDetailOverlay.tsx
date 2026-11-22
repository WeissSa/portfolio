/**
 * Detail panel for a picked 3D book (REWORK_PLAN §3.2.1/§3.7, commit 6).
 *
 * Selecting a book writes `selectedPostId` into the store; this component
 * renders the SAME PostCard used by the 2D Experience list as a focus-managed
 * DOM dialog on top of the canvas. Nothing about the detail lives in WebGL:
 * screen readers and keyboard users reach it through ordinary buttons, Esc
 * closes, and focus returns to whatever opened it. Deep links to zones still
 * work because no selection is required to navigate.
 */
import { useEffect } from 'react';
import { findPostById } from '../content/posts';
import { useFocusTrap } from '../lib/a11y';
import { usePortfolioStore } from '../state/store';
import { PostCard } from './PostCard';

export function PostDetailOverlay() {
  const selectedPostId = usePortfolioStore((state) => state.selectedPostId);
  const selectPost = usePortfolioStore((state) => state.selectPost);
  const post = findPostById(selectedPostId);
  const trapRef = useFocusTrap<HTMLDivElement>(Boolean(post));

  useEffect(() => {
    if (!post) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      selectPost(null);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [post, selectPost]);

  if (!post) return null;

  return (
    <div className="post-detail-overlay fixed inset-0 z-20 flex items-center justify-center p-3">
      <div
        className="post-detail-backdrop absolute inset-0 bg-p5-black/70"
        aria-hidden="true"
        onClick={() => selectPost(null)}
      />
      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="post-detail-heading"
        tabIndex={-1}
        className="p5-panel p5-panel--slashed post-detail-card relative max-h-[90vh] w-[min(94%,44rem)] overflow-y-auto p-4"
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2
            id="post-detail-heading"
            className="p5-display text-lg text-p5-red"
          >
            {post.title}
          </h2>
          <button
            type="button"
            onClick={() => selectPost(null)}
            aria-label={`Close details for ${post.title}`}
            className="p5-btn p5-btn--red px-3 text-sm"
          >
            ✕
          </button>
        </div>
        <PostCard post={post} expanded />
        <p role="status" aria-live="polite" className="sr-only">
          Details opened for {post.title}
        </p>
      </div>
    </div>
  );
}
