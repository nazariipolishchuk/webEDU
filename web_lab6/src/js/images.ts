// js/images.ts: scan images live in src/assets/img. Vite turns this pattern into a hashed URL in the build.
import type { Modality } from "./types.ts";

export const scanImage = (key: Modality): string =>
  new URL(`../assets/img/${key}.webp`, import.meta.url).href;
