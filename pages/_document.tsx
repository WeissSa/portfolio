import { Head, Html, Main, NextScript } from 'next/document';
import { ColorSchemeScript, mantineHtmlProps } from '@mantine/core';

export default function Document() {
  return (
    <Html lang="en" {...mantineHtmlProps}>
      <Head>
        <title>Sam Weiss{"'"}s Software Engineering Portfolio</title>
        <meta
          name="description"
          content="Sam Weiss is a software engineer. Explore Sam's portfolio, featuring projects and insights on climate change, weather patterns, and environmental data visualization."
        />
        <meta
          name="keywords"
          content="Sam Weiss, Samuel Weiss, software engineer, portfolio, climate change, weather, data visualization, environmental, Toronto, historical weather"
        />
        <meta name="author" content="Sam Weiss" />
        <meta
          property="og:title"
          content="Sam Weiss's Software Engineering Portfolio"
        />
        <meta
          property="og:description"
          content="Sam Weiss is a software engineer. Explore Sam's portfolio, featuring projects and insights on climate change, weather patterns, and environmental data visualization."
        />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://weisssa.github.io/portfolio" />
        <meta
          property="og:image"
          content="https://weisssa.github.io/portfolio/banner.jpg"
        />
        <ColorSchemeScript defaultColorScheme="dark" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
