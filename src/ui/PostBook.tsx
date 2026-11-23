/**
 * Opened-book detail — @gfazioli/mantine-book FLAT variant (pure DOM).
 *
 * Owner decision 2026-11-22: the Library/Experience book detail renders its
 * inside as a real turnable book. The FLAT variant is pure DOM + CSS (no
 * second WebGL context), lazy-loaded into its own chunk so the instant shell
 * is unaffected. Pages carry the SAME verbatim post content the PostCard
 * fallback shows: cover (title + ★), tags, description HTML, screenshot and
 * repo link / NDA note — nothing is canvas-gated.
 *
 * A11y: the book announces page turns politely (built in), it is fully
 * keyboard-operable through the prev/next controls and Arrow/Home/End keys on
 * this wrapper, and it honors prefers-reduced-motion (built-in transition
 * suppression + an instant `flippingTime` here). It lives INSIDE the detail
 * Modal's single focus trap — no nested trap of its own.
 */
import '@gfazioli/mantine-book/styles.layer.css';
import {
  useCallback,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { ActionIcon, Button } from '@mantine/core';
import { Book, type BookPageData } from '@gfazioli/mantine-book';
import { displayTags, postId, type Post } from '../content/posts';
import { usePrefersReducedMotion } from '../lib/a11y';
import { assetUrl, GitHubIcon, StarMark } from './primitives';
import { NDA_NOTE } from './PostCard';

const PAGE_WIDTH = 260;
const PAGE_HEIGHT = 360;

/** Face content shell: parchment-on-ink via token CSS vars, no raw hex. */
function Face({ children }: { children: ReactNode }) {
  return (
    <div
      className="p5-prose flex h-full w-full flex-col gap-2 overflow-hidden p-4 text-sm"
      style={{ background: 'var(--p5-white)', color: 'var(--p5-black)' }}
    >
      {children}
    </div>
  );
}

export default function PostBook({ post }: { post: Post }) {
  const reducedMotion = usePrefersReducedMotion();
  const tags = displayTags(post);
  const [page, setPage] = useState(0);

  const pages: BookPageData[] = [
    {
      front: (
        <Face>
          <p className="p5-display text-lg" style={{ color: 'var(--p5-red)' }}>
            {post.title}
          </p>
          {post.featured && (
            <p>
              <StarMark />
            </p>
          )}
          <p className="text-xs font-bold">Experience — turn the pages →</p>
        </Face>
      ),
      back: (
        <Face>
          <p className="p5-display text-base">Tags</p>
          <ul
            aria-label={`Tags for ${post.title}`}
            className="flex flex-wrap gap-1"
          >
            {tags.map((tag) => (
              <li key={tag} className="p5-tag">
                {tag}
              </li>
            ))}
          </ul>
        </Face>
      ),
    },
    {
      front: (
        <Face>
          {/* Trust boundary: post.descriptionHtml is trusted build-time content
              (owner's B2 content gate), never user input — see
              src/content/posts-data.ts. */}
          <div
            className="max-w-prose overflow-y-auto text-sm leading-relaxed"
            data-testid="post-description"
            dangerouslySetInnerHTML={{ __html: post.descriptionHtml }}
          />
          {!post.repoUrl && (
            <p className="text-sm font-bold" style={{ color: 'var(--p5-red)' }}>
              {NDA_NOTE}
            </p>
          )}
        </Face>
      ),
      back: (
        <Face>
          <img
            src={assetUrl(post.imageFile)}
            alt={`Screenshot or picture of ${post.title}`}
            loading="lazy"
            className="max-h-48 w-auto"
          />
          {post.repoUrl ? (
            <ActionIcon
              component="a"
              href={post.repoUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Open repository for ${post.title} (opens in a new tab)`}
              radius={0}
              className="p5-btn p5-btn--red mt-2 px-3"
            >
              <GitHubIcon />
            </ActionIcon>
          ) : (
            <p className="mt-2 text-xs font-bold">{NDA_NOTE}</p>
          )}
        </Face>
      ),
    },
  ];

  // Face indices run 0..(2*sheets - 1): 0 = closed front cover, the last odd
  // index = fully turned (back cover). See @gfazioli/mantine-book page-index.
  const lastFace = pages.length * 2 - 1;
  const turn = useCallback(
    (delta: number) =>
      setPage((current) => Math.min(lastFace, Math.max(0, current + delta))),
    [lastFace],
  );

  // Arrow keys while the prev/next CONTROLS have focus (the Book root itself
  // handles Arrow/Home/End natively when IT has focus — never both, so one
  // keypress is always exactly one turn request).
  const onControlsKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      turn(1);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      turn(-1);
    }
  };

  return (
    <div
      data-testid="post-book"
      data-post-id={postId(post)}
      className="post-book flex flex-col items-center gap-3"
    >
      <Book
        variant="flat"
        mod={{ flat: true }}
        width={PAGE_WIDTH}
        height={PAGE_HEIGHT}
        page={page}
        onPageChange={setPage}
        flippingTime={reducedMotion ? 0 : 600}
        pageBackground="var(--p5-white)"
        revealBackground="var(--p5-ink)"
        shadowColor="var(--p5-black)"
        aria-label={`${post.title} — turnable book`}
        pages={pages}
      />
      <div className="flex gap-2" onKeyDown={onControlsKeyDown}>
        <Button
          type="button"
          onClick={() => turn(-1)}
          disabled={page === 0}
          radius={0}
          className="p5-btn min-h-[44px] px-4 text-sm"
        >
          Previous page
        </Button>
        <Button
          type="button"
          onClick={() => turn(1)}
          disabled={page === lastFace}
          radius={0}
          className="p5-btn min-h-[44px] px-4 text-sm"
        >
          Next page
        </Button>
      </div>
    </div>
  );
}
