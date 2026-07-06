import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { createAuthService, createDispatchService, readRiderRuntimeConfig } from './riderRuntimeConfig'

describe('readRiderRuntimeConfig', () => {
  it('returns mock mode when the thundercrew base URL is missing', () => {
    assert.deepEqual(readRiderRuntimeConfig({}), { mode: 'mock' })
  })

  it('returns live mode with baseUrl when the thundercrew base URL is set', () => {
    assert.deepEqual(
      readRiderRuntimeConfig({ EXPO_PUBLIC_THUNDERCREW_SERVICE_OPS_BASE_URL: 'https://api.example' }),
      { mode: 'live', thundercrewBaseUrl: 'https://api.example' },
    )
  })

  it('returns mock mode when the thundercrew base URL is whitespace only', () => {
    assert.deepEqual(readRiderRuntimeConfig({ EXPO_PUBLIC_THUNDERCREW_SERVICE_OPS_BASE_URL: '  ' }), { mode: 'mock' })
  })
})

describe('createAuthService', () => {
  it('returns null in mock mode', () => {
    assert.equal(createAuthService({ mode: 'mock' }), null)
  })

  it('returns an auth service in live mode', () => {
    const service = createAuthService({ mode: 'live', thundercrewBaseUrl: 'https://api.example' })
    assert.notEqual(service, null)
  })
})

describe('createDispatchService', () => {
  it('returns null in mock mode', () => {
    assert.equal(createDispatchService({ mode: 'mock' }, 'token'), null)
  })

  it('returns a dispatch service in live mode', () => {
    const service = createDispatchService({ mode: 'live', thundercrewBaseUrl: 'https://api.example' }, 'token')
    assert.notEqual(service, null)
  })
})
