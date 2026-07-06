import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { loginRider } from './riderAuth'
import { DriverApiHttpError } from '../../api/deliveryServer/driverApiError'
import type { RiderAuthService, RiderAuthTokens } from '../../api/thundercrew/riderAuthClient'

const sampleTokens: RiderAuthTokens = {
  tokenType: 'Bearer',
  accessToken: 'access-abc',
  expiresAt: '2026-08-01T00:00:00.000Z',
  refreshToken: 'refresh-xyz',
  refreshExpiresAt: '2026-09-01T00:00:00.000Z',
  rider: { id: 'rider-1' },
}

function makeService(override?: Partial<RiderAuthService>): RiderAuthService {
  return {
    login: async () => sampleTokens,
    refresh: async () => sampleTokens,
    ...override,
  }
}

describe('loginRider', () => {
  it('returns error when phone is empty', async () => {
    const calls: unknown[] = []
    const service = makeService({ login: async (input) => { calls.push(input); return sampleTokens } })

    const result = await loginRider({ phoneNumber: '', name: '홍길동' }, service)

    assert.equal(result.kind, 'error')
    assert.equal(calls.length, 0, 'service.login should not be called for invalid phone')
  })

  it('returns error when phone is not a valid E.164 string', async () => {
    const calls: unknown[] = []
    const service = makeService({ login: async (input) => { calls.push(input); return sampleTokens } })

    const result = await loginRider({ phoneNumber: 'not-a-phone', name: '홍길동' }, service)

    assert.equal(result.kind, 'error')
    assert.equal(calls.length, 0)
  })

  it('returns error when name is empty', async () => {
    const calls: unknown[] = []
    const service = makeService({ login: async (input) => { calls.push(input); return sampleTokens } })

    const result = await loginRider({ phoneNumber: '+12125550100', name: '' }, service)

    assert.equal(result.kind, 'error')
    if (result.kind === 'error') {
      assert.match(result.message, /name/iu)
    }
    assert.equal(calls.length, 0)
  })

  it('returns error when name is whitespace only', async () => {
    const result = await loginRider({ phoneNumber: '+12125550100', name: '   ' }, makeService())

    assert.equal(result.kind, 'error')
  })

  it('returns success with tokens on valid phone and name', async () => {
    const service = makeService({ login: async () => sampleTokens })

    const result = await loginRider({ phoneNumber: '+12125550100', name: '홍길동' }, service)

    assert.equal(result.kind, 'success')
    if (result.kind === 'success') {
      assert.equal(result.tokens.accessToken, 'access-abc')
    }
  })

  it('passes E.164 phone number and trimmed name through to service.login', async () => {
    const calls: { phoneNumber: string; name: string }[] = []
    const service = makeService({
      login: async (input) => {
        calls.push(input)
        return sampleTokens
      },
    })

    await loginRider({ phoneNumber: '+12125550100', name: '  홍길동  ' }, service)

    assert.equal(calls[0]?.phoneNumber, '+12125550100')
    assert.equal(calls[0]?.name, '홍길동')
  })

  it('returns invalid_credentials when service throws 401 DriverApiHttpError', async () => {
    const service = makeService({
      login: async () => {
        throw new DriverApiHttpError({ endpoint: '/api/v1/rider-auth/login', status: 401 })
      },
    })

    const result = await loginRider({ phoneNumber: '+12125550100', name: '다른이름' }, service)

    assert.equal(result.kind, 'invalid_credentials')
  })

  it('returns error when service throws a non-401 DriverApiHttpError', async () => {
    const service = makeService({
      login: async () => {
        throw new DriverApiHttpError({ endpoint: '/api/v1/rider-auth/login', status: 500 })
      },
    })

    const result = await loginRider({ phoneNumber: '+12125550100', name: '홍길동' }, service)

    assert.equal(result.kind, 'error')
  })

  it('returns error when service throws a generic Error', async () => {
    const service = makeService({
      login: async () => {
        throw new Error('Network error')
      },
    })

    const result = await loginRider({ phoneNumber: '+12125550100', name: '홍길동' }, service)

    assert.equal(result.kind, 'error')
    if (result.kind === 'error') {
      assert.match(result.message, /network error/iu)
    }
  })
})
