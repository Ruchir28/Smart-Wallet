import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'


// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), nodePolyfills()],
  server: {
    headers: {
      'Content-Security-Policy': "frame-src 'self' https://oauth.telegram.org;",
    }
  },
  resolve: {
    alias: {
      crypto: 'crypto-browserify',
    },
  },

})
