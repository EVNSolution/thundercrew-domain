import { DriverApiHttpError, isDriverApiUnauthorizedError } from '../../api/deliveryServer/driverApiError'
import type { RiderDispatchOrder, RiderDispatchService } from '../../api/thundercrew/riderDispatchClient'

export type RiderDeliveriesResult =
  | { kind: 'loaded'; assigned: RiderDispatchOrder[]; completed: RiderDispatchOrder[]; offered: RiderDispatchOrder[] }
  | { kind: 'unauthorized' }
  | { kind: 'error'; message: string }

export type RiderActionResult =
  | { kind: 'success'; order: RiderDispatchOrder }
  | { kind: 'unauthorized' }
  | { kind: 'forbidden' }
  | { kind: 'error'; message: string }

export async function acceptCall(
  orderId: string,
  service: RiderDispatchService,
): Promise<RiderActionResult> {
  try {
    const order = await service.acceptOfferedCall(orderId)
    return { kind: 'success', order }
  } catch (err) {
    if (isDriverApiUnauthorizedError(err)) {
      return { kind: 'unauthorized' }
    }
    if (err instanceof DriverApiHttpError && err.status === 403) {
      return { kind: 'forbidden' }
    }
    return {
      kind: 'error',
      message: err instanceof Error ? err.message : 'Failed to accept call.',
    }
  }
}

export async function completeDelivery(
  orderId: string,
  photo: { uri: string; name: string; type: string },
  service: RiderDispatchService,
): Promise<RiderActionResult> {
  try {
    const order = await service.completeDelivery(orderId, photo)
    return { kind: 'success', order }
  } catch (err) {
    if (isDriverApiUnauthorizedError(err)) {
      return { kind: 'unauthorized' }
    }
    if (err instanceof DriverApiHttpError && err.status === 403) {
      return { kind: 'forbidden' }
    }
    return {
      kind: 'error',
      message: err instanceof Error ? err.message : 'Failed to complete delivery.',
    }
  }
}

export async function loadRiderDeliveries(
  service: RiderDispatchService,
  options: { includeOffered?: boolean } = {},
): Promise<RiderDeliveriesResult> {
  // 비CALL 라이더는 대기 콜이 항상 비어 있으므로 조회를 건너뛴다.
  const includeOffered = options.includeOffered ?? true

  let assigned: RiderDispatchOrder[]
  let completed: RiderDispatchOrder[]
  let offered: RiderDispatchOrder[]

  try {
    ;[assigned, completed, offered] = await Promise.all([
      service.listAssigned(),
      service.listCompleted(),
      includeOffered ? service.listOfferedCalls() : Promise.resolve<RiderDispatchOrder[]>([]),
    ])
  } catch (err) {
    if (isDriverApiUnauthorizedError(err)) {
      return { kind: 'unauthorized' }
    }

    return {
      kind: 'error',
      message: err instanceof Error ? err.message : 'Failed to load deliveries.',
    }
  }

  const sortedAssigned = [...assigned].sort((a, b) => a.sequence - b.sequence)

  return { kind: 'loaded', assigned: sortedAssigned, completed, offered }
}
