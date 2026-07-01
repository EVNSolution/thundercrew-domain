import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { createRiderProfileService } from './riderProfileClient'
import { DriverApiHttpError } from '../deliveryServer/driverApiError'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const sampleVehicle = {
  bikeId: 'bike-1',
  plateNumber: '12가3456',
  imei: '123456789012345',
  serviceType: 'DELIVERY',
  currentLatitude: 37.5665,
  currentLongitude: 126.978,
  odometerKm: 1234.5,
  connectionStatus: 'CONNECTED',
  lastReceivedAt: '2026-07-01T09:00:00.000Z',
}

const sampleItem = {
  id: 'item-1',
  idx: 1,
  name: '엔진오일',
  categories: ['OIL'],
  cycleKm: 5000,
  cycleMonths: 6,
  memo: '',
  alertThresholdPercent: 80,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

const sampleRecord = {
  id: 'rec-1',
  idx: 1,
  bikeId: 'bike-1',
  itemId: 'item-1',
  servicedAt: '2026-01-15T00:00:00.000Z',
  servicedAtOdometerKm: 1000,
  memo: '',
  createdAt: '2026-01-15T00:00:00.000Z',
  updatedAt: '2026-01-15T00:00:00.000Z',
}

const sampleNotification = {
  id: 'notif-1',
  idx: 1,
  type: 'MAINTENANCE_DUE',
  title: '정비 필요',
  body: '엔진오일 교환 시기가 임박했습니다.',
  refBikeId: 'bike-1',
  refEntityId: 'item-1',
  refRiderId: null,
  occurredAt: '2026-07-01T08:00:00.000Z',
  acknowledgedAt: null,
  createdAt: '2026-07-01T08:00:00.000Z',
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// getVehicle
// ---------------------------------------------------------------------------

describe('createRiderProfileService — getVehicle', () => {
  it('sends GET to /api/v1/rider/me/vehicle with Authorization header', async () => {
    const requests: { url: string; method: string; headers: Record<string, string> }[] = []

    const service = createRiderProfileService({
      baseUrl: 'https://tc.example.com',
      accessToken: 'my-token',
      fetchImpl: async (url, init) => {
        requests.push({
          url: String(url),
          method: String(init?.method),
          headers: (init?.headers as Record<string, string>) ?? {},
        })
        return { ok: true, status: 200, json: async () => sampleVehicle } as Response
      },
    })

    await service.getVehicle()

    assert.equal(requests.length, 1)
    assert.equal(requests[0]?.url, 'https://tc.example.com/api/v1/rider/me/vehicle')
    assert.equal(requests[0]?.method, 'GET')
    assert.equal(requests[0]?.headers['Authorization'], 'Bearer my-token')
  })

  it('maps 200 body to RiderVehicleInfo', async () => {
    const service = createRiderProfileService({
      baseUrl: 'https://tc.example.com',
      accessToken: 'my-token',
      fetchImpl: makeOkFetch(sampleVehicle),
    })

    const vehicle = await service.getVehicle()

    assert.ok(vehicle !== null)
    assert.equal(vehicle.bikeId, 'bike-1')
    assert.equal(vehicle.plateNumber, '12가3456')
    assert.equal(vehicle.odometerKm, 1234.5)
    assert.equal(vehicle.connectionStatus, 'CONNECTED')
    assert.equal(vehicle.lastReceivedAt, '2026-07-01T09:00:00.000Z')
  })

  it('returns null for empty object body (no-vehicle rider)', async () => {
    const service = createRiderProfileService({
      baseUrl: 'https://tc.example.com',
      accessToken: 'my-token',
      fetchImpl: makeOkFetch({}),
    })

    const vehicle = await service.getVehicle()
    assert.equal(vehicle, null)
  })

  it('returns null when required fields are missing', async () => {
    const service = createRiderProfileService({
      baseUrl: 'https://tc.example.com',
      accessToken: 'my-token',
      fetchImpl: makeOkFetch({ bikeId: 'bike-1' }), // missing plateNumber, imei, serviceType
    })

    const vehicle = await service.getVehicle()
    assert.equal(vehicle, null)
  })

  it('tolerates null optional fields', async () => {
    const vehicleWithNulls = {
      ...sampleVehicle,
      currentLatitude: null,
      currentLongitude: null,
      odometerKm: null,
      connectionStatus: null,
      lastReceivedAt: null,
    }

    const service = createRiderProfileService({
      baseUrl: 'https://tc.example.com',
      accessToken: 'my-token',
      fetchImpl: makeOkFetch(vehicleWithNulls),
    })

    const vehicle = await service.getVehicle()
    assert.ok(vehicle !== null)
    assert.equal(vehicle.odometerKm, null)
    assert.equal(vehicle.connectionStatus, null)
    assert.equal(vehicle.lastReceivedAt, null)
  })

  it('throws DriverApiHttpError with status 401 on 401 response', async () => {
    const service = createRiderProfileService({
      baseUrl: 'https://tc.example.com',
      accessToken: 'expired-token',
      fetchImpl: makeErrorFetch(401),
    })

    await assert.rejects(
      () => service.getVehicle(),
      (err: unknown) => {
        assert.ok(err instanceof DriverApiHttpError)
        assert.equal(err.status, 401)
        return true
      },
    )
  })

  it('throws DriverApiHttpError on non-2xx response', async () => {
    const service = createRiderProfileService({
      baseUrl: 'https://tc.example.com',
      accessToken: 'my-token',
      fetchImpl: makeErrorFetch(500),
    })

    await assert.rejects(
      () => service.getVehicle(),
      (err: unknown) => {
        assert.ok(err instanceof DriverApiHttpError)
        assert.equal(err.status, 500)
        return true
      },
    )
  })
})

// ---------------------------------------------------------------------------
// getMaintenance
// ---------------------------------------------------------------------------

describe('createRiderProfileService — getMaintenance', () => {
  it('sends GET to /api/v1/rider/me/maintenance with Authorization header', async () => {
    const requests: { url: string; method: string; headers: Record<string, string> }[] = []

    const service = createRiderProfileService({
      baseUrl: 'https://tc.example.com',
      accessToken: 'my-token',
      fetchImpl: async (url, init) => {
        requests.push({
          url: String(url),
          method: String(init?.method),
          headers: (init?.headers as Record<string, string>) ?? {},
        })
        return {
          ok: true,
          status: 200,
          json: async () => ({ items: [sampleItem], records: [sampleRecord] }),
        } as Response
      },
    })

    await service.getMaintenance()

    assert.equal(requests.length, 1)
    assert.equal(requests[0]?.url, 'https://tc.example.com/api/v1/rider/me/maintenance')
    assert.equal(requests[0]?.method, 'GET')
    assert.equal(requests[0]?.headers['Authorization'], 'Bearer my-token')
  })

  it('maps body to items and records arrays', async () => {
    const service = createRiderProfileService({
      baseUrl: 'https://tc.example.com',
      accessToken: 'my-token',
      fetchImpl: makeOkFetch({ items: [sampleItem], records: [sampleRecord] }),
    })

    const result = await service.getMaintenance()

    assert.equal(result.items.length, 1)
    assert.equal(result.items[0]?.id, 'item-1')
    assert.equal(result.items[0]?.name, '엔진오일')
    assert.equal(result.items[0]?.cycleKm, 5000)
    assert.equal(result.records.length, 1)
    assert.equal(result.records[0]?.id, 'rec-1')
    assert.equal(result.records[0]?.servicedAtOdometerKm, 1000)
  })

  it('returns empty arrays when items and records are empty', async () => {
    const service = createRiderProfileService({
      baseUrl: 'https://tc.example.com',
      accessToken: 'my-token',
      fetchImpl: makeOkFetch({ items: [], records: [] }),
    })

    const result = await service.getMaintenance()
    assert.equal(result.items.length, 0)
    assert.equal(result.records.length, 0)
  })

  it('throws DriverApiHttpError with status 401 on 401 response', async () => {
    const service = createRiderProfileService({
      baseUrl: 'https://tc.example.com',
      accessToken: 'expired-token',
      fetchImpl: makeErrorFetch(401),
    })

    await assert.rejects(
      () => service.getMaintenance(),
      (err: unknown) => {
        assert.ok(err instanceof DriverApiHttpError)
        assert.equal(err.status, 401)
        return true
      },
    )
  })

  it('throws DriverApiHttpError when body is not an object with arrays', async () => {
    const service = createRiderProfileService({
      baseUrl: 'https://tc.example.com',
      accessToken: 'my-token',
      fetchImpl: makeOkFetch([]), // wrong shape — array instead of {items,records}
    })

    await assert.rejects(
      () => service.getMaintenance(),
      (err: unknown) => {
        assert.ok(err instanceof DriverApiHttpError)
        return true
      },
    )
  })
})

// ---------------------------------------------------------------------------
// listNotifications
// ---------------------------------------------------------------------------

describe('createRiderProfileService — listNotifications', () => {
  it('sends GET to /api/v1/rider/me/notifications with Authorization header', async () => {
    const requests: { url: string; method: string; headers: Record<string, string> }[] = []

    const service = createRiderProfileService({
      baseUrl: 'https://tc.example.com',
      accessToken: 'my-token',
      fetchImpl: async (url, init) => {
        requests.push({
          url: String(url),
          method: String(init?.method),
          headers: (init?.headers as Record<string, string>) ?? {},
        })
        return { ok: true, status: 200, json: async () => [sampleNotification] } as Response
      },
    })

    await service.listNotifications()

    assert.equal(requests.length, 1)
    assert.equal(requests[0]?.url, 'https://tc.example.com/api/v1/rider/me/notifications')
    assert.equal(requests[0]?.method, 'GET')
    assert.equal(requests[0]?.headers['Authorization'], 'Bearer my-token')
  })

  it('maps 200 array body to RiderNotification[]', async () => {
    const service = createRiderProfileService({
      baseUrl: 'https://tc.example.com',
      accessToken: 'my-token',
      fetchImpl: makeOkFetch([sampleNotification]),
    })

    const notifications = await service.listNotifications()

    assert.equal(notifications.length, 1)
    assert.equal(notifications[0]?.id, 'notif-1')
    assert.equal(notifications[0]?.title, '정비 필요')
    assert.equal(notifications[0]?.acknowledgedAt, null)
    assert.equal(notifications[0]?.refBikeId, 'bike-1')
    assert.equal(notifications[0]?.refRiderId, null)
  })

  it('returns empty array when response is empty', async () => {
    const service = createRiderProfileService({
      baseUrl: 'https://tc.example.com',
      accessToken: 'my-token',
      fetchImpl: makeOkFetch([]),
    })

    const notifications = await service.listNotifications()
    assert.equal(notifications.length, 0)
  })

  it('throws DriverApiHttpError with status 401 on 401 response', async () => {
    const service = createRiderProfileService({
      baseUrl: 'https://tc.example.com',
      accessToken: 'expired-token',
      fetchImpl: makeErrorFetch(401),
    })

    await assert.rejects(
      () => service.listNotifications(),
      (err: unknown) => {
        assert.ok(err instanceof DriverApiHttpError)
        assert.equal(err.status, 401)
        return true
      },
    )
  })

  it('throws DriverApiHttpError when body is not an array', async () => {
    const service = createRiderProfileService({
      baseUrl: 'https://tc.example.com',
      accessToken: 'my-token',
      fetchImpl: makeOkFetch({ data: [] }), // object instead of array
    })

    await assert.rejects(
      () => service.listNotifications(),
      (err: unknown) => {
        assert.ok(err instanceof DriverApiHttpError)
        return true
      },
    )
  })
})

// ---------------------------------------------------------------------------
// getTips
// ---------------------------------------------------------------------------

const sampleTip = {
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
}

describe('createRiderProfileService — getTips', () => {
  it('sends GET to /api/v1/rider/me/tips with Authorization header', async () => {
    const requests: { url: string; method: string; headers: Record<string, string> }[] = []

    const service = createRiderProfileService({
      baseUrl: 'https://tc.example.com',
      accessToken: 'tok-tips',
      fetchImpl: async (url, init) => {
        requests.push({
          url: String(url),
          method: String(init?.method),
          headers: (init?.headers as Record<string, string>) ?? {},
        })
        return { ok: true, status: 200, json: async () => [sampleTip] } as Response
      },
    })

    await service.getTips()

    assert.equal(requests.length, 1)
    assert.equal(requests[0]?.url, 'https://tc.example.com/api/v1/rider/me/tips')
    assert.equal(requests[0]?.method, 'GET')
    assert.equal(requests[0]?.headers['Authorization'], 'Bearer tok-tips')
  })

  it('maps 200 array body to RiderTip[]', async () => {
    const service = createRiderProfileService({
      baseUrl: 'https://tc.example.com',
      accessToken: 'my-token',
      fetchImpl: makeOkFetch([sampleTip]),
    })

    const tips = await service.getTips()

    assert.equal(tips.length, 1)
    assert.equal(tips[0]?.id, 'tip-1')
    assert.equal(tips[0]?.address, '서울 강남구 테헤란로 123')
    assert.equal(tips[0]?.content, '주차 팁: 후면 주차장 이용')
    assert.equal(tips[0]?.latitude, 37.5012)
    assert.equal(tips[0]?.longitude, 127.0396)
    assert.equal(tips[0]?.status, 'PUBLISHED')
  })

  it('throws DriverApiHttpError on 401', async () => {
    const service = createRiderProfileService({
      baseUrl: 'https://tc.example.com',
      accessToken: 'my-token',
      fetchImpl: makeErrorFetch(401),
    })

    await assert.rejects(
      () => service.getTips(),
      (err: unknown) => {
        assert.ok(err instanceof DriverApiHttpError)
        assert.equal(err.status, 401)
        return true
      },
    )
  })

  it('throws DriverApiHttpError when body is not an array', async () => {
    const service = createRiderProfileService({
      baseUrl: 'https://tc.example.com',
      accessToken: 'my-token',
      fetchImpl: makeOkFetch({ tips: [] }),
    })

    await assert.rejects(
      () => service.getTips(),
      (err: unknown) => {
        assert.ok(err instanceof DriverApiHttpError)
        return true
      },
    )
  })

  it('throws DriverApiHttpError when a tip has NaN latitude', async () => {
    const badTip = { ...sampleTip, latitude: 'not-a-number' }
    const service = createRiderProfileService({
      baseUrl: 'https://tc.example.com',
      accessToken: 'my-token',
      fetchImpl: makeOkFetch([badTip]),
    })

    await assert.rejects(
      () => service.getTips(),
      (err: unknown) => {
        assert.ok(err instanceof DriverApiHttpError)
        return true
      },
    )
  })
})

// ---------------------------------------------------------------------------
// getStations
// ---------------------------------------------------------------------------

const sampleStation = {
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
}

describe('createRiderProfileService — getStations', () => {
  it('sends GET to /api/v1/rider/me/stations with Authorization header', async () => {
    const requests: { url: string; method: string; headers: Record<string, string> }[] = []

    const service = createRiderProfileService({
      baseUrl: 'https://tc.example.com',
      accessToken: 'tok-stations',
      fetchImpl: async (url, init) => {
        requests.push({
          url: String(url),
          method: String(init?.method),
          headers: (init?.headers as Record<string, string>) ?? {},
        })
        return { ok: true, status: 200, json: async () => [sampleStation] } as Response
      },
    })

    await service.getStations()

    assert.equal(requests.length, 1)
    assert.equal(requests[0]?.url, 'https://tc.example.com/api/v1/rider/me/stations')
    assert.equal(requests[0]?.method, 'GET')
    assert.equal(requests[0]?.headers['Authorization'], 'Bearer tok-stations')
  })

  it('maps 200 array body to RiderStation[]', async () => {
    const service = createRiderProfileService({
      baseUrl: 'https://tc.example.com',
      accessToken: 'my-token',
      fetchImpl: makeOkFetch([sampleStation]),
    })

    const stations = await service.getStations()

    assert.equal(stations.length, 1)
    assert.equal(stations[0]?.id, 'station-1')
    assert.equal(stations[0]?.name, '강남역 충전소')
    assert.equal(stations[0]?.latitude, 37.4979)
    assert.equal(stations[0]?.longitude, 127.0276)
    assert.equal(stations[0]?.availableBatteryLabel, '5개 사용 가능')
    assert.equal(stations[0]?.status, 'ACTIVE')
  })

  it('coerces string latitude/longitude (BigDecimal serialization)', async () => {
    const stationWithStringCoords = {
      ...sampleStation,
      latitude: '37.4979',
      longitude: '127.0276',
    }

    const service = createRiderProfileService({
      baseUrl: 'https://tc.example.com',
      accessToken: 'my-token',
      fetchImpl: makeOkFetch([stationWithStringCoords]),
    })

    const stations = await service.getStations()

    assert.equal(stations.length, 1)
    assert.equal(typeof stations[0]?.latitude, 'number')
    assert.equal(typeof stations[0]?.longitude, 'number')
    assert.equal(stations[0]?.latitude, 37.4979)
  })

  it('skips stations with NaN latitude/longitude', async () => {
    const badStation = { ...sampleStation, id: 'bad', latitude: 'invalid' }
    const goodStation = { ...sampleStation, id: 'good' }

    const service = createRiderProfileService({
      baseUrl: 'https://tc.example.com',
      accessToken: 'my-token',
      fetchImpl: makeOkFetch([badStation, goodStation]),
    })

    const stations = await service.getStations()

    assert.equal(stations.length, 1)
    assert.equal(stations[0]?.id, 'good')
  })

  it('throws DriverApiHttpError on 401', async () => {
    const service = createRiderProfileService({
      baseUrl: 'https://tc.example.com',
      accessToken: 'my-token',
      fetchImpl: makeErrorFetch(401),
    })

    await assert.rejects(
      () => service.getStations(),
      (err: unknown) => {
        assert.ok(err instanceof DriverApiHttpError)
        assert.equal(err.status, 401)
        return true
      },
    )
  })

  it('throws DriverApiHttpError when body is not an array', async () => {
    const service = createRiderProfileService({
      baseUrl: 'https://tc.example.com',
      accessToken: 'my-token',
      fetchImpl: makeOkFetch({ stations: [] }),
    })

    await assert.rejects(
      () => service.getStations(),
      (err: unknown) => {
        assert.ok(err instanceof DriverApiHttpError)
        return true
      },
    )
  })
})
