import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      external: ['@supabase/supabase-js'],
      output: {
        globals: {
          '@supabase/supabase-js': 'supabase'
        }
      }
    }
  },
  optimizeDeps: {
    exclude: ['@supabase/supabase-js']
  }
})