import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// NOTE: We avoid relying on plugin installation at runtime; if missing, vite will error until dependencies are installed.
export default defineConfig({
  plugins: [react()],
});


