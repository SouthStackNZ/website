// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://southstack.co.nz',
  output: 'static',
  build: { format: 'file' },
  vite: { plugins: [tailwindcss()] },
});
