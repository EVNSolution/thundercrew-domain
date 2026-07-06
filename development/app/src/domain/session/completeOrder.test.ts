import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { completeOrderWithPhoto } from './completeOrder'
import type { ProofPhotoCaptureService } from '../proof/proofPhotoCapture'
import type { RiderDispatchOrder, RiderDispatchService } from '../../api/thundercrew/riderDispatchClient'

function makeOrder(overrides: Partial<RiderDispatchOrder> = {}): RiderDispatchOrder {
  return {
    id: 'order-1',
    idx: 1,
    bikeId: 'bike-1',
    customerName: 'Jane',
    customerPhone: '+12125550100',
    address: '123 Main St',
    latitude: 37.5,
    longitude: 127,
    originAddress: 'Origin',
    originLatitude: 37.4,
    originLongitude: 126.9,
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

function makeCaptureService(override?: Partial<ProofPhotoCaptureService>): ProofPhotoCaptureService {
  return {
    requestPermission: async () => 'granted',
    launchCapture: async () => ({ kind: 'captured', uri: 'file:///tmp/photo.jpg' }),
    ...override,
  }
}

function makeDispatch(override?: Partial<RiderDispatchService>): RiderDispatchService {
  return {
    listAssigned: async () => [],
    listCompleted: async () => [],
    listOfferedCalls: async () => [],
    acceptOfferedCall: async () => makeOrder({ status: 'ASSIGNED' }),
    completeDelivery: async () => makeOrder({ status: 'COMPLETED', hasCompletionPhoto: true }),
    ...override,
  }
}

describe('completeOrderWithPhoto', () => {
  it('captures a photo and completes the delivery on success', async () => {
    const calls: { orderId: string; photo: { uri: string; name: string; type: string } }[] = []
    const dispatch = makeDispatch({
      completeDelivery: async (orderId, photo) => {
        calls.push({ orderId, photo })
        return makeOrder({ status: 'COMPLETED', hasCompletionPhoto: true })
      },
    })
    const camera = makeCaptureService()

    const result = await completeOrderWithPhoto({ camera, dispatch, orderId: 'order-1' })

    assert.equal(result.kind, 'success')
    assert.equal(calls.length, 1)
    assert.equal(calls[0]?.orderId, 'order-1')
    assert.equal(calls[0]?.photo.uri, 'file:///tmp/photo.jpg')
    assert.equal(calls[0]?.photo.type, 'image/jpeg')
  })

  it('returns cancelled without calling completeDelivery when capture is cancelled', async () => {
    let completeCalled = false
    const dispatch = makeDispatch({
      completeDelivery: async () => {
        completeCalled = true
        return makeOrder({ status: 'COMPLETED' })
      },
    })
    const camera = makeCaptureService({ launchCapture: async () => ({ kind: 'cancelled' }) })

    const result = await completeOrderWithPhoto({ camera, dispatch, orderId: 'order-1' })

    assert.equal(result.kind, 'cancelled')
    assert.equal(completeCalled, false)
  })

  it('returns permission_denied without calling completeDelivery when permission is refused', async () => {
    let completeCalled = false
    const dispatch = makeDispatch({
      completeDelivery: async () => {
        completeCalled = true
        return makeOrder({ status: 'COMPLETED' })
      },
    })
    const camera = makeCaptureService({ requestPermission: async () => 'denied' })

    const result = await completeOrderWithPhoto({ camera, dispatch, orderId: 'order-1' })

    assert.equal(result.kind, 'permission_denied')
    assert.equal(completeCalled, false)
  })

  it('returns error when completeDelivery fails', async () => {
    const dispatch = makeDispatch({
      completeDelivery: async () => {
        throw new Error('upload failed')
      },
    })
    const camera = makeCaptureService()

    const result = await completeOrderWithPhoto({ camera, dispatch, orderId: 'order-1' })

    assert.equal(result.kind, 'error')
  })
})
