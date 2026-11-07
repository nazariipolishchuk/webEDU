import { resolve } from 'node:path';
import { defineConfig, loadEnv } from 'vite';

const src = resolve(import.meta.dirname, 'src');

// Every HTML page of the site is an entry point of the build
const pages = ['index', 'api', 'network', 'tasks', 'strict'] as const;

export default defineConfig(({ mode }) => {
  const isProd = mode === 'production';
  // '' lifts the VITE_ filter: API_TARGET is read here in Node.js and never reaches the page
  const env = loadEnv(mode, import.meta.dirname, '');

  return {
    root: 'src',
    base: './', // relative links, the built site works from any folder
    envDir: '..', // .env files lie next to this config, not in src
    resolve: {
      alias: { '@': src },
    },
    css: {
      devSourcemap: true, // the developer tools show lines of the .scss files
    },
    server: {
      port: 5173,
      strictPort: true,
      open: '/index.html',
      proxy: {
        // /api/posts -> https://jsonplaceholder.typicode.com/posts: same origin for the page, no CORS.
        // The key ends with a slash: '/api' alone is a prefix of /api.html, the page itself.
        '/api/': {
          target: env.API_TARGET ?? 'https://jsonplaceholder.typicode.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
      },
    },
    preview: {
      port: 4173,
      strictPort: true,
    },
    build: {
      // npm run build:dev keeps a readable copy next to the production one
      outDir: isProd ? '../dist' : '../dist-dev',
      emptyOutDir: true,
      sourcemap: isProd ? true : 'inline', // separate .map files or maps inside the files
      minify: isProd,
      cssMinify: isProd,
      assetsInlineLimit: 4096, // smaller files become data URIs
      chunkSizeWarningLimit: 500,
      rolldownOptions: {
        input: Object.fromEntries(pages.map((page) => [page, resolve(src, `${page}.html`)])),
        onwarn(warning, warn) {
          // strict-on.ts calls eval on purpose: it shows that strict mode keeps eval variables inside
          if (warning.code === 'EVAL' && warning.id?.endsWith('strict-on.ts')) return;
          warn(warning);
        },
        // Content hashes in the names only in production, for long caching
        output: isProd
          ? {}
          : {
              entryFileNames: 'assets/[name].js',
              chunkFileNames: 'assets/[name].js',
              assetFileNames: 'assets/[name][extname]',
            },
      },
    },
  };
});
