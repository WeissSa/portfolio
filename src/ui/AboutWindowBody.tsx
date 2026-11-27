/**
 * Content of one About window. Own file so AboutDesktop stays a single
 * presentational component (one component per file).
 */
import { Button } from '@mantine/core';
import {
  BIO_PARAGRAPH,
  HOBBIES_EXCERPT,
  NOW_EXCERPTS,
  WELCOME_TITLE,
} from '../content/bio';
import { LINKS } from '../content/links';
import { UI_COPY } from '../content/ui-copy';
import { SKILLS } from '../content/posts';
import type { AboutWindowId } from '../state/store';

export function AboutWindowBody({ id }: { id: AboutWindowId }) {
  switch (id) {
    case 'bio':
      return (
        <>
          <h3 className="p5-display mb-2 text-lg">{WELCOME_TITLE}</h3>
          <p className="max-w-prose text-sm leading-relaxed">{BIO_PARAGRAPH}</p>
        </>
      );
    case 'now':
      return (
        <>
          <h3 className="p5-display mb-2 text-lg">Now</h3>
          {NOW_EXCERPTS.map((excerpt) => (
            <p key={excerpt} className="max-w-prose text-sm leading-relaxed">
              “{excerpt}”
            </p>
          ))}
        </>
      );
    case 'hobbies':
      return (
        <>
          <h3 className="p5-display mb-2 text-lg">Hobbies</h3>
          <p className="max-w-prose text-sm leading-relaxed">
            {HOBBIES_EXCERPT}
          </p>
        </>
      );
    case 'skills':
      return (
        <>
          <h3 className="p5-display mb-2 text-lg">Skills</h3>
          <ul aria-label={UI_COPY.skillsLabel} className="flex flex-wrap gap-1">
            {SKILLS.map((skill) => (
              <li key={skill} className="p5-tag">
                {skill}
              </li>
            ))}
          </ul>
        </>
      );
    case 'links':
      return (
        <>
          <h3 className="p5-display mb-2 text-lg">Links</h3>
          <ul className="flex flex-col gap-2">
            <li>
              <Button
                component="a"
                href={LINKS.github.url}
                target="_blank"
                rel="noopener noreferrer"
                radius={0}
                className="p5-btn text-sm"
              >
                GitHub — WeissSa
              </Button>
            </li>
            <li>
              <Button
                component="a"
                href={LINKS.linkedin.url}
                target="_blank"
                rel="noopener noreferrer"
                radius={0}
                className="p5-btn text-sm"
              >
                LinkedIn — samuelbsweiss
              </Button>
            </li>
          </ul>
        </>
      );
  }
}
