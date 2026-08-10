import { apiConfig, apiFetch, ApiError } from './api/config';
import { isModeId, type ModeId } from './app-modes';

/**
 * 관리자 세션.
 *
 * 토큰은 httpOnly 쿠키에 있고 JS 가 읽지 않는다. 그래서 "로그인했는가"는
 * 저장된 토큰을 확인하는 대신 백엔드에 물어본다. 401 이면 미로그인이다.
 */

export interface Principal {
  readonly id: string;
  readonly name: string;
}

const MODE_STORAGE_KEY = 'thundercrew.mode';

export async function probeSession(): Promise<Principal | null> {
  if (apiConfig.mode === 'mock') {
    return { id: 'mock-admin', name: '목업 관리자' };
  }
  try {
    return await apiFetch<Principal>('/auth/me');
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
}

export async function login(email: string, password: string): Promise<Principal> {
  if (apiConfig.mode === 'mock') {
    return { id: 'mock-admin', name: email || '목업 관리자' };
  }
  return apiFetch<Principal>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function logout(): Promise<void> {
  if (apiConfig.mode === 'remote') {
    try {
      await apiFetch<void>('/auth/logout', { method: 'POST' });
    } catch {
      // 백엔드 호출이 실패해도 클라이언트 상태는 정리한다.
    }
  }
  clearStoredMode();
}

/**
 * 고른 모드는 세션 동안 유지한다. 토큰이 아니라 화면 선택값이므로
 * 브라우저 저장소에 두어도 무방하다.
 */
export function readStoredMode(): ModeId | null {
  try {
    const value = window.sessionStorage.getItem(MODE_STORAGE_KEY);
    return isModeId(value) ? value : null;
  } catch {
    return null;
  }
}

export function storeMode(mode: ModeId): void {
  try {
    window.sessionStorage.setItem(MODE_STORAGE_KEY, mode);
  } catch {
    // 저장 실패는 무시한다. 모드는 매번 다시 고를 수 있다.
  }
}

export function clearStoredMode(): void {
  try {
    window.sessionStorage.removeItem(MODE_STORAGE_KEY);
  } catch {
    // 무시
  }
}
