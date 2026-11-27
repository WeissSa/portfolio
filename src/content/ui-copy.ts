/**
 * All visitor-facing interface copy lives here so it can be audited in one
 * place. Internal vocabulary from the implementation ("in-world readout",
 * "projector feed", "case file", "room menu", "mirror", "panel") must never
 * leak into the UI: a visitor sees people words — Details, Close, View
 * climate details — regardless of which in-world object opened the content.
 *
 * Content copy (bio, posts, climate facts) stays in its own content modules;
 * this file is only the chrome around that content.
 */
import { CLIMATE_TITLE } from './climate';

export const UI_COPY = {
  /** Small kicker above a detail heading (was "In-world readout"). */
  detailChip: 'Details',
  /** Universal dismiss label. Never "Back to the room" as a title. */
  close: 'Close',
  /** Accessible name of the sr-only pick trigger / focus return target. */
  backToRoom: 'Back to the room',
  /** DOM trigger that opens the climate detail from the Climate zone. */
  viewClimateDetails: 'View climate details',
  /** Dialog name + visible heading for the climate detail. */
  climateDetailsTitle: `${CLIMATE_TITLE} — Details`,
  /** Screen-reader announcement when the climate detail opens. */
  climateOpened: 'Climate details opened',
  /** Accessible name of the About detail dialog. */
  aboutDetailsTitle: 'About Sam — Details',
  /** Visible heading inside the About detail. */
  aboutTitle: 'About Sam',
  /** Accessible name / close label of the About detail. */
  closeAboutDetails: 'Close About details',
  /** Close label of the climate detail. */
  closeClimateDetails: 'Close details',
  /** Reveal-on-focus chip in the semantic menu (was "Keyboard menu — focus visible"). */
  menuFocusChip: 'Menu',
  /** Label above the pointer-visible menu strip (was "Sam Weiss — room menu"). */
  pointerMenuLabel: 'Sections',
  /** Projects shelf heading and count (was "Projects — Game Cases"/"case files"). */
  projectsTitle: 'Projects',
  projectsCount: (count: number) =>
    `${String(count).padStart(2, '0')} projects`,
  /** View-mode controls (was "Rendering mode"/"3D room mode"/"Static 3D"). */
  viewOptionsLabel: 'View options',
  view3d: '3D view',
  viewStandard: 'Standard view',
  viewAuto: 'Auto',
  viewReduced: 'Reduced motion view',
  modeEnabled: (view: string) => `${view} on`,
  /** Loading / fallback notices (was "Loading the room…"/"3D unavailable — showing 2D"). */
  loading: 'Loading…',
  roomReady: 'Room ready',
  viewUnavailable:
    "The 3D view isn't available here — showing the standard view.",
  /** Static-view HUD note (was "static view"). */
  stillView: 'Still view',
  zoneAnnouncement: (zone: string) => `${zone} selected`,
  /** Inline card toggle labels. */
  openCase: 'View project',
  openDetails: 'Details',
  /** Private-source note on cards without a repository link. */
  ndaNote: 'Source code is private — details under NDA.',
  /** Painted call-to-action on the in-world projector screen. */
  projectorPaintedCta: 'VIEW DETAILS →',
  /** Status line while a detail is opening / after it opens. */
  postOpened: (title: string) => `Details opened for ${title}`,
  projectOpened: (title: string) => `Project details opened for ${title}`,
  postDetailsLabel: (title: string) => `Details for ${title}`,
  projectDetailsLabel: (title: string) => `Project details for ${title}`,
  closeDetailsLabel: (title: string) => `Close details for ${title}`,
  aboutOpened: 'About details opened',
  skipToContent: 'Skip to content',
  mainMenu: 'Main menu',
  /** About desktop metaphor: the visitor sees ordinary section words. */
  aboutWindowLabel: (label: string) => label,
  closeAboutWindow: (label: string) => `Close ${label}`,
  aboutIconsLabel: 'Sections',
  skillsLabel: 'Skills',
  /** Weather freshness copy: no "cache"/"snapshot"/"generated" jargon. */
  climateSource: (source: string) =>
    source === 'live'
      ? 'Open-Meteo'
      : source === 'cache' || source === 'snapshot'
        ? 'saved weather data'
        : '',
  climateFreshness: (age: string | null, saved: boolean) =>
    age ? `Last updated ${age}` : saved ? 'Saved weather data shown' : '',
  climateMood: (emoji: string) => `Weather feeling: ${emoji}`,
} as const;

export type UiCopy = typeof UI_COPY;
