/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./public/**/*.html", "./src/**/*.{vue,js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        "desaturated-purple": "#7D6FA6",
        "desaturated-purple-200": "#BCA7FA",
      },
    },
  },
  plugins: [],
};
