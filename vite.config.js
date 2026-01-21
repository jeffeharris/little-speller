import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [sveltekit()],
  server: {
    host: '0.0.0.0',
    allowedHosts: true,  // Allow all hosts (for docker/network access)
    watch: {
      usePolling: true,  // Required for Docker volume mounts
      interval: 1000
    }
  }
});
