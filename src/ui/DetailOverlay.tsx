/**
 * The single detail overlay. Whichever in-world object (or DOM trigger) opened
 * a detail writes ONE `activeDetail` to the store; this component maps it to
 * content and renders ONE accessible frame. There are no parallel flags and no
 * second copy of the same content in the zone behind it.
 */
import { findPostById } from '../content/posts';
import { UI_COPY } from '../content/ui-copy';
import { usePortfolioStore } from '../state/store';
import { AboutDesktop } from './AboutDesktop';
import { ClimateView } from './ClimateView';
import { DetailMirror } from './DetailMirror';
import { PostCard } from './PostCard';

export function DetailOverlay({ enabled = true }: { enabled?: boolean }) {
  // Subscribe here so every opener—DOM or 3D pick—shares one reactive surface
  // and a close updates the mounted overlay immediately. `enabled` is App's
  // mode gate: a stale About/climate flag in 2D must not hide the 2D zone.
  const active = usePortfolioStore((state) => state.activeDetail);
  const detail = enabled ? active : null;
  const closeDetail = usePortfolioStore((state) => state.closeDetail);

  if (!detail) return null;

  switch (detail.kind) {
    case 'post': {
      const post = findPostById(detail.id);
      if (!post) return null;
      return (
        <DetailMirror
          label={UI_COPY.postDetailsLabel(post.title)}
          title={post.title}
          surface="book"
          onClose={closeDetail}
          closeLabel={UI_COPY.closeDetailsLabel(post.title)}
        >
          <PostCard post={post} expanded />
          <p role="status" aria-live="polite" className="sr-only">
            {UI_COPY.postOpened(post.title)}
          </p>
        </DetailMirror>
      );
    }
    case 'project': {
      const project = findPostById(detail.id);
      if (!project) return null;
      return (
        <DetailMirror
          label={UI_COPY.projectDetailsLabel(project.title)}
          title={project.title}
          surface="case"
          onClose={closeDetail}
          closeLabel={UI_COPY.closeDetailsLabel(project.title)}
        >
          <PostCard post={project} variant="case" expanded />
          <p role="status" aria-live="polite" className="sr-only">
            {UI_COPY.projectOpened(project.title)}
          </p>
        </DetailMirror>
      );
    }
    case 'about':
      return (
        <DetailMirror
          label={UI_COPY.aboutDetailsTitle}
          title={UI_COPY.aboutTitle}
          surface="monitor"
          onClose={closeDetail}
          closeLabel={UI_COPY.closeAboutDetails}
          blockEscape={() =>
            usePortfolioStore.getState().openWindows.length > 0
          }
        >
          <AboutDesktop hideHeading />
          <p role="status" aria-live="polite" className="sr-only">
            {UI_COPY.aboutOpened}
          </p>
        </DetailMirror>
      );
    case 'climate':
      return (
        <DetailMirror
          label={UI_COPY.climateDetailsTitle}
          title={UI_COPY.climateDetailsTitle}
          surface="projector"
          onClose={closeDetail}
          closeLabel={UI_COPY.closeClimateDetails}
        >
          <ClimateView />
          <p role="status" aria-live="polite" className="sr-only">
            {UI_COPY.climateOpened}
          </p>
        </DetailMirror>
      );
  }
}
