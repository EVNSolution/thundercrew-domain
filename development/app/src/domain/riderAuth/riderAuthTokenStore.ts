import type { SecureTokenStorage } from '../driver/driverAccessTokenStore'
import type { RiderAuthTokens } from '../../api/thundercrew/riderAuthClient'

export const RIDER_AUTH_TOKEN_STORAGE_KEY = 'clever.riderAuth.v1'

export type RiderAuthRestoreResult =
  | { kind: 'active'; tokens: RiderAuthTokens }
  | { kind: 'expired' }
  | { kind: 'missing' }
  | { kind: 'invalid' }

export type RiderAuthTokenStore = {
  save(tokens: RiderAuthTokens): Promise<void>
  loadActive(): Promise<RiderAuthRestoreResult>
  clear(): Promise<void>
}

type StoredRiderAuthPayload = {
  schemaVersion: 1
  savedAt: string
  tokens: RiderAuthTokens
}

export function createRiderAuthTokenStore(input: {
  storage: SecureTokenStorage
  now?: () => Date
}): RiderAuthTokenStore {
  const now = input.now ?? (() => new Date())

  async function clear(): Promise<void> {
    await input.storage.deleteItemAsync(RIDER_AUTH_TOKEN_STORAGE_KEY)
  }

  return {
    clear,

    save: async (tokens) => {
      const payload: StoredRiderAuthPayload = {
        schemaVersion: 1,
        savedAt: now().toISOString(),
        tokens,
      }
      await input.storage.setItemAsync(RIDER_AUTH_TOKEN_STORAGE_KEY, JSON.stringify(payload))
    },

    loadActive: async () => {
      const rawPayload = await input.storage.getItemAsync(RIDER_AUTH_TOKEN_STORAGE_KEY)
      if (rawPayload === null) {
        return { kind: 'missing' }
      }

      const payload = parseStoredPayload(rawPayload)
      if (payload === null) {
        await clear()
        return { kind: 'invalid' }
      }

      const expiresAtMs = Date.parse(payload.tokens.expiresAt)
      if (!Number.isFinite(expiresAtMs) || expiresAtMs <= now().getTime()) {
        await clear()
        return { kind: 'expired' }
      }

      return { kind: 'active', tokens: payload.tokens }
    },
  }
}

function parseStoredPayload(raw: string): StoredRiderAuthPayload | null {
  try {
    const value: unknown = JSON.parse(raw)
    if (!isStoredRiderAuthPayload(value)) {
      return null
    }
    return value
  } catch {
    return null
  }
}

function isStoredRiderAuthPayload(value: unknown): value is StoredRiderAuthPayload {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }

  const obj = value as Record<string, unknown>
  if (obj.schemaVersion !== 1 || typeof obj.savedAt !== 'string') {
    return false
  }

  const tokens = obj.tokens
  if (typeof tokens !== 'object' || tokens === null || Array.isArray(tokens)) {
    return false
  }

  const t = tokens as Record<string, unknown>
  return (
    typeof t.tokenType === 'string' &&
    typeof t.accessToken === 'string' &&
    typeof t.expiresAt === 'string' &&
    typeof t.refreshToken === 'string' &&
    typeof t.refreshExpiresAt === 'string' &&
    t.rider !== undefined
  )
}
