/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./public/**/*.html", "./src/**/*.{vue,js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        "desaturated-purple": "#4E4254",
        "desaturated-purple-200": "#BCA7FA",
        "desaturated-blue": "#A6BBED",
      },
    },
  },
  plugins: [],
};
