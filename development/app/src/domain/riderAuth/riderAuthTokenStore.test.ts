import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { createRiderAuthTokenStore } from './riderAuthTokenStore'
import type { SecureTokenStorage } from '../driver/driverAccessTokenStore'
import type { RiderAuthTokens } from '../../api/thundercrew/riderAuthClient'

function makeStorage(): SecureTokenStorage & { data: Record<string, string> } {
  const data: Record<string, string> = {}
  return {
    data,
    getItemAsync: async (key) => data[key] ?? null,
    setItemAsync: async (key, value) => {
      data[key] = value
    },
    deleteItemAsync: async (key) => {
      delete data[key]
    },
  }
}

const futureDate = '2099-01-01T00:00:00.000Z'
const pastDate = '2000-01-01T00:00:00.000Z'

function makeTokens(expiresAt: string): RiderAuthTokens {
  return {
    tokenType: 'Bearer',
    accessToken: 'access-abc',
    expiresAt,
    refreshToken: 'refresh-xyz',
    refreshExpiresAt: futureDate,
    rider: { id: 'rider-1' },
  }
}

describe('createRiderAuthTokenStore', () => {
  describe('save + loadActive', () => {
    it('returns active with saved tokens when expiresAt is in the future', async () => {
      const storage = makeStorage()
      const store = createRiderAuthTokenStore({ storage })

      const tokens = makeTokens(futureDate)
      await store.save(tokens)

      const result = await store.loadActive()

      assert.equal(result.kind, 'active')
      if (result.kind === 'active') {
        assert.equal(result.tokens.accessToken, 'access-abc')
        assert.equal(result.tokens.refreshToken, 'refresh-xyz')
      }
    })

    it('returns expired and clears storage when expiresAt is in the past', async () => {
      const storage = makeStorage()
      const store = createRiderAuthTokenStore({ storage })

      await store.save(makeTokens(pastDate))

      const result = await store.loadActive()

      assert.equal(result.kind, 'expired')
      // storage should have been cleared
      const afterClear = await storage.getItemAsync('clever.riderAuth.v1')
      assert.equal(afterClear, null)
    })

    it('uses injectable now() for expiry check', async () => {
      const storage = makeStorage()
      // Freeze time to a moment before expiresAt
      const frozenNow = new Date('2026-07-31T23:59:59.000Z')
      const store = createRiderAuthTokenStore({ storage, now: () => frozenNow })

      await store.save(makeTokens(futureDate))

      const result = await store.loadActive()
      assert.equal(result.kind, 'active')
    })

    it('returns expired when now() equals expiresAt exactly (boundary: not strictly before)', async () => {
      const storage = makeStorage()
      const expiresAt = '2026-07-01T12:00:00.000Z'
      const store = createRiderAuthTokenStore({
        storage,
        now: () => new Date(expiresAt), // exactly at expiry
      })

      await store.save(makeTokens(expiresAt))

      const result = await store.loadActive()
      assert.equal(result.kind, 'expired')
    })
  })

  describe('loadActive with no stored data', () => {
    it('returns missing when nothing has been saved', async () => {
      const storage = makeStorage()
      const store = createRiderAuthTokenStore({ storage })

      const result = await store.loadActive()
      assert.equal(result.kind, 'missing')
    })
  })

  describe('loadActive with corrupted data', () => {
    it('returns invalid and clears storage on non-JSON content', async () => {
      const storage = makeStorage()
      storage.data['clever.riderAuth.v1'] = 'not valid json'
      const store = createRiderAuthTokenStore({ storage })

      const result = await store.loadActive()
      assert.equal(result.kind, 'invalid')

      const afterClear = await storage.getItemAsync('clever.riderAuth.v1')
      assert.equal(afterClear, null)
    })

    it('returns invalid and clears storage on JSON with wrong schema', async () => {
      const storage = makeStorage()
      storage.data['clever.riderAuth.v1'] = JSON.stringify({ schemaVersion: 2, something: 'else' })
      const store = createRiderAuthTokenStore({ storage })

      const result = await store.loadActive()
      assert.equal(result.kind, 'invalid')
    })

    it('returns invalid when tokens object is missing required fields', async () => {
      const storage = makeStorage()
      storage.data['clever.riderAuth.v1'] = JSON.stringify({
        schemaVersion: 1,
        savedAt: '2026-07-01T00:00:00.000Z',
        tokens: { tokenType: 'Bearer' }, // missing accessToken etc.
      })
      const store = createRiderAuthTokenStore({ storage })

      const result = await store.loadActive()
      assert.equal(result.kind, 'invalid')
    })
  })

  describe('clear', () => {
    it('removes stored tokens so subsequent loadActive returns missing', async () => {
      const storage = makeStorage()
      const store = createRiderAuthTokenStore({ storage })

      await store.save(makeTokens(futureDate))
      await store.clear()

      const result = await store.loadActive()
      assert.equal(result.kind, 'missing')
    })
  })
})
