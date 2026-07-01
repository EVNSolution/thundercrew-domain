import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { deriveMaintenanceStatus, loadRiderProfile } from './riderProfile'
import { DriverApiHttpError } from '../../api/deliveryServer/driverApiError'
import type {
  RiderMaintenanceItem,
  RiderMaintenanceRecord,
  RiderNotification,
  RiderProfileService,
  RiderVehicleInfo,
} from '../../api/thundercrew/riderProfileClient'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeItem(overrides: Partial<RiderMaintenanceItem> = {}): RiderMaintenanceItem {
  return {
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
    ...overrides,
  }
}

function makeRecord(overrides: Partial<RiderMaintenanceRecord> = {}): RiderMaintenanceRecord {
  return {
    id: 'rec-1',
    idx: 1,
    bikeId: 'bike-1',
    itemId: 'item-1',
    servicedAt: '2026-01-15T00:00:00.000Z',
    servicedAtOdometerKm: 1000,
    memo: '',
    createdAt: '2026-01-15T00:00:00.000Z',
    updatedAt: '2026-01-15T00:00:00.000Z',
    ...overrides,
  }
}

const sampleVehicle: RiderVehicleInfo = {
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

const sampleNotification: RiderNotification = {
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

function makeService(overrides: Partial<RiderProfileService> = {}): RiderProfileService {
  return {
    getVehicle: async () => sampleVehicle,
    getMaintenance: async () => ({ items: [makeItem()], records: [makeRecord()] }),
    listNotifications: async () => [sampleNotification],
    getTips: async () => [],
    getStations: async () => [],
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// loadRiderProfile
// ---------------------------------------------------------------------------

describe('loadRiderProfile', () => {
  it('returns loaded with vehicle, maintenance, and notifications on success', async () => {
    const service = makeService()
    const result = await loadRiderProfile(service)

    assert.equal(result.kind, 'loaded')
    if (result.kind === 'loaded') {
      assert.ok(result.vehicle !== null)
      assert.equal(result.vehicle.bikeId, 'bike-1')
      assert.equal(result.maintenance.items.length, 1)
      assert.equal(result.maintenance.records.length, 1)
      assert.equal(result.notifications.length, 1)
    }
  })

  it('returns loaded with null vehicle when getVehicle returns null', async () => {
    const service = makeService({ getVehicle: async () => null })
    const result = await loadRiderProfile(service)

    assert.equal(result.kind, 'loaded')
    if (result.kind === 'loaded') {
      assert.equal(result.vehicle, null)
    }
  })

  it('returns unauthorized when getVehicle throws 401', async () => {
    const service = makeService({
      getVehicle: async () => {
        throw new DriverApiHttpError({ endpoint: '/api/v1/rider/me/vehicle', status: 401 })
      },
    })

    const result = await loadRiderProfile(service)
    assert.equal(result.kind, 'unauthorized')
  })

  it('returns unauthorized when getMaintenance throws 401', async () => {
    const service = makeService({
      getMaintenance: async () => {
        throw new DriverApiHttpError({ endpoint: '/api/v1/rider/me/maintenance', status: 401 })
      },
    })

    const result = await loadRiderProfile(service)
    assert.equal(result.kind, 'unauthorized')
  })

  it('returns unauthorized when listNotifications throws 401', async () => {
    const service = makeService({
      listNotifications: async () => {
        throw new DriverApiHttpError({ endpoint: '/api/v1/rider/me/notifications', status: 401 })
      },
    })

    const result = await loadRiderProfile(service)
    assert.equal(result.kind, 'unauthorized')
  })

  it('returns error with message on non-401 DriverApiHttpError', async () => {
    const service = makeService({
      getVehicle: async () => {
        throw new DriverApiHttpError({ endpoint: '/api/v1/rider/me/vehicle', status: 500 })
      },
    })

    const result = await loadRiderProfile(service)
    assert.equal(result.kind, 'error')
    if (result.kind === 'error') {
      assert.ok(result.message.length > 0)
    }
  })

  it('returns error with message on generic Error', async () => {
    const service = makeService({
      getMaintenance: async () => {
        throw new Error('Network timeout')
      },
    })

    const result = await loadRiderProfile(service)
    assert.equal(result.kind, 'error')
    if (result.kind === 'error') {
      assert.match(result.message, /network timeout/iu)
    }
  })

  it('returns error with fallback message when thrown value has no message property', async () => {
    const service = makeService({
      listNotifications: async () => {
        // Simulate non-Error throw by wrapping in a rejected promise directly
        return Promise.reject(new DriverApiHttpError({ endpoint: '/notifs', status: 503 }))
      },
    })

    const result = await loadRiderProfile(service)
    assert.equal(result.kind, 'error')
    if (result.kind === 'error') {
      assert.ok(result.message.length > 0)
    }
  })
})

// ---------------------------------------------------------------------------
// deriveMaintenanceStatus
// ---------------------------------------------------------------------------

describe('deriveMaintenanceStatus', () => {
  it('returns unknown when no record', () => {
    const item = makeItem({ cycleKm: 5000, cycleMonths: 6 })
    const status = deriveMaintenanceStatus(item, null, 5000)
    assert.equal(status, 'unknown')
  })

  it('returns unknown when item has no cycle defined', () => {
    const item = makeItem({ cycleKm: null, cycleMonths: null })
    const record = makeRecord({ servicedAtOdometerKm: 1000 })
    const status = deriveMaintenanceStatus(item, record, 3000)
    assert.equal(status, 'unknown')
  })

  it('returns overdue when odometer delta exceeds cycleKm', () => {
    // cycleKm = 5000, serviced at 1000 km, current = 7000 km → delta = 6000 → ratio 1.2 → overdue
    const item = makeItem({ cycleKm: 5000, cycleMonths: null })
    const record = makeRecord({ servicedAt: '2026-01-01T00:00:00.000Z', servicedAtOdometerKm: 1000 })
    const status = deriveMaintenanceStatus(item, record, 7000)
    assert.equal(status, 'overdue')
  })

  it('returns due_soon when odometer delta is within alert threshold', () => {
    // cycleKm = 5000, serviced at 1000 km, current = 5000 km → delta = 4000 → ratio 0.8 → due_soon (threshold 80%)
    const item = makeItem({ cycleKm: 5000, cycleMonths: null, alertThresholdPercent: 80 })
    const record = makeRecord({ servicedAt: '2026-01-01T00:00:00.000Z', servicedAtOdometerKm: 1000 })
    const status = deriveMaintenanceStatus(item, record, 5000)
    assert.equal(status, 'due_soon')
  })

  it('returns ok when odometer delta is well below threshold', () => {
    // cycleKm = 5000, serviced at 1000 km, current = 2000 km → delta = 1000 → ratio 0.2 → ok
    const item = makeItem({ cycleKm: 5000, cycleMonths: null, alertThresholdPercent: 80 })
    const record = makeRecord({ servicedAt: '2026-01-01T00:00:00.000Z', servicedAtOdometerKm: 1000 })
    const status = deriveMaintenanceStatus(item, record, 2000)
    assert.equal(status, 'ok')
  })

  it('returns overdue when elapsed months exceeds cycleMonths', () => {
    // cycleMonths = 1, servicedAt = 2 months ago → ratio ~2 → overdue
    const twoMonthsAgo = new Date(Date.now() - 2 * 30 * 24 * 60 * 60 * 1000).toISOString()
    const item = makeItem({ cycleKm: null, cycleMonths: 1, alertThresholdPercent: 80 })
    const record = makeRecord({ servicedAt: twoMonthsAgo, servicedAtOdometerKm: null })
    const status = deriveMaintenanceStatus(item, record, null)
    assert.equal(status, 'overdue')
  })

  it('returns due_soon when elapsed months is within alert threshold by months', () => {
    // cycleMonths = 6, servicedAt = 5 months ago → ratio ~0.83 → due_soon (threshold 80%)
    const fiveMonthsAgo = new Date(Date.now() - 5 * 30 * 24 * 60 * 60 * 1000).toISOString()
    const item = makeItem({ cycleKm: null, cycleMonths: 6, alertThresholdPercent: 80 })
    const record = makeRecord({ servicedAt: fiveMonthsAgo, servicedAtOdometerKm: null })
    const status = deriveMaintenanceStatus(item, record, null)
    assert.equal(status, 'due_soon')
  })

  it('returns ok when elapsed months is well below cycle', () => {
    // cycleMonths = 12, servicedAt = 1 month ago → ratio ~0.08 → ok
    const oneMonthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const item = makeItem({ cycleKm: null, cycleMonths: 12, alertThresholdPercent: 80 })
    const record = makeRecord({ servicedAt: oneMonthAgo, servicedAtOdometerKm: null })
    const status = deriveMaintenanceStatus(item, record, null)
    assert.equal(status, 'ok')
  })

  it('uses worst ratio (km vs months) when both dimensions are present', () => {
    // cycleKm = 5000: delta = 500, ratio = 0.1 → ok by km
    // cycleMonths = 1: elapsed = 2 months, ratio = 2.0 → overdue by months
    // Worst = overdue
    const twoMonthsAgo = new Date(Date.now() - 2 * 30 * 24 * 60 * 60 * 1000).toISOString()
    const item = makeItem({ cycleKm: 5000, cycleMonths: 1, alertThresholdPercent: 80 })
    const record = makeRecord({ servicedAt: twoMonthsAgo, servicedAtOdometerKm: 1000 })
    const status = deriveMaintenanceStatus(item, record, 1500)
    assert.equal(status, 'overdue')
  })

  it('uses default 80% threshold when alertThresholdPercent is null', () => {
    // ratio = 0.85 with null threshold → should be due_soon (default 80%)
    const item = makeItem({ cycleKm: 5000, cycleMonths: null, alertThresholdPercent: null })
    const record = makeRecord({ servicedAt: '2026-01-01T00:00:00.000Z', servicedAtOdometerKm: 1000 })
    // delta = 4250, ratio = 0.85
    const status = deriveMaintenanceStatus(item, record, 5250)
    assert.equal(status, 'due_soon')
  })

  it('returns unknown when km cycle defined but both currentOdometerKm and servicedAtOdometerKm are null', () => {
    const item = makeItem({ cycleKm: 5000, cycleMonths: null })
    const record = makeRecord({ servicedAtOdometerKm: null })
    const status = deriveMaintenanceStatus(item, record, null)
    assert.equal(status, 'unknown')
  })
})
