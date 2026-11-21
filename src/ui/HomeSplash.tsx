import {
  BIO_PARAGRAPH,
  HEADLINE,
  SITE_OWNER,
  WELCOME_TITLE,
} from '../content/bio';
import { LINKS } from '../content/links';
import { navigate } from '../lib/router';
import { P5Panel } from './primitives';

/** P5 splash: big slashed title, headline, take-off-your-heart CTA row. */
export function HomeSplash() {
  return (
    <section aria-labelledby="home-heading" className="p5-cut-in">
      <P5Panel variant="red" className="mb-4">
        <p className="p5-display text-sm opacity-80">{WELCOME_TITLE}</p>
        <h2
          id="home-heading"
          className="p5-display text-4xl leading-none text-p5-black md:text-6xl"
        >
          {SITE_OWNER}
        </h2>
        <p className="mt-2 text-lg font-bold text-p5-black md:text-xl">
          {HEADLINE}
        </p>
      </P5Panel>

      <P5Panel slashed className="mb-4">
        <p className="max-w-prose text-sm leading-relaxed md:text-base">
          {BIO_PARAGRAPH}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => navigate('/experience')}
            className="p5-btn p5-btn--red"
          >
            See Experience
          </button>
          <button
            type="button"
            onClick={() => navigate('/climate')}
            className="p5-btn"
          >
            Our Climate, Our Future
          </button>
        </div>
      </P5Panel>

      <P5Panel variant="white" className="text-sm">
        <p className="font-bold">
          Find me on{' '}
          <a
            href={LINKS.github.url}
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            GitHub
          </a>{' '}
          and{' '}
          <a
            href={LINKS.linkedin.url}
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            LinkedIn
          </a>
          .
        </p>
      </P5Panel>
    </section>
  );
}
