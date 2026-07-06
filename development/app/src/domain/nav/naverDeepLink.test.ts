import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { buildNaverRouteUrl, buildNaverRouteWebUrl } from './naverDeepLink'

describe('buildNaverRouteUrl', () => {
  it('builds an nmap:// route URL from coordinates and a name', () => {
    const url = buildNaverRouteUrl({ latitude: 37.5, longitude: 127.0, name: '고객' })

    assert.match(url, /^nmap:\/\//u)
    assert.ok(url.includes('37.5'))
    assert.ok(url.includes('127'))
  })

  it('url-encodes the destination name', () => {
    const url = buildNaverRouteUrl({ latitude: 37.5, longitude: 127.0, name: '고객 이름' })

    assert.ok(url.includes(encodeURIComponent('고객 이름')))
  })

  it('includes an appname query param', () => {
    const url = buildNaverRouteUrl({ latitude: 37.5, longitude: 127.0, name: 'x' })

    assert.ok(url.includes('appname='))
  })
})

describe('buildNaverRouteWebUrl', () => {
  it('builds a map.naver.com fallback URL from coordinates', () => {
    const url = buildNaverRouteWebUrl({ latitude: 37.5, longitude: 127.0 })

    assert.match(url, /^https:\/\/map\.naver\.com\//u)
    assert.ok(url.includes('127'))
    assert.ok(url.includes('37.5'))
  })
})
