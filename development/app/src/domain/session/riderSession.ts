import { loginRider } from '../riderAuth/riderAuth'
import type { RiderAuthTokenStore } from '../riderAuth/riderAuthTokenStore'
import type { RiderAuthService, RiderAuthTokens } from '../../api/thundercrew/riderAuthClient'

export type RiderSessionDependencies = {
  auth: RiderAuthService
  store: RiderAuthTokenStore
}

export type RiderLoginAndPersistResult =
  | { kind: 'success'; tokens: RiderAuthTokens }
  | { kind: 'invalid_credentials' }
  | { kind: 'error'; message: string }

export type RiderSessionRestoreResult =
  | { kind: 'active'; accessToken: string; tokens: RiderAuthTokens }
  | { kind: 'none' }

/** Logs the rider in and persists the returned tokens on success. */
export async function loginAndPersist(
  deps: RiderSessionDependencies,
  credentials: { phoneNumber: string; name: string },
): Promise<RiderLoginAndPersistResult> {
  const result = await loginRider(credentials, deps.auth)

  if (result.kind !== 'success') {
    return result
  }

  await deps.store.save(result.tokens)
  return { kind: 'success', tokens: result.tokens }
}

/** Restores a previously persisted session, if any (and not expired/invalid). */
export async function restoreSession(store: RiderAuthTokenStore): Promise<RiderSessionRestoreResult> {
  const restored = await store.loadActive()

  if (restored.kind !== 'active') {
    return { kind: 'none' }
  }

  return { kind: 'active', accessToken: restored.tokens.accessToken, tokens: restored.tokens }
}

/** Clears the persisted session (logout). */
export async function logoutSession(store: RiderAuthTokenStore): Promise<void> {
  await store.clear()
}
