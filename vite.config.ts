import { defineConfig, UserConfig } from 'vite';
import react from '@vitejs/plugin-react';

// NOTE: We avoid relying on plugin installation at runtime; if missing, vite will error until dependencies are installed.
export default defineConfig(({ mode }): UserConfig => {
  const isWpBuild = process.env.WP_BUILD === '1';

  if (isWpBuild) {
    // WordPress plugin build: no base path, emit manifest, and output into the plugin assets dir
    return {
      plugins: [react()],
      base: '',
      build: {
        manifest: true,
        outDir: 'wp-plugin/simspace/assets',
        emptyOutDir: false,
      },
    };
  }

  // Default build for GitHub Pages project site: https://<user>.github.io/SimSpace/
  return {
    plugins: [react()],
    base: '/SimSpace/',
  };
});


