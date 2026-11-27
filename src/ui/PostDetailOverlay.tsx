/**
 * Book detail panel (REWORK_PLAN §3.2.1/§3.7, UX fix pass 2026-11-25).
 *
 * Selecting a book (3D pick or DOM card) writes `selectedPostId`; this renders
 * the opened book's FULL verbatim detail through the shared `DetailMirror`
 * panel — a visible, scrollable, focus-trapped dialog framed by the room. The
 * body is the SAME `PostCard` used by the 2D list, forced open, so the complete
 * description, tag chips and repo link are readable immediately and scroll
 * when long. One code path in every mode: fine-pointer 3D, coarse pointer,
 * reduced motion and the 2D route all show the same readable panel.
 */
import { findPostById } from '../content/posts';
import { useClearSceneHover, useInertBackground } from '../lib/dialog-effects';
import { usePortfolioStore } from '../state/store';
import { DetailMirror } from './DetailMirror';
import { PostCard } from './PostCard';

export function PostDetailOverlay() {
  const selectedPostId = usePortfolioStore((state) => state.selectedPostId);
  const selectPost = usePortfolioStore((state) => state.selectPost);
  const post = findPostById(selectedPostId);
  const open = Boolean(post);
  useInertBackground(open);
  useClearSceneHover(open);

  if (!post) return null;

  return (
    <DetailMirror
      label={`Details for ${post.title}`}
      title={post.title}
      surface="book"
      onClose={() => selectPost(null)}
      closeLabel={`Close details for ${post.title}`}
    >
      <PostCard post={post} expanded highlighted hideHeading />
      <p role="status" aria-live="polite" className="sr-only">
        Details opened for {post.title}
      </p>
    </DetailMirror>
  );
}
