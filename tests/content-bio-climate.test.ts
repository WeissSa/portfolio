import { describe, expect, it } from 'vitest';
import {
  BIO_PARAGRAPH,
  CLIMATE_ATTRIBUTION,
  CLIMATE_LOCATION,
  CLIMATE_STATEMENT,
  HEADLINE,
  HEATMAP_LEGEND,
  LINKS,
  NOW_EXCERPTS,
  SEO,
} from '../src/content/index';

describe('bio content', () => {
  it('carries the verified headline', () => {
    expect(HEADLINE).toBe('SWE @ Gusto | HBSc in CS from UofT');
  });

  it('ports the welcome bio verbatim (spot checks)', () => {
    expect(BIO_PARAGRAPH).toContain(
      "I'm Sam, a Software Engineer with a Computer Science specialist and Math minor from the University of Toronto.",
    );
    expect(BIO_PARAGRAPH).toContain(
      'I am also learning Japanese in my free time.',
    );
  });

  it('derives Now copy from the Gusto post only', () => {
    expect(NOW_EXCERPTS).toHaveLength(2);
    expect(NOW_EXCERPTS[0]).toContain('Time Off team');
    expect(NOW_EXCERPTS[1]).toContain('AI tools');
  });
});

describe('climate content', () => {
  it('uses the exact Toronto coordinates from the legacy hook', () => {
    expect(CLIMATE_LOCATION).toEqual({
      latitude: 43.6532,
      longitude: -79.3832,
      name: 'Toronto, Canada',
    });
  });

  it('ports the statement verbatim (spot checks)', () => {
    expect(CLIMATE_STATEMENT).toContain(
      'For almost 10 years I have reduced my consumption of fossil fuels',
    );
    expect(CLIMATE_STATEMENT).toContain(
      'sustainability and resilience in our communities.',
    );
  });

  it('keeps all seven legend entries verbatim', () => {
    expect(HEATMAP_LEGEND).toEqual([
      'Hottest day on record',
      '>5°C Hotter',
      '>2°C Hotter',
      'Normal',
      '< -2°C Colder',
      '< -5°C Colder',
      'No Data',
    ]);
  });

  it('keeps attribution links verbatim', () => {
    expect(CLIMATE_ATTRIBUTION.openMeteo.url).toBe('https://open-meteo.com/');
    expect(CLIMATE_ATTRIBUTION.climateDefenseFund.url).toBe(
      'https://www.climatesolutions.ca/climate-defense-fund-ontario',
    );
  });
});

describe('links & seo', () => {
  it('exposes GitHub and LinkedIn only', () => {
    expect(Object.keys(LINKS).sort()).toEqual(['github', 'linkedin']);
    expect(LINKS.github.url).toBe('https://github.com/WeissSa');
    expect(LINKS.linkedin.url).toBe('https://linkedin.com/in/samuelbsweiss');
  });

  it('matches the legacy SEO title and description', () => {
    expect(SEO.title).toBe("Sam Weiss's Software Engineering Portfolio");
    expect(SEO.description).toContain(
      'insights on climate change, weather patterns, and environmental data visualization.',
    );
    expect(SEO.siteUrl).toBe('https://weisssa.github.io/portfolio/');
  });
});
