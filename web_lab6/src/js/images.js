// js/images.js: scan images live in src/assets/img. Vite turns this pattern into a hashed URL in the build.
export const scanImage = (key) => new URL(`../assets/img/${key}.webp`, import.meta.url).href;
