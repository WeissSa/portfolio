/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}', './scripts/**/*.ts'],
  theme: {
    extend: {
      colors: {
        p5: {
          black: '#0a0a0a',
          ink: '#16161a',
          red: '#ff2a1a',
          'red-deep': '#c81e10',
          white: '#ffffff',
          yellow: '#ffd400',
        },
      },
      fontFamily: {
        display: ['Anton', 'Arial Narrow', 'Haettenschweiler', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
