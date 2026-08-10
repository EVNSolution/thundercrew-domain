import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * web (Vite SPA) 린트 설정.
 *
 * Next.js 콘솔(`development/frontend`)은 `eslint-config-next` 를 쓰지만 여기는
 * Next 가 아니므로 그 설정을 그대로 가져올 수 없다. 타입 정보를 요구하는 규칙은
 * 켜지 않는다 — `typecheck` 가 이미 tsc 로 같은 일을 하고, 린트에서 한 번 더
 * 프로그램을 만들면 느려질 뿐이다.
 */
export default tseslint.config(
  { ignores: ['dist'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // 미사용 인자는 `_` 접두사로 의도를 드러낸다.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
);
