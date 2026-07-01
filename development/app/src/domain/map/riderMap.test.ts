import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { loadRiderMapData, type RiderMapService, type RiderStation, type RiderTip } from './riderMap'
import { DriverApiHttpError } from '../../api/deliveryServer/driverApiError'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeTip(overrides: Partial<RiderTip> = {}): RiderTip {
  return {
    id: 'tip-1',
    idx: 1,
    address: '서울 강남구 테헤란로 123',
    content: '주차 팁: 후면 주차장 이용',
    latitude: 37.5012,
    longitude: 127.0396,
    status: 'PUBLISHED',
    submittedByRiderId: 'rider-1',
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
    ...overrides,
  }
}

function makeStation(overrides: Partial<RiderStation> = {}): RiderStation {
  return {
    id: 'station-1',
    idx: 1,
    name: '강남역 충전소',
    address: '서울 강남구 강남대로 1',
    latitude: 37.4979,
    longitude: 127.0276,
    status: 'ACTIVE',
    maxBatteryCapacity: 10,
    currentBatteryCount: 8,
    availableBatteryCount: 5,
    availableBatteryLabel: '5개 사용 가능',
    capacityPercentage: 80,
    memo: '',
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
    ...overrides,
  }
}

function makeService(override: Partial<RiderMapService> = {}): RiderMapService {
  return {
    getTips: async () => [],
    getStations: async () => [],
    ...override,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('loadRiderMapData', () => {
  it('returns loaded with tips and stations on success', async () => {
    const tips = [makeTip({ id: 'tip-1' })]
    const stations = [makeStation({ id: 'station-1' })]

    const service = makeService({
      getTips: async () => tips,
      getStations: async () => stations,
    })

    const result = await loadRiderMapData(service)

    assert.equal(result.kind, 'loaded')
    if (result.kind === 'loaded') {
      assert.equal(result.tips.length, 1)
      assert.equal(result.tips[0]?.id, 'tip-1')
      assert.equal(result.stations.length, 1)
      assert.equal(result.stations[0]?.id, 'station-1')
    }
  })

  it('returns loaded with empty lists when both endpoints return empty arrays', async () => {
    const service = makeService()
    const result = await loadRiderMapData(service)

    assert.equal(result.kind, 'loaded')
    if (result.kind === 'loaded') {
      assert.equal(result.tips.length, 0)
      assert.equal(result.stations.length, 0)
    }
  })

  it('returns unauthorized when getTips throws a 401 DriverApiHttpError', async () => {
    const service = makeService({
      getTips: async () => {
        throw new DriverApiHttpError({ endpoint: '/api/v1/rider/me/tips', status: 401 })
      },
    })

    const result = await loadRiderMapData(service)
    assert.equal(result.kind, 'unauthorized')
  })

  it('returns unauthorized when getStations throws a 401 DriverApiHttpError', async () => {
    const service = makeService({
      getStations: async () => {
        throw new DriverApiHttpError({ endpoint: '/api/v1/rider/me/stations', status: 401 })
      },
    })

    const result = await loadRiderMapData(service)
    assert.equal(result.kind, 'unauthorized')
  })

  it('returns error with message on non-401 DriverApiHttpError from getTips', async () => {
    const service = makeService({
      getTips: async () => {
        throw new DriverApiHttpError({ endpoint: '/api/v1/rider/me/tips', status: 500 })
      },
    })

    const result = await loadRiderMapData(service)
    assert.equal(result.kind, 'error')
    if (result.kind === 'error') {
      assert.ok(result.message.length > 0)
    }
  })

  it('returns error with message on non-401 DriverApiHttpError from getStations', async () => {
    const service = makeService({
      getStations: async () => {
        throw new DriverApiHttpError({ endpoint: '/api/v1/rider/me/stations', status: 503 })
      },
    })

    const result = await loadRiderMapData(service)
    assert.equal(result.kind, 'error')
    if (result.kind === 'error') {
      assert.ok(result.message.length > 0)
    }
  })

  it('returns error with the Error message on generic Error', async () => {
    const service = makeService({
      getTips: async () => {
        throw new Error('Network timeout')
      },
    })

    const result = await loadRiderMapData(service)
    assert.equal(result.kind, 'error')
    if (result.kind === 'error') {
      assert.match(result.message, /network timeout/iu)
    }
  })

  it('returns error with message when a generic Error is thrown', async () => {
    const service = makeService({
      getTips: async () => {
        throw new Error('plain string error')
      },
    })

    const result = await loadRiderMapData(service)
    assert.equal(result.kind, 'error')
    if (result.kind === 'error') {
      assert.ok(result.message.length > 0)
    }
  })

  it('fetches tips and stations concurrently (both called before either resolves)', async () => {
    const callOrder: string[] = []

    const service = makeService({
      getTips: async () => {
        callOrder.push('tips-called')
        await Promise.resolve()
        callOrder.push('tips-resolved')
        return []
      },
      getStations: async () => {
        callOrder.push('stations-called')
        await Promise.resolve()
        callOrder.push('stations-resolved')
        return []
      },
    })

    await loadRiderMapData(service)

    // Both should be called before either resolves (concurrent, not sequential)
    const tipsCalledIdx = callOrder.indexOf('tips-called')
    const stationsCalledIdx = callOrder.indexOf('stations-called')
    const tipsResolvedIdx = callOrder.indexOf('tips-resolved')

    assert.ok(tipsCalledIdx >= 0, 'tips was called')
    assert.ok(stationsCalledIdx >= 0, 'stations was called')
    assert.ok(stationsCalledIdx < tipsResolvedIdx, 'stations called before tips resolved (concurrent)')
  })
})
