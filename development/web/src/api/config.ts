export type ApiMode = 'mock' | 'remote';

function resolveApiMode(value: string | undefined): ApiMode {
  if (value === 'mock' || value === 'remote') return value;
  throw new Error('VITE_TC_API_MODE must be explicitly set to "mock" or "remote".');
}

function normalizeBaseUrl(value: string): string {
  const normalized = value.trim().replace(/\/+$/, '');
  return normalized || '/api/v1';
}

export const apiConfig = {
  mode: resolveApiMode(import.meta.env.VITE_TC_API_MODE),
  baseUrl: normalizeBaseUrl(import.meta.env.VITE_TC_API_BASE_URL ?? '/api/v1'),
};

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * service-ops-api 호출.
 *
 * 인증은 httpOnly 쿠키다. DSV 는 sessionStorage 에 access token 을 두지만
 * 썬더크루는 토큰을 브라우저 저장소·URL·rendered HTML 에 두지 않는 규칙을
 * 유지한다. 그래서 SPA 로 바뀌어도 토큰을 JS 가 읽지 않고, 쿠키가 같은
 * 오리진으로 자동 전송되도록 `credentials: 'include'` 만 붙인다.
 * nginx 가 `/api` 를 백엔드로 프록시하는 것을 전제한다.
 *
 * remote 요청 실패를 mock 데이터로 대체하지 않는다.
 */
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiConfig.baseUrl}${path}`, {
    ...init,
    credentials: 'include',
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  });

  if (!response.ok) {
    let detail = `${response.status} ${response.statusText}`;
    try {
      const body = (await response.json()) as { message?: string };
      if (body?.message) detail = body.message;
    } catch {
      // 본문이 JSON 이 아니면 status 문자열을 그대로 쓴다.
    }
    throw new ApiError(response.status, detail);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
