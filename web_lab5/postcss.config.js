// Vite runs PostCSS after Sass. Autoprefixer adds vendor prefixes for the browsers
// of the browserslist field in package.json and drops the ones no browser there needs.
export default {
  plugins: {
    autoprefixer: {},
  },
};
