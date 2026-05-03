import { defineConfig } from 'vite';
import { resolve } from 'path';
import javascriptObfuscator from 'vite-plugin-javascript-obfuscator';

export default defineConfig({
  root: './',
  base: './', // 상대 경로 베이스 설정
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        login: resolve(__dirname, 'login.html'),
        signup: resolve(__dirname, 'signup.html'),
        dashboard: resolve(__dirname, 'app/dashboard.html'),
        // ... (나머지 경로는 이전과 동일하게 유지)
      }
    }
  },
  // 모듈 속성이 없는 스크립트들도 강제로 처리되도록 설정
  optimizeDeps: {
    disabled: true 
  }
});