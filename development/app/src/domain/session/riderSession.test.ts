import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { loginAndPersist, logoutSession, restoreSession } from './riderSession'
import type { RiderAuthService, RiderAuthTokens } from '../../api/thundercrew/riderAuthClient'
import type { RiderAuthTokenStore } from '../riderAuth/riderAuthTokenStore'

const sampleTokens: RiderAuthTokens = {
  tokenType: 'Bearer',
  accessToken: 'access-abc',
  expiresAt: '2099-01-01T00:00:00.000Z',
  refreshToken: 'refresh-xyz',
  refreshExpiresAt: '2099-06-01T00:00:00.000Z',
  rider: { id: 'rider-1' },
}

function makeAuth(override?: Partial<RiderAuthService>): RiderAuthService {
  return {
    login: async () => sampleTokens,
    refresh: async () => sampleTokens,
    ...override,
  }
}

function makeStore(): RiderAuthTokenStore & { saved: RiderAuthTokens[] } {
  const saved: RiderAuthTokens[] = []
  let current: RiderAuthTokens | null = null
  return {
    saved,
    save: async (tokens) => {
      current = tokens
      saved.push(tokens)
    },
    loadActive: async () => (current ? { kind: 'active', tokens: current } : { kind: 'missing' }),
    clear: async () => {
      current = null
    },
  }
}

describe('loginAndPersist', () => {
  it('logs in and persists the tokens on success', async () => {
    const auth = makeAuth()
    const store = makeStore()

    const result = await loginAndPersist({ auth, store }, { phoneNumber: '+821012345678', password: 'pw' })

    assert.equal(result.kind, 'success')
    if (result.kind === 'success') {
      assert.equal(result.tokens.accessToken, 'access-abc')
    }
    assert.equal(store.saved.length, 1)
    assert.equal(store.saved[0]?.accessToken, 'access-abc')
  })

  it('does not persist tokens when login fails with invalid credentials', async () => {
    const auth = makeAuth({
      login: async () => {
        throw Object.assign(new Error('unauthorized'), { status: 401 })
      },
    })
    const store = makeStore()

    const result = await loginAndPersist({ auth, store }, { phoneNumber: '+821012345678', password: 'wrong' })

    assert.equal(result.kind, 'error')
    assert.equal(store.saved.length, 0)
  })

  it('returns error without persisting when phone number is invalid', async () => {
    const auth = makeAuth()
    const store = makeStore()

    const result = await loginAndPersist({ auth, store }, { phoneNumber: '', password: 'pw' })

    assert.equal(result.kind, 'error')
    assert.equal(store.saved.length, 0)
  })
})

describe('restoreSession', () => {
  it('returns the active accessToken when a session is stored', async () => {
    const store = makeStore()
    await store.save(sampleTokens)

    const result = await restoreSession(store)

    assert.equal(result.kind, 'active')
    if (result.kind === 'active') {
      assert.equal(result.accessToken, 'access-abc')
    }
  })

  it('returns none when nothing is stored', async () => {
    const store = makeStore()

    const result = await restoreSession(store)

    assert.equal(result.kind, 'none')
  })
})

describe('logoutSession', () => {
  it('clears the store so a subsequent restore returns none', async () => {
    const store = makeStore()
    await store.save(sampleTokens)

    await logoutSession(store)
    const result = await restoreSession(store)

    assert.equal(result.kind, 'none')
  })
})
