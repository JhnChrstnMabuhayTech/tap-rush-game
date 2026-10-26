import basicSsl from '@vitejs/plugin-basic-ssl';
import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => ({
  // Facebook serves the bundle from a path on its own CDN, so asset URLs must be relative.
  base: './',
  // `pnpm dev:fb` serves over HTTPS with a self-signed certificate, which
  // Facebook's embedded test player needs to load a local build.
  plugins: mode === 'fb' ? [basicSsl()] : [],
  build: {
    target: 'es2022',
    // Source maps would ship inside the upload; Meta asks for bundles without them.
    sourcemap: false,
  },
}));
