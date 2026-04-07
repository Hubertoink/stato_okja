/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ENABLE_ORG_MOVE?: string;
}

declare module '*.css' {
  const content: string;
  export default content;
}
