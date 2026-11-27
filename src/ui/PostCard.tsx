import { useId, useState } from 'react';
import { ActionIcon, Button } from '@mantine/core';
import { displayTags, postId, type Post } from '../content/posts';
import { assetUrl, P5Panel, StarMark, TagChip, GitHubIcon } from './primitives';

export const NDA_NOTE = 'Repository is private — details under NDA.';

/**
 * Expandable P5 panel for one post — the SAME component used by the 2D
 * Experience list, the Projects shelf and (commit 6) the 3D book detail
 * overlay. Keyboard: the inline toggle is a real <button> (Enter/Space work
 * natively); the overlay passes `expanded` to force the detail open and owns
 * its own close control. `data-post-id` (+ `data-project-id` on case cards)
 * and `highlighted` bridge 3D hover/selection back to the matching DOM card.
 * Description HTML is verbatim; repo is an external link with noopener.
 */
export function PostCard({
  post,
  variant = 'library',
  expanded: controlledExpanded,
  highlighted = false,
  hideHeading = false,
}: {
  post: Post;
  variant?: 'library' | 'case';
  /** Force the detail open (detail overlay); omit for the inline toggle. */
  expanded?: boolean;
  /** A hovered/selected 3D book or game case highlights its DOM twin. */
  highlighted?: boolean;
  /** The detail panel already shows the title in its header — don't repeat it. */
  hideHeading?: boolean;
}) {
  const [internalExpanded, setInternalExpanded] = useState(false);
  const expanded = controlledExpanded ?? internalExpanded;
  const descriptionId = useId();
  const tags = displayTags(post);

  return (
    <P5Panel
      slashed
      data-post-id={postId(post)}
      // Commit 8: case cards expose the project id as the 3D→DOM picking
      // bridge (parity with hover/selection highlight); library cards keep
      // the original data-post-id hook only.
      data-project-id={variant === 'case' ? postId(post) : undefined}
      className={`p5-cut-in${highlighted ? ' p5-card--highlight' : ''}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        {hideHeading ? (
          // The dialog header already carries the title — keep it for screen
          // readers but never paint a second copy of it inside the panel.
          <h3 className="sr-only">
            {post.featured && <StarMark />} {post.title}
          </h3>
        ) : (
          <h3 className="p5-display flex-1 text-lg md:text-xl">
            {post.featured && <StarMark />} {post.title}
          </h3>
        )}
        <div
          className={`flex items-center gap-2${hideHeading ? ' ml-auto' : ''}`}
        >
          {post.repoUrl ? (
            <ActionIcon
              component="a"
              href={post.repoUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Open repository for ${post.title} (opens in a new tab)`}
              radius={0}
              className="p5-btn p5-btn--red px-3"
            >
              <GitHubIcon />
            </ActionIcon>
          ) : null}
          {controlledExpanded === undefined && (
            <Button
              type="button"
              onClick={() => setInternalExpanded((open) => !open)}
              aria-expanded={expanded}
              aria-controls={descriptionId}
              radius={0}
              className="p5-btn text-sm"
            >
              {expanded
                ? 'Close'
                : variant === 'case'
                  ? 'Open case'
                  : 'Details'}
            </Button>
          )}
        </div>
      </div>

      {!expanded && tags.length > 0 && (
        <ul
          aria-label={`Tags for ${post.title}`}
          className="mt-3 flex flex-wrap gap-1"
        >
          {tags.slice(0, 3).map((tag) => (
            <TagChip key={tag} tag={tag} />
          ))}
        </ul>
      )}

      {expanded && (
        <div id={descriptionId} className="mt-4">
          {/* Trusted verbatim HTML ported from data/posts.json. */}
          <div
            className="p5-prose max-w-prose text-sm leading-relaxed"
            data-testid="post-description"
            dangerouslySetInnerHTML={{ __html: post.descriptionHtml }}
          />
          <div className="mt-4 flex justify-center">
            <img
              src={assetUrl(post.imageFile)}
              alt={`Screenshot or picture of ${post.title}`}
              loading="lazy"
              className="max-h-64 w-auto"
            />
          </div>
          <ul
            aria-label={`Tags for ${post.title}`}
            className="mt-4 flex flex-wrap gap-1"
          >
            {tags.map((tag) => (
              <TagChip key={tag} tag={tag} />
            ))}
          </ul>
          {!post.repoUrl && (
            <p className="mt-3 text-sm font-bold text-p5-yellow">{NDA_NOTE}</p>
          )}
        </div>
      )}
    </P5Panel>
  );
}
