import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { createRiderDispatchService } from './riderDispatchClient'
import { DriverApiHttpError } from '../deliveryServer/driverApiError'

const sampleOrder = {
  id: 'order-1',
  idx: 1,
  bikeId: 'bike-1',
  customerName: 'John Doe',
  customerPhone: '+12125550100',
  address: '123 Main St',
  latitude: 37.7749,
  longitude: -122.4194,
  originAddress: '456 Origin Ave',
  originLatitude: 37.7850,
  originLongitude: -122.4100,
  sequence: 1,
  status: 'ASSIGNED' as const,
  kind: 'DELIVERY' as const,
  completedAt: null,
  createdAt: '2026-07-01T10:00:00.000Z',
  completedBy: null,
  hasCompletionPhoto: false,
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

describe('createRiderDispatchService', () => {
  describe('listAssigned', () => {
    it('sends GET to /api/v1/rider/me/dispatch-orders with Authorization header', async () => {
      const requests: { url: string; method: string; headers: Record<string, string> }[] = []

      const service = createRiderDispatchService({
        baseUrl: 'https://tc.example.com',
        accessToken: 'my-token',
        fetchImpl: async (url, init) => {
          requests.push({
            url: String(url),
            method: String(init?.method),
            headers: (init?.headers as Record<string, string>) ?? {},
          })
          return { ok: true, status: 200, json: async () => [sampleOrder] } as Response
        },
      })

      await service.listAssigned()

      assert.equal(requests.length, 1)
      assert.equal(requests[0]?.url, 'https://tc.example.com/api/v1/rider/me/dispatch-orders')
      assert.equal(requests[0]?.method, 'GET')
      assert.equal(requests[0]?.headers['Authorization'], 'Bearer my-token')
    })

    it('maps 200 array body to RiderDispatchOrder[]', async () => {
      const service = createRiderDispatchService({
        baseUrl: 'https://tc.example.com',
        accessToken: 'my-token',
        fetchImpl: makeOkFetch([sampleOrder]),
      })

      const orders = await service.listAssigned()

      assert.equal(orders.length, 1)
      assert.equal(orders[0]?.id, 'order-1')
      assert.equal(orders[0]?.customerName, 'John Doe')
      assert.equal(orders[0]?.status, 'ASSIGNED')
      assert.equal(orders[0]?.kind, 'DELIVERY')
      assert.equal(orders[0]?.hasCompletionPhoto, false)
    })

    it('accepts null origin fields (DELIVERY order without pickup origin)', async () => {
      const nullOriginOrder = {
        ...sampleOrder,
        originAddress: null,
        originLatitude: null,
        originLongitude: null,
      }
      const service = createRiderDispatchService({
        baseUrl: 'https://tc.example.com',
        accessToken: 'my-token',
        fetchImpl: makeOkFetch([nullOriginOrder]),
      })

      const orders = await service.listAssigned()

      assert.equal(orders.length, 1)
      assert.equal(orders[0]?.originAddress, null)
      assert.equal(orders[0]?.originLatitude, null)
      assert.equal(orders[0]?.originLongitude, null)
    })

    it('accepts null bikeId (OFFERED call not yet assigned to a vehicle)', async () => {
      const offeredCall = {
        ...sampleOrder,
        bikeId: null,
        status: 'OFFERED' as const,
      }
      const service = createRiderDispatchService({
        baseUrl: 'https://tc.example.com',
        accessToken: 'my-token',
        fetchImpl: makeOkFetch([offeredCall]),
      })

      const orders = await service.listAssigned()

      assert.equal(orders.length, 1)
      assert.equal(orders[0]?.bikeId, null)
      assert.equal(orders[0]?.status, 'OFFERED')
    })

    it('throws DriverApiHttpError with status 401 on 401 response', async () => {
      const service = createRiderDispatchService({
        baseUrl: 'https://tc.example.com',
        accessToken: 'expired-token',
        fetchImpl: makeErrorFetch(401),
      })

      await assert.rejects(
        () => service.listAssigned(),
        (err: unknown) => {
          assert.ok(err instanceof DriverApiHttpError)
          assert.equal(err.status, 401)
          return true
        },
      )
    })

    it('throws DriverApiHttpError on non-2xx response', async () => {
      const service = createRiderDispatchService({
        baseUrl: 'https://tc.example.com',
        accessToken: 'my-token',
        fetchImpl: makeErrorFetch(500),
      })

      await assert.rejects(
        () => service.listAssigned(),
        (err: unknown) => {
          assert.ok(err instanceof DriverApiHttpError)
          assert.equal(err.status, 500)
          return true
        },
      )
    })

    it('throws DriverApiHttpError when body is not an array', async () => {
      const service = createRiderDispatchService({
        baseUrl: 'https://tc.example.com',
        accessToken: 'my-token',
        fetchImpl: makeOkFetch({ data: [] }), // object instead of array
      })

      await assert.rejects(
        () => service.listAssigned(),
        (err: unknown) => {
          assert.ok(err instanceof DriverApiHttpError)
          return true
        },
      )
    })

    it('tolerates null completedAt and completedBy (optional fields)', async () => {
      const orderWithNulls = { ...sampleOrder, completedAt: null, completedBy: null }
      const service = createRiderDispatchService({
        baseUrl: 'https://tc.example.com',
        accessToken: 'my-token',
        fetchImpl: makeOkFetch([orderWithNulls]),
      })

      const orders = await service.listAssigned()
      assert.equal(orders[0]?.completedAt, null)
      assert.equal(orders[0]?.completedBy, null)
    })
  })

  describe('listCompleted', () => {
    it('sends GET to /api/v1/rider/me/dispatch-orders/completed with Authorization header', async () => {
      const requests: { url: string; method: string; headers: Record<string, string> }[] = []

      const service = createRiderDispatchService({
        baseUrl: 'https://tc.example.com',
        accessToken: 'my-token',
        fetchImpl: async (url, init) => {
          requests.push({
            url: String(url),
            method: String(init?.method),
            headers: (init?.headers as Record<string, string>) ?? {},
          })
          return { ok: true, status: 200, json: async () => [] } as Response
        },
      })

      await service.listCompleted()

      assert.equal(requests[0]?.url, 'https://tc.example.com/api/v1/rider/me/dispatch-orders/completed')
      assert.equal(requests[0]?.method, 'GET')
      assert.equal(requests[0]?.headers['Authorization'], 'Bearer my-token')
    })

    it('returns empty array when response is an empty array', async () => {
      const service = createRiderDispatchService({
        baseUrl: 'https://tc.example.com',
        accessToken: 'my-token',
        fetchImpl: makeOkFetch([]),
      })

      const orders = await service.listCompleted()
      assert.equal(orders.length, 0)
    })
  })

  describe('listOfferedCalls', () => {
    it('sends GET to /api/v1/rider/me/offered-calls with Authorization header', async () => {
      const requests: { url: string; method: string; headers: Record<string, string> }[] = []

      const service = createRiderDispatchService({
        baseUrl: 'https://tc.example.com',
        accessToken: 'my-token',
        fetchImpl: async (url, init) => {
          requests.push({
            url: String(url),
            method: String(init?.method),
            headers: (init?.headers as Record<string, string>) ?? {},
          })
          return { ok: true, status: 200, json: async () => [] } as Response
        },
      })

      await service.listOfferedCalls()

      assert.equal(requests[0]?.url, 'https://tc.example.com/api/v1/rider/me/offered-calls')
      assert.equal(requests[0]?.method, 'GET')
      assert.equal(requests[0]?.headers['Authorization'], 'Bearer my-token')
    })

    it('throws DriverApiHttpError with status 401 on 401 response', async () => {
      const service = createRiderDispatchService({
        baseUrl: 'https://tc.example.com',
        accessToken: 'expired-token',
        fetchImpl: makeErrorFetch(401),
      })

      await assert.rejects(
        () => service.listOfferedCalls(),
        (err: unknown) => {
          assert.ok(err instanceof DriverApiHttpError)
          assert.equal(err.status, 401)
          return true
        },
      )
    })
  })

  describe('acceptOfferedCall', () => {
    it('sends POST to the correct URL with Authorization header and no body', async () => {
      const requests: { url: string; method: string; headers: Record<string, string>; body: unknown }[] = []

      const service = createRiderDispatchService({
        baseUrl: 'https://tc.example.com',
        accessToken: 'my-token',
        fetchImpl: async (url, init) => {
          requests.push({
            url: String(url),
            method: String(init?.method),
            headers: (init?.headers as Record<string, string>) ?? {},
            body: (init as { body?: unknown })?.body,
          })
          return { ok: true, status: 200, json: async () => ({ ...sampleOrder, status: 'ASSIGNED' }) } as Response
        },
      })

      await service.acceptOfferedCall('offer-abc')

      assert.equal(requests.length, 1)
      assert.equal(requests[0]?.url, 'https://tc.example.com/api/v1/rider/me/offered-calls/offer-abc/accept')
      assert.equal(requests[0]?.method, 'POST')
      assert.equal(requests[0]?.headers['Authorization'], 'Bearer my-token')
      assert.equal(requests[0]?.body, undefined)
    })

    it('maps 200 single-object response to RiderDispatchOrder', async () => {
      const service = createRiderDispatchService({
        baseUrl: 'https://tc.example.com',
        accessToken: 'my-token',
        fetchImpl: makeOkFetch({ ...sampleOrder, status: 'ASSIGNED' }),
      })

      const order = await service.acceptOfferedCall('offer-abc')

      assert.equal(order.id, 'order-1')
      assert.equal(order.status, 'ASSIGNED')
    })

    it('throws DriverApiHttpError with status 401 on 401 response', async () => {
      const service = createRiderDispatchService({
        baseUrl: 'https://tc.example.com',
        accessToken: 'expired-token',
        fetchImpl: makeErrorFetch(401),
      })

      await assert.rejects(
        () => service.acceptOfferedCall('offer-abc'),
        (err: unknown) => {
          assert.ok(err instanceof DriverApiHttpError)
          assert.equal(err.status, 401)
          return true
        },
      )
    })

    it('throws DriverApiHttpError with status 409 on conflict response', async () => {
      const service = createRiderDispatchService({
        baseUrl: 'https://tc.example.com',
        accessToken: 'my-token',
        fetchImpl: makeErrorFetch(409),
      })

      await assert.rejects(
        () => service.acceptOfferedCall('offer-abc'),
        (err: unknown) => {
          assert.ok(err instanceof DriverApiHttpError)
          assert.equal(err.status, 409)
          return true
        },
      )
    })
  })

  describe('completeDelivery', () => {
    it('sends POST to the correct URL with Authorization header and multipart FormData body', async () => {
      const requests: { url: string; method: string; headers: Record<string, string>; body: unknown }[] = []

      const service = createRiderDispatchService({
        baseUrl: 'https://tc.example.com',
        accessToken: 'my-token',
        fetchImpl: async (url, init) => {
          requests.push({
            url: String(url),
            method: String(init?.method),
            headers: (init?.headers as Record<string, string>) ?? {},
            body: (init as { body?: unknown })?.body,
          })
          return { ok: true, status: 200, json: async () => ({ ...sampleOrder, status: 'COMPLETED' }) } as Response
        },
      })

      await service.completeDelivery('dispatch-xyz', { uri: 'file:///tmp/photo.jpg', name: 'completion.jpg', type: 'image/jpeg' })

      assert.equal(requests.length, 1)
      assert.equal(requests[0]?.url, 'https://tc.example.com/api/v1/rider/me/dispatch-orders/dispatch-xyz/complete')
      assert.equal(requests[0]?.method, 'POST')
      assert.equal(requests[0]?.headers['Authorization'], 'Bearer my-token')
      // Content-Type must NOT be set manually — let fetch set the multipart boundary
      assert.equal(requests[0]?.headers['Content-Type'], undefined)
      // Body should be a FormData instance
      assert.ok(requests[0]?.body instanceof FormData)
    })

    it('maps 200 single-object response to RiderDispatchOrder with COMPLETED status', async () => {
      const service = createRiderDispatchService({
        baseUrl: 'https://tc.example.com',
        accessToken: 'my-token',
        fetchImpl: makeOkFetch({ ...sampleOrder, status: 'COMPLETED', hasCompletionPhoto: true }),
      })

      const order = await service.completeDelivery('dispatch-xyz', { uri: 'file:///tmp/photo.jpg', name: 'completion.jpg', type: 'image/jpeg' })

      assert.equal(order.id, 'order-1')
      assert.equal(order.status, 'COMPLETED')
      assert.equal(order.hasCompletionPhoto, true)
    })

    it('throws DriverApiHttpError with status 401 on 401 response', async () => {
      const service = createRiderDispatchService({
        baseUrl: 'https://tc.example.com',
        accessToken: 'expired-token',
        fetchImpl: makeErrorFetch(401),
      })

      await assert.rejects(
        () => service.completeDelivery('dispatch-xyz', { uri: 'file:///tmp/photo.jpg', name: 'completion.jpg', type: 'image/jpeg' }),
        (err: unknown) => {
          assert.ok(err instanceof DriverApiHttpError)
          assert.equal(err.status, 401)
          return true
        },
      )
    })

    it('throws DriverApiHttpError with status 403 on 403 response (not my order)', async () => {
      const service = createRiderDispatchService({
        baseUrl: 'https://tc.example.com',
        accessToken: 'my-token',
        fetchImpl: makeErrorFetch(403),
      })

      await assert.rejects(
        () => service.completeDelivery('dispatch-xyz', { uri: 'file:///tmp/photo.jpg', name: 'completion.jpg', type: 'image/jpeg' }),
        (err: unknown) => {
          assert.ok(err instanceof DriverApiHttpError)
          assert.equal(err.status, 403)
          return true
        },
      )
    })
  })
})
