import { defineConfig } from 'vite';
import { noopVite } from '@noopjs/vite';
import { createTailwindResolver } from '@noopjs/compiler';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [
    tailwindcss(),
    noopVite({ tokenResolvers: [createTailwindResolver()] }),
  ],
});
