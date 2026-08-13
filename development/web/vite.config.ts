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

  /**
   * 어떤 모드로 빌드됐는지 산출물에 남긴다.
   *
   * 번들 JS 로는 판별할 수 없다 — `'mock'` 과 `'remote'` 가 비교 리터럴로 둘 다
   * 들어가기 때문이다. 모드가 조용히 어긋나면 QA 는 로그인 화면만 보고 원인을
   * 찾지 못한다. 배포 파이프라인과 브라우저 양쪽에서 확인할 수 있어야 한다.
   */
  const stampMode = {
    name: 'tc-stamp-api-mode',
    transformIndexHtml() {
      return [
        {
          tag: 'meta',
          attrs: { name: 'tc-api-mode', content: env.VITE_TC_API_MODE },
          injectTo: 'head' as const,
        },
      ];
    },
  };

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
    plugins: [react(), stampMode],
    preview: { proxy },
    server: { proxy },
  };
});
