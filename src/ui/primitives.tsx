import type { HTMLAttributes, ReactNode } from 'react';
import { Badge, Paper } from '@mantine/core';

/** Resolve a public/ asset against the Vite base ('/portfolio/'). */
export const assetUrl = (file: string): string =>
  `${import.meta.env.BASE_URL}${file.replace(/^\//, '')}`;

export function P5Panel({
  variant = 'ink',
  slashed = false,
  className = '',
  children,
  ...rest
}: {
  variant?: 'ink' | 'red' | 'white';
  slashed?: boolean;
  children: ReactNode;
} & HTMLAttributes<HTMLDivElement>) {
  const variantClass =
    variant === 'red'
      ? 'p5-panel--red'
      : variant === 'white'
        ? 'p5-panel--white'
        : '';
  // Mantine Paper underneath; the unlayered p5-panel CSS keeps the diegetic
  // jagged clip-path motifs authoritative over Mantine's layered defaults.
  return (
    <Paper
      radius={0}
      className={`p5-panel ${variantClass} ${slashed ? 'p5-panel--slashed' : ''} ${className}`.trim()}
      {...rest}
    >
      {children}
    </Paper>
  );
}

export function DisplayTitle({
  level = 2,
  className = '',
  children,
}: {
  level?: 1 | 2 | 3;
  className?: string;
  children: ReactNode;
}) {
  // Explicit tag map: no string→JSX-tag cast needed, and TypeScript checks the
  // level is one of the three supported headings.
  const HEADING_TAGS = { 1: 'h1', 2: 'h2', 3: 'h3' } as const;
  const Tag = HEADING_TAGS[level];
  return (
    <Tag className={`p5-display text-2xl md:text-3xl ${className}`.trim()}>
      {children}
    </Tag>
  );
}

export function TagChip({ tag }: { tag: string }) {
  return (
    <Badge component="li" radius={0} className="p5-tag">
      {tag}
    </Badge>
  );
}

export function StarMark({ label = 'Featured' }: { label?: string }) {
  return (
    <span className="p5-star">
      <span aria-hidden="true">★</span>
      <span className="sr-only"> {label}</span>
    </span>
  );
}

export function GitHubIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      className={`h-6 w-6 fill-current ${className}`}
      focusable="false"
    >
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}

export function LinkedInIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      className={`h-6 w-6 fill-current ${className}`}
      focusable="false"
    >
      <path d="M0 1.15C0 .52.53 0 1.18 0h13.64C15.47 0 16 .52 16 1.15v13.7c0 .63-.53 1.15-1.18 1.15H1.18A1.16 1.16 0 0 1 0 14.85V1.15Zm4.94 12.24V6.17H2.54v7.22h2.4ZM3.74 5.18c.84 0 1.36-.56 1.36-1.26-.02-.71-.52-1.26-1.34-1.26-.82 0-1.36.55-1.36 1.26 0 .7.52 1.26 1.33 1.26h.01Zm9.66 8.21V9.5c0-2.15-1.15-3.15-2.68-3.15-1.24 0-1.79.68-2.1 1.16V6.17H6.22c.03.68 0 7.22 0 7.22h2.4V9.36c0-.24.02-.48.09-.65.19-.48.63-.97 1.37-.97.96 0 1.35.74 1.35 1.81v3.84h2.37Z" />
    </svg>
  );
}
