import fs from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Inlines a sheep from the Figma export into index.html for the boot loader,
// so something friendly shows before the JavaScript arrives.
const bootSheep = () => ({
  name: 'boot-sheep',
  transformIndexHtml: (html) => html.replace('<!-- boot-sheep -->', fs.readFileSync('src/assets/art/sheep-3.svg', 'utf8')),
});

export default defineConfig({
  plugins: [react(), bootSheep()],
});
