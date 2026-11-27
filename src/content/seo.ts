/**
 * SEO copy — ported verbatim from pages/_document.tsx of the legacy app.
 * The authoritative copy lives in index.html <head>; these constants are
 * used by the build-time static mirror, sitemap and robots.txt generator.
 */
export const SEO = {
  title: "Sam Weiss's Software Engineering Portfolio",
  description:
    "Sam Weiss is a software engineer. Explore Sam's portfolio, featuring projects and insights on climate change, weather patterns, and environmental data visualization.",
  siteUrl: 'https://weisssa.github.io/portfolio/',
  ogImage: 'https://weisssa.github.io/portfolio/banner.jpg',
} as const;
