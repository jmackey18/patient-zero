/// <reference types="vite/client" />

// Public, non-secret settings only. Never put API keys in VITE_* variables (they ship to the browser).
interface ImportMetaEnv {
  readonly VITE_DATA_MODE?: 'mock' | 'live';
  readonly VITE_SPACETIME_URI?: string;
  readonly VITE_SPACETIME_DB?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
