// eslint-disable-next-line @typescript-eslint/no-require-imports -- CJS config cannot import ESM/TS.
const { p5 } = require('./src/styles/design-tokens.json');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}', './scripts/**/*.ts'],
  theme: {
    extend: {
      colors: {
        p5: {
          black: p5.black,
          ink: p5.ink,
          red: p5.red,
          'red-deep': p5.redDeep,
          white: p5.white,
          yellow: p5.yellow,
        },
      },
      fontFamily: {
        display: ['Anton', 'Arial Narrow', 'Haettenschweiler', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
