/// <reference types="vite/client" />

declare const __APP_ENV__: string;
declare const __UPDATE_TARGET__: string;

interface ImportMetaEnv {
  readonly VITE_APP_ENV?: string;
  readonly VITE_MAL_CLIENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
