import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

/**
 * DSV(`clever-dsv-web`)의 빌드 구성을 따른다. 차이는 두 가지다.
 *
 * 1. API prefix 가 `/api/v1` — service-ops-api 의 기존 경로를 그대로 쓴다.
 * 2. 인증이 httpOnly 쿠키라서 dev proxy 에도 쿠키가 그대로 흘러야 한다.
 *    `changeOrigin: true` 만 두고 cookieDomainRewrite 는 건드리지 않는다
 *    (같은 오리진으로 프록시되므로 도메인 재작성이 필요 없다).
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  if (env.VITE_TC_API_MODE !== 'mock' && env.VITE_TC_API_MODE !== 'remote') {
    throw new Error('VITE_TC_API_MODE must be explicitly set to "mock" or "remote".');
  }

  const proxy = env.VITE_TC_API_PROXY_TARGET
    ? { '/api': { changeOrigin: true, target: env.VITE_TC_API_PROXY_TARGET } }
    : undefined;

  return {
    build: {
      manifest: true,
      rollupOptions: {
        output: {
          assetFileNames: 'assets/[name]-[hash][extname]',
          chunkFileNames: 'assets/[name]-[hash].js',
          entryFileNames: 'assets/[name]-[hash].js',
          manualChunks(id: string) {
            if (!id.includes('node_modules')) return undefined;
            if (id.includes('/react/') || id.includes('/react-dom/')) return 'react';
            return undefined;
          },
        },
      },
    },
    plugins: [react()],
    preview: { proxy },
    server: { proxy },
  };
});
