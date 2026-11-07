// src/vite-env.d.ts: no import or export, so these declarations are global.
// They merge with the interfaces of vite/client (the types field of tsconfig.app.json).

interface ViteTypeOptions {
  // import.meta.env allows only the variables declared below
  strictImportMetaEnv: unknown;
}

interface ImportMetaEnv {
  // From .env.development (/api, through the proxy) or .env.production (the public address)
  readonly VITE_API_URL: string;
}
