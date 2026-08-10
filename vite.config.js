import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

const repoName = 'tomato-app';

export default defineConfig({
  plugins: [vue()],
  base: process.env.GITHUB_ACTIONS ? `/tomato-app/` : '/',
  server: {
    host: '0.0.0.0',
    port: 3000,
  },
});
