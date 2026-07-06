import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { createRiderAuthService } from './riderAuthClient'
import { DriverApiHttpError } from '../deliveryServer/driverApiError'

const sampleTokens = {
  tokenType: 'Bearer',
  accessToken: 'access-abc',
  expiresAt: '2026-08-01T00:00:00.000Z',
  refreshToken: 'refresh-xyz',
  refreshExpiresAt: '2026-09-01T00:00:00.000Z',
  rider: { id: 'rider-1', name: 'Jane' },
}

function makeOkFetch(body: unknown): typeof fetch {
  return async (_url, _init) =>
    ({
      ok: true,
      status: 200,
      json: async () => body,
    }) as Response
}

function makeErrorFetch(status: number): typeof fetch {
  return async (_url, _init) =>
    ({
      ok: false,
      status,
      json: async () => ({}),
    }) as Response
}

describe('createRiderAuthService', () => {
  describe('login', () => {
    it('sends POST to /api/v1/rider-auth/login with correct URL, method, headers, and body', async () => {
      const requests: { url: string; method: string; headers: Record<string, string>; body: string }[] = []

      const service = createRiderAuthService({
        baseUrl: 'https://tc.example.com',
        fetchImpl: async (url, init) => {
          requests.push({
            url: String(url),
            method: String(init?.method),
            headers: (init?.headers as Record<string, string>) ?? {},
            body: String(init?.body),
          })
          return {
            ok: true,
            status: 200,
            json: async () => sampleTokens,
          } as Response
        },
      })

      await service.login({ phoneNumber: '+12125550100', name: '홍길동' })

      assert.equal(requests.length, 1)
      assert.equal(requests[0]?.url, 'https://tc.example.com/api/v1/rider-auth/login')
      assert.equal(requests[0]?.method, 'POST')
      assert.equal(requests[0]?.headers['Content-Type'], 'application/json')
      assert.deepEqual(JSON.parse(requests[0]?.body ?? '{}'), {
        phoneNumber: '+12125550100',
        name: '홍길동',
      })
    })

    it('maps a 200 response body to RiderAuthTokens fields', async () => {
      const service = createRiderAuthService({
        baseUrl: 'https://tc.example.com',
        fetchImpl: makeOkFetch(sampleTokens),
      })

      const tokens = await service.login({ phoneNumber: '+12125550100', name: '홍길동' })

      assert.equal(tokens.tokenType, 'Bearer')
      assert.equal(tokens.accessToken, 'access-abc')
      assert.equal(tokens.expiresAt, '2026-08-01T00:00:00.000Z')
      assert.equal(tokens.refreshToken, 'refresh-xyz')
      assert.equal(tokens.refreshExpiresAt, '2026-09-01T00:00:00.000Z')
      assert.deepEqual(tokens.rider, { id: 'rider-1', name: 'Jane' })
    })

    it('throws DriverApiHttpError with status 401 on 401 response', async () => {
      const service = createRiderAuthService({
        baseUrl: 'https://tc.example.com',
        fetchImpl: makeErrorFetch(401),
      })

      await assert.rejects(
        () => service.login({ phoneNumber: '+12125550100', name: '다른이름' }),
        (err: unknown) => {
          assert.ok(err instanceof DriverApiHttpError)
          assert.equal(err.status, 401)
          return true
        },
      )
    })

    it('throws DriverApiHttpError on non-2xx response', async () => {
      const service = createRiderAuthService({
        baseUrl: 'https://tc.example.com',
        fetchImpl: makeErrorFetch(500),
      })

      await assert.rejects(
        () => service.login({ phoneNumber: '+12125550100', name: '홍길동' }),
        (err: unknown) => {
          assert.ok(err instanceof DriverApiHttpError)
          assert.equal(err.status, 500)
          return true
        },
      )
    })

    it('throws DriverApiHttpError on malformed body (missing required field)', async () => {
      const service = createRiderAuthService({
        baseUrl: 'https://tc.example.com',
        fetchImpl: makeOkFetch({ tokenType: 'Bearer', accessToken: 'x' }), // missing fields
      })

      await assert.rejects(
        () => service.login({ phoneNumber: '+12125550100', name: '홍길동' }),
        (err: unknown) => {
          assert.ok(err instanceof DriverApiHttpError)
          return true
        },
      )
    })

    it('strips trailing slash from baseUrl', async () => {
      const requests: string[] = []
      const service = createRiderAuthService({
        baseUrl: 'https://tc.example.com/',
        fetchImpl: async (url) => {
          requests.push(String(url))
          return { ok: true, status: 200, json: async () => sampleTokens } as Response
        },
      })

      await service.login({ phoneNumber: '+12125550100', name: '홍길동' })
      assert.equal(requests[0], 'https://tc.example.com/api/v1/rider-auth/login')
    })
  })

  describe('refresh', () => {
    it('sends POST to /api/v1/rider-auth/refresh with refreshToken in body', async () => {
      const requests: { url: string; body: string }[] = []

      const service = createRiderAuthService({
        baseUrl: 'https://tc.example.com',
        fetchImpl: async (url, init) => {
          requests.push({ url: String(url), body: String(init?.body) })
          return { ok: true, status: 200, json: async () => sampleTokens } as Response
        },
      })

      await service.refresh({ refreshToken: 'refresh-xyz' })

      assert.equal(requests[0]?.url, 'https://tc.example.com/api/v1/rider-auth/refresh')
      assert.deepEqual(JSON.parse(requests[0]?.body ?? '{}'), { refreshToken: 'refresh-xyz' })
    })

    it('returns mapped tokens on success', async () => {
      const service = createRiderAuthService({
        baseUrl: 'https://tc.example.com',
        fetchImpl: makeOkFetch(sampleTokens),
      })

      const tokens = await service.refresh({ refreshToken: 'refresh-xyz' })
      assert.equal(tokens.accessToken, 'access-abc')
    })

    it('throws DriverApiHttpError with status 401 on 401', async () => {
      const service = createRiderAuthService({
        baseUrl: 'https://tc.example.com',
        fetchImpl: makeErrorFetch(401),
      })

      await assert.rejects(
        () => service.refresh({ refreshToken: 'bad' }),
        (err: unknown) => {
          assert.ok(err instanceof DriverApiHttpError)
          assert.equal(err.status, 401)
          return true
        },
      )
    })
  })
})
