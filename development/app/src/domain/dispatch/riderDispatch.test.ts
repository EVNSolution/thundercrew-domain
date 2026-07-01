import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { acceptCall, completeDelivery, loadRiderDeliveries } from './riderDispatch'
import { DriverApiHttpError } from '../../api/deliveryServer/driverApiError'
import type { RiderDispatchOrder, RiderDispatchService } from '../../api/thundercrew/riderDispatchClient'

function makeOrder(overrides: Partial<RiderDispatchOrder> = {}): RiderDispatchOrder {
  return {
    id: 'order-1',
    idx: 1,
    bikeId: 'bike-1',
    customerName: 'Jane Smith',
    customerPhone: '+12125550100',
    address: '123 Main St',
    latitude: 37.7749,
    longitude: -122.4194,
    originAddress: '456 Origin Ave',
    originLatitude: 37.7850,
    originLongitude: -122.4100,
    sequence: 1,
    status: 'ASSIGNED',
    kind: 'DELIVERY',
    completedAt: null,
    createdAt: '2026-07-01T10:00:00.000Z',
    completedBy: null,
    hasCompletionPhoto: false,
    ...overrides,
  }
}

function makeService(override?: Partial<RiderDispatchService>): RiderDispatchService {
  return {
    listAssigned: async () => [],
    listCompleted: async () => [],
    listOfferedCalls: async () => [],
    acceptOfferedCall: async () => makeOrder({ status: 'ASSIGNED' }),
    completeDelivery: async () => makeOrder({ status: 'COMPLETED' }),
    ...override,
  }
}

const samplePhoto = { uri: 'file:///tmp/photo.jpg', name: 'completion.jpg', type: 'image/jpeg' }

describe('loadRiderDeliveries', () => {
  it('returns loaded with all three lists on success', async () => {
    const assigned = [makeOrder({ id: 'a1', sequence: 1 })]
    const completed = [makeOrder({ id: 'c1', status: 'COMPLETED' })]
    const offered = [makeOrder({ id: 'o1', status: 'OFFERED' })]

    const service = makeService({
      listAssigned: async () => assigned,
      listCompleted: async () => completed,
      listOfferedCalls: async () => offered,
    })

    const result = await loadRiderDeliveries(service)

    assert.equal(result.kind, 'loaded')
    if (result.kind === 'loaded') {
      assert.equal(result.assigned.length, 1)
      assert.equal(result.assigned[0]?.id, 'a1')
      assert.equal(result.completed.length, 1)
      assert.equal(result.completed[0]?.id, 'c1')
      assert.equal(result.offered.length, 1)
      assert.equal(result.offered[0]?.id, 'o1')
    }
  })

  it('sorts assigned orders by sequence ascending', async () => {
    const assigned = [
      makeOrder({ id: 'a3', sequence: 3 }),
      makeOrder({ id: 'a1', sequence: 1 }),
      makeOrder({ id: 'a2', sequence: 2 }),
    ]

    const service = makeService({ listAssigned: async () => assigned })
    const result = await loadRiderDeliveries(service)

    assert.equal(result.kind, 'loaded')
    if (result.kind === 'loaded') {
      assert.deepEqual(result.assigned.map((o) => o.id), ['a1', 'a2', 'a3'])
    }
  })

  it('does not mutate the original assigned array when sorting', async () => {
    const originalOrder = [
      makeOrder({ id: 'a3', sequence: 3 }),
      makeOrder({ id: 'a1', sequence: 1 }),
    ]
    const assigned = [...originalOrder]

    const service = makeService({ listAssigned: async () => assigned })
    await loadRiderDeliveries(service)

    assert.equal(assigned[0]?.id, 'a3', 'original array should not be mutated')
  })

  it('returns unauthorized when any list call throws a 401 DriverApiHttpError', async () => {
    const service = makeService({
      listAssigned: async () => {
        throw new DriverApiHttpError({ endpoint: '/api/v1/rider/me/dispatch-orders', status: 401 })
      },
    })

    const result = await loadRiderDeliveries(service)
    assert.equal(result.kind, 'unauthorized')
  })

  it('returns unauthorized when listCompleted throws 401', async () => {
    const service = makeService({
      listCompleted: async () => {
        throw new DriverApiHttpError({ endpoint: '/api/v1/rider/me/dispatch-orders/completed', status: 401 })
      },
    })

    const result = await loadRiderDeliveries(service)
    assert.equal(result.kind, 'unauthorized')
  })

  it('returns unauthorized when listOfferedCalls throws 401', async () => {
    const service = makeService({
      listOfferedCalls: async () => {
        throw new DriverApiHttpError({ endpoint: '/api/v1/rider/me/offered-calls', status: 401 })
      },
    })

    const result = await loadRiderDeliveries(service)
    assert.equal(result.kind, 'unauthorized')
  })

  it('returns error with message on non-401 DriverApiHttpError', async () => {
    const service = makeService({
      listAssigned: async () => {
        throw new DriverApiHttpError({ endpoint: '/api/v1/rider/me/dispatch-orders', status: 500 })
      },
    })

    const result = await loadRiderDeliveries(service)
    assert.equal(result.kind, 'error')
    if (result.kind === 'error') {
      assert.ok(result.message.length > 0)
    }
  })

  it('returns error with message on generic Error', async () => {
    const service = makeService({
      listAssigned: async () => {
        throw new Error('Network timeout')
      },
    })

    const result = await loadRiderDeliveries(service)
    assert.equal(result.kind, 'error')
    if (result.kind === 'error') {
      assert.match(result.message, /network timeout/iu)
    }
  })

  it('returns error with message from thrown Error', async () => {
    const service = makeService({
      listAssigned: async () => {
        throw new Error('non-standard error fallback')
      },
    })

    const result = await loadRiderDeliveries(service)
    assert.equal(result.kind, 'error')
    if (result.kind === 'error') {
      assert.ok(result.message.length > 0)
    }
  })

  it('returns loaded with empty lists when all endpoints return empty arrays', async () => {
    const service = makeService()
    const result = await loadRiderDeliveries(service)

    assert.equal(result.kind, 'loaded')
    if (result.kind === 'loaded') {
      assert.equal(result.assigned.length, 0)
      assert.equal(result.completed.length, 0)
      assert.equal(result.offered.length, 0)
    }
  })
})

