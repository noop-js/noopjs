import { defineConfig } from 'vite';
import { noopVite } from '@noopjs/vite';
import { createTailwindResolver } from '@noopjs/compiler';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ command }) => {
  const isSSR = command === 'build' && !!process.env.VITE_SSR_BUILD;
  return {
    plugins: [
      tailwindcss(),
      noopVite({ tokenResolvers: [createTailwindResolver()], extractHandlers: !isSSR }),
    ],
    build: isSSR ? undefined : {
      rollupOptions: {
        input: '/src/main.ts',
        output: {
          entryFileNames: 'assets/main.js',
          assetFileNames: 'assets/[name][extname]',
        },
      },
    },
  };
});
