import { useId, useState } from 'react';
import { displayTags, type Post } from '../content/posts';
import { assetUrl, P5Panel, StarMark, TagChip, GitHubIcon } from './primitives';

const NDA_NOTE = 'Repository is private — details under NDA.';

/**
 * Expandable P5 panel for one post (shared by the Experience library and
 * the Projects game-case shelf). Keyboard: the toggle is a real <button>;
 * Enter/Space work natively. Description HTML is the verbatim legacy copy.
 */
export function PostCard({
  post,
  variant = 'library',
}: {
  post: Post;
  variant?: 'library' | 'case';
}) {
  const [expanded, setExpanded] = useState(false);
  const descriptionId = useId();
  const tags = displayTags(post);

  return (
    <P5Panel slashed className="p5-cut-in">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="p5-display flex-1 text-lg md:text-xl">
          {post.featured && <StarMark />} {post.title}
        </h3>
        <div className="flex items-center gap-2">
          {post.repoUrl ? (
            <a
              href={post.repoUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Open repository for ${post.title} (opens in a new tab)`}
              className="p5-btn p5-btn--red px-3"
            >
              <GitHubIcon />
            </a>
          ) : null}
          <button
            type="button"
            onClick={() => setExpanded((open) => !open)}
            aria-expanded={expanded}
            aria-controls={descriptionId}
            className="p5-btn text-sm"
          >
            {expanded ? 'Close' : variant === 'case' ? 'Open case' : 'Details'}
          </button>
        </div>
      </div>

      {!expanded && tags.length > 0 && (
        <ul aria-hidden="true" className="mt-3 flex flex-wrap gap-1">
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
