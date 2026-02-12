
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    // هذا يسمح للكود باستخدام process.env.API_KEY كما في الكود الحالي
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY || '')
  }
});