describe('acceptCall', () => {
  it('returns success with the returned order on successful accept', async () => {
    const assignedOrder = makeOrder({ id: 'offer-1', status: 'ASSIGNED' })
    const service = makeService({
      acceptOfferedCall: async () => assignedOrder,
    })

    const result = await acceptCall('offer-1', service)

    assert.equal(result.kind, 'success')
    if (result.kind === 'success') {
      assert.equal(result.order.id, 'offer-1')
      assert.equal(result.order.status, 'ASSIGNED')
    }
  })

  it('returns unauthorized when acceptOfferedCall throws a 401 DriverApiHttpError', async () => {
    const service = makeService({
      acceptOfferedCall: async () => {
        throw new DriverApiHttpError({ endpoint: '/api/v1/rider/me/offered-calls/x/accept', status: 401 })
      },
    })

    const result = await acceptCall('x', service)
    assert.equal(result.kind, 'unauthorized')
  })

  it('returns forbidden when acceptOfferedCall throws a 403 DriverApiHttpError', async () => {
    const service = makeService({
      acceptOfferedCall: async () => {
        throw new DriverApiHttpError({ endpoint: '/api/v1/rider/me/offered-calls/x/accept', status: 403 })
      },
    })

    const result = await acceptCall('x', service)
    assert.equal(result.kind, 'forbidden')
  })

  it('returns error with message on non-401/403 DriverApiHttpError', async () => {
    const service = makeService({
      acceptOfferedCall: async () => {
        throw new DriverApiHttpError({ endpoint: '/api/v1/rider/me/offered-calls/x/accept', status: 409 })
      },
    })

    const result = await acceptCall('x', service)
    assert.equal(result.kind, 'error')
    if (result.kind === 'error') {
      assert.ok(result.message.length > 0)
    }
  })

  it('returns error with message on generic Error', async () => {
    const service = makeService({
      acceptOfferedCall: async () => {
        throw new Error('Network failure')
      },
    })

    const result = await acceptCall('x', service)
    assert.equal(result.kind, 'error')
    if (result.kind === 'error') {
      assert.match(result.message, /network failure/iu)
    }
  })
})

describe('completeDelivery', () => {
  it('returns success with the returned order on successful complete', async () => {
    const completedOrder = makeOrder({ id: 'dispatch-1', status: 'COMPLETED', hasCompletionPhoto: true })
    const service = makeService({
      completeDelivery: async () => completedOrder,
    })

    const result = await completeDelivery('dispatch-1', samplePhoto, service)

    assert.equal(result.kind, 'success')
    if (result.kind === 'success') {
      assert.equal(result.order.id, 'dispatch-1')
      assert.equal(result.order.status, 'COMPLETED')
      assert.equal(result.order.hasCompletionPhoto, true)
    }
  })

  it('returns unauthorized when completeDelivery throws a 401 DriverApiHttpError', async () => {
    const service = makeService({
      completeDelivery: async () => {
        throw new DriverApiHttpError({ endpoint: '/api/v1/rider/me/dispatch-orders/x/complete', status: 401 })
      },
    })

    const result = await completeDelivery('x', samplePhoto, service)
    assert.equal(result.kind, 'unauthorized')
  })

  it('returns forbidden when completeDelivery throws a 403 DriverApiHttpError', async () => {
    const service = makeService({
      completeDelivery: async () => {
        throw new DriverApiHttpError({ endpoint: '/api/v1/rider/me/dispatch-orders/x/complete', status: 403 })
      },
    })

    const result = await completeDelivery('x', samplePhoto, service)
    assert.equal(result.kind, 'forbidden')
  })

  it('returns error with message on 422 DriverApiHttpError', async () => {
    const service = makeService({
      completeDelivery: async () => {
        throw new DriverApiHttpError({ endpoint: '/api/v1/rider/me/dispatch-orders/x/complete', status: 422 })
      },
    })

    const result = await completeDelivery('x', samplePhoto, service)
    assert.equal(result.kind, 'error')
    if (result.kind === 'error') {
      assert.ok(result.message.length > 0)
    }
  })

  it('returns error with message on generic Error', async () => {
    const service = makeService({
      completeDelivery: async () => {
        throw new Error('Upload failed')
      },
    })

    const result = await completeDelivery('x', samplePhoto, service)
    assert.equal(result.kind, 'error')
    if (result.kind === 'error') {
      assert.match(result.message, /upload failed/iu)
    }
  })

  it('passes the photo object through to the service', async () => {
    const capturedPhotos: { uri: string; name: string; type: string }[] = []
    const service = makeService({
      completeDelivery: async (_id, photo) => {
        capturedPhotos.push(photo)
        return makeOrder({ status: 'COMPLETED' })
      },
    })

    await completeDelivery('dispatch-1', samplePhoto, service)

    assert.equal(capturedPhotos.length, 1)
    assert.deepEqual(capturedPhotos[0], samplePhoto)
  })
})
