This document outlines the plan to completely overhaul the existing personal portfolio website. The project will involve a full-stack technology migration, a design system change, and the addition of new features and functionalities.

Project Goal
To redevelop the personal portfolio website, transforming it from a Vue.js application into a modern, feature-rich Next.js application with a focus on performance, rich animations, and interactive content. The final version will be deployed to GitHub Pages via the deploy.sh script, replacing the current Vue.js site.

Technology Stack
Framework: Next.js (for server-side rendering, static site generation, and optimized performance)

Language: TypeScript (for improved developer experience, type safety, and maintainability)

UI Component Library: Mantine.js (a robust and customizable React component library)

Animation Libraries:

Framer Motion (for declarative, high-fidelity animations and transitions)

Motion One (for performant, lightweight, and custom animations, especially for scroll-based effects and micro-interactions)

Data Source: posts.json (for blog post content)

API Integration: Spotify API (for live listening data and playlist display)

Testing: Jest & React Testing Library (for comprehensive unit and integration testing)

Phase 1: Project Setup and Foundational Changes
Repository Initialization:

Create a new Next.js project with TypeScript support.

Initialize the Git repository.

Transfer the existing posts.json file into the new project's structure (e.g., in a data directory).

Core Technology Installation:

Install Next.js, React, and React DOM.

Install Mantine.js core packages (@mantine/core, @mantine/hooks, etc.).

Install Framer Motion and Motion One.

Install Jest, React Testing Library, and necessary testing-related dependencies (ts-jest, @testing-library/react, etc.).

Set up the tsconfig.json and next.config.js files with appropriate configurations.

Data Migration and Handling:

Create a utility function to read and parse posts.json.

Define a TypeScript interface for blog post data to ensure type safety (e.g., interface Post { title: string; content: string; ... }).

Develop a [slug].tsx page for dynamic blog post routing, using Next.js's getStaticPaths and getStaticProps to generate static pages for each post from the JSON data.

Phase 2: UI/UX and Feature Implementation
Component Development with Mantine:

Recreate all existing pages (e.g., Home, About, Blog, Contact) using Mantine components.

Establish a custom Mantine theme to define the website's color palette, typography, and spacing.

Ensure all components are responsive and follow a mobile-first design approach.

Animation Integration:

Framer Motion:

Implement page transitions using Framer Motion's AnimatePresence.

Add a "stagger" effect to grid layouts (e.g., on the blog posts page) for a more engaging entry animation.

Animate key UI elements on the homepage (e.g., hero text, call-to-action buttons) on page load.

Motion One:

Create scroll-triggered animations for elements that appear as the user scrolls down the page.

Add subtle, performant micro-interactions (e.g., hover effects) to buttons and links.

Spotify API Integration:

Authentication: Set up a secure server-side method to handle Spotify API authentication. This should likely use Next.js's API routes to prevent exposing sensitive client secrets.

"Currently Playing" Widget:

Create a component that fetches the user's "currently playing" track from the Spotify API.

Poll the API periodically to provide a live update.

Display the song title, artist, album art, and a link to the track.

Handle cases where nothing is playing.

Featured Playlist Component:

Add a dedicated section or component to display a specific, hand-picked Spotify playlist. This can be hard-coded with a playlist ID or configurable via a separate data file.

Phase 3: Testing, Deployment, and Maintenance
Testing Strategy:

Write Jest tests for all new components to ensure correct rendering and behavior.

Use React Testing Library to test user interactions and component state changes.

Implement integration tests for the Spotify API fetching logic.

Create Cypress or Playwright E2E tests for critical user flows.

Deployment with GitHub Pages:

Update the package.json with a homepage key pointing to the GitHub Pages URL.

Modify the next.config.js to ensure assets and paths are correctly configured for static export (output: 'export').

Ensure the existing deploy.sh script is compatible with the new project structure (e.g., by targeting the out directory after a build).

Documentation and Cleanup:

Update the main README.md file to reflect the new technology stack and project features.

Remove all old Vue.js code and related dependencies.

Conduct a final code review and performance audit.
