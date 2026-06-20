import { defineConfig } from 'vite';
import { noopVite } from '@noopjs/vite';

export default defineConfig({
  plugins: [
    noopVite(),
  ],
});
