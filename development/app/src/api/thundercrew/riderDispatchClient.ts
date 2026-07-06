import { withNoStoreDriverApiRequest } from '../deliveryServer/driverApiRequestOptions'
import { DriverApiHttpError } from '../deliveryServer/driverApiError'

export type RiderDispatchOrder = {
  id: string
  idx: number
  bikeId: string | null
  customerName: string
  customerPhone: string
  address: string
  latitude: number
  longitude: number
  originAddress: string | null
  originLatitude: number | null
  originLongitude: number | null
  sequence: number
  status: 'OFFERED' | 'ASSIGNED' | 'COMPLETED'
  kind: 'PICKUP' | 'DELIVERY'
  completedAt: string | null
  createdAt: string
  completedBy: string | null
  hasCompletionPhoto: boolean
}

export type RiderDispatchService = {
  listAssigned(): Promise<RiderDispatchOrder[]>
  listCompleted(): Promise<RiderDispatchOrder[]>
  listOfferedCalls(): Promise<RiderDispatchOrder[]>
  acceptOfferedCall(orderId: string): Promise<RiderDispatchOrder>
  completeDelivery(orderId: string, photo: { uri: string; name: string; type: string }): Promise<RiderDispatchOrder>
}

export function createRiderDispatchService(deps: {
  baseUrl: string
  accessToken: string
  fetchImpl?: typeof fetch
}): RiderDispatchService {
  const fetchImpl = deps.fetchImpl ?? fetch
  const base = deps.baseUrl.replace(/\/+$/u, '')

  async function getOrders(endpoint: string): Promise<RiderDispatchOrder[]> {
    const url = `${base}${endpoint}`
    const init = withNoStoreDriverApiRequest({
      method: 'GET',
      headers: { Authorization: `Bearer ${deps.accessToken}` },
    })

    let response: Awaited<ReturnType<typeof fetch>>
    try {
      response = await fetchImpl(url, init)
    } catch {
      throw new DriverApiHttpError({ endpoint, status: 'unknown' })
    }

    if (!response.ok) {
      throw new DriverApiHttpError({ endpoint, status: response.status })
    }

    const json: unknown = await response.json()

    if (!Array.isArray(json)) {
      throw new DriverApiHttpError({ endpoint, status: 'unknown' })
    }

    return json.map((item: unknown) => parseDispatchOrder(item, endpoint))
  }

  async function postSingleOrder(endpoint: string): Promise<RiderDispatchOrder> {
    const url = `${base}${endpoint}`
    const init = withNoStoreDriverApiRequest({
      method: 'POST',
      headers: { Authorization: `Bearer ${deps.accessToken}` },
    })

    let response: Awaited<ReturnType<typeof fetch>>
    try {
      response = await fetchImpl(url, init)
    } catch {
      throw new DriverApiHttpError({ endpoint, status: 'unknown' })
    }

    if (!response.ok) {
      throw new DriverApiHttpError({ endpoint, status: response.status })
    }

    const json: unknown = await response.json()
    return parseDispatchOrder(json, endpoint)
  }

  async function postMultipartOrder(
    endpoint: string,
    photo: { uri: string; name: string; type: string },
  ): Promise<RiderDispatchOrder> {
    const url = `${base}${endpoint}`
    const formData = new FormData()
    formData.append('photo', { uri: photo.uri, name: photo.name, type: photo.type } as unknown as Blob)

    // withNoStoreDriverApiRequest only adds Cache-Control and Pragma headers —
    // it does NOT set Content-Type, so fetch can set the multipart boundary itself.
    const baseInit = withNoStoreDriverApiRequest({
      method: 'POST',
      headers: { Authorization: `Bearer ${deps.accessToken}` },
    })
    const init = { ...baseInit, body: formData }

    let response: Awaited<ReturnType<typeof fetch>>
    try {
      response = await fetchImpl(url, init as Parameters<typeof fetch>[1])
    } catch {
      throw new DriverApiHttpError({ endpoint, status: 'unknown' })
    }

    if (!response.ok) {
      throw new DriverApiHttpError({ endpoint, status: response.status })
    }

    const json: unknown = await response.json()
    return parseDispatchOrder(json, endpoint)
  }

  return {
    listAssigned: () => getOrders('/api/v1/rider/me/dispatch-orders'),
    listCompleted: () => getOrders('/api/v1/rider/me/dispatch-orders/completed'),
    listOfferedCalls: () => getOrders('/api/v1/rider/me/offered-calls'),
    acceptOfferedCall: (orderId) =>
      postSingleOrder(`/api/v1/rider/me/offered-calls/${orderId}/accept`),
    completeDelivery: (orderId, photo) =>
      postMultipartOrder(`/api/v1/rider/me/dispatch-orders/${orderId}/complete`, photo),
  }
}

function parseDispatchOrder(value: unknown, endpoint: string): RiderDispatchOrder {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new DriverApiHttpError({ endpoint, status: 'unknown' })
  }

  const obj = value as Record<string, unknown>

  if (
    typeof obj.id !== 'string' ||
    typeof obj.idx !== 'number' ||
    typeof obj.customerName !== 'string' ||
    typeof obj.customerPhone !== 'string' ||
    typeof obj.address !== 'string' ||
    typeof obj.latitude !== 'number' ||
    typeof obj.longitude !== 'number' ||
    typeof obj.sequence !== 'number' ||
    typeof obj.createdAt !== 'string' ||
    typeof obj.hasCompletionPhoto !== 'boolean'
  ) {
    throw new DriverApiHttpError({ endpoint, status: 'unknown' })
  }

  const status = obj.status
  if (status !== 'OFFERED' && status !== 'ASSIGNED' && status !== 'COMPLETED') {
    throw new DriverApiHttpError({ endpoint, status: 'unknown' })
  }

  const kind = obj.kind
  if (kind !== 'PICKUP' && kind !== 'DELIVERY') {
    throw new DriverApiHttpError({ endpoint, status: 'unknown' })
  }

  return {
    id: obj.id,
    idx: obj.idx,
    // OFFERED 콜은 수락 전까지 차량 미배정이라 백엔드가 bikeId=null 을 준다 → nullable 수용.
    bikeId: typeof obj.bikeId === 'string' ? obj.bikeId : null,
    customerName: obj.customerName,
    customerPhone: obj.customerPhone,
    address: obj.address,
    latitude: obj.latitude,
    longitude: obj.longitude,
    // 출발지(origin)는 DELIVERY 주문엔 없어 백엔드가 null 을 준다 → nullable 로 수용.
    originAddress: typeof obj.originAddress === 'string' ? obj.originAddress : null,
    originLatitude: typeof obj.originLatitude === 'number' ? obj.originLatitude : null,
    originLongitude: typeof obj.originLongitude === 'number' ? obj.originLongitude : null,
    sequence: obj.sequence,
    status,
    kind,
    completedAt: typeof obj.completedAt === 'string' ? obj.completedAt : null,
    createdAt: obj.createdAt,
    completedBy: typeof obj.completedBy === 'string' ? obj.completedBy : null,
    hasCompletionPhoto: obj.hasCompletionPhoto,
  }
}
