import { isDriverApiUnauthorizedError } from '../../api/deliveryServer/driverApiError'
import type {
  RiderMaintenanceItem,
  RiderMaintenanceRecord,
  RiderNotification,
  RiderProfileService,
  RiderVehicleInfo,
} from '../../api/thundercrew/riderProfileClient'

export type RiderProfileResult =
  | {
      kind: 'loaded'
      vehicle: RiderVehicleInfo | null
      maintenance: { items: RiderMaintenanceItem[]; records: RiderMaintenanceRecord[] }
      notifications: RiderNotification[]
    }
  | { kind: 'unauthorized' }
  | { kind: 'error'; message: string }

export type MaintenanceStatus = 'ok' | 'due_soon' | 'overdue' | 'unknown'

/**
 * Derives maintenance status for a single maintenance item.
 *
 * Logic:
 * - If there is no record or no cycle defined → 'unknown'
 * - Compute consumed ratio from cycleKm (odometer delta) and/or cycleMonths (time since servicedAt)
 * - Take the worst ratio (max) across available dimensions
 * - ratio >= 1.0 → 'overdue'
 * - ratio >= alertThresholdPercent/100 (default 80% if null) → 'due_soon'
 * - else → 'ok'
 */
export function deriveMaintenanceStatus(
  item: RiderMaintenanceItem,
  latestRecord: RiderMaintenanceRecord | null,
  currentOdometerKm: number | null,
): MaintenanceStatus {
  if (latestRecord === null) {
    return 'unknown'
  }

  const hasCycleKm = item.cycleKm !== null
  const hasCycleMonths = item.cycleMonths !== null

  if (!hasCycleKm && !hasCycleMonths) {
    return 'unknown'
  }

  const threshold = item.alertThresholdPercent !== null ? item.alertThresholdPercent / 100 : 0.8

  let maxRatio = 0
  let hasValidDimension = false

  // Km dimension
  if (hasCycleKm && item.cycleKm !== null) {
    if (currentOdometerKm !== null && latestRecord.servicedAtOdometerKm !== null) {
      const consumed = currentOdometerKm - latestRecord.servicedAtOdometerKm
      const ratio = consumed / item.cycleKm
      maxRatio = Math.max(maxRatio, ratio)
      hasValidDimension = true
    }
  }

  // Months dimension
  if (hasCycleMonths && item.cycleMonths !== null) {
    const servicedDate = new Date(latestRecord.servicedAt)
    if (!isNaN(servicedDate.getTime())) {
      const nowMs = Date.now()
      const elapsedMs = nowMs - servicedDate.getTime()
      const elapsedMonths = elapsedMs / (1000 * 60 * 60 * 24 * 30.4375)
      const ratio = elapsedMonths / item.cycleMonths
      maxRatio = Math.max(maxRatio, ratio)
      hasValidDimension = true
    }
  }

  if (!hasValidDimension) {
    return 'unknown'
  }

  if (maxRatio >= 1.0) {
    return 'overdue'
  }

  if (maxRatio >= threshold) {
    return 'due_soon'
  }

  return 'ok'
}

export async function loadRiderProfile(service: RiderProfileService): Promise<RiderProfileResult> {
  let vehicle: RiderVehicleInfo | null
  let maintenance: { items: RiderMaintenanceItem[]; records: RiderMaintenanceRecord[] }
  let notifications: RiderNotification[]

  try {
    ;[vehicle, maintenance, notifications] = await Promise.all([
      service.getVehicle(),
      service.getMaintenance(),
      service.listNotifications(),
    ])
  } catch (err) {
    if (isDriverApiUnauthorizedError(err)) {
      return { kind: 'unauthorized' }
    }

    return {
      kind: 'error',
      message: err instanceof Error ? err.message : 'Failed to load vehicle profile.',
    }
  }

  return { kind: 'loaded', vehicle, maintenance, notifications }
}
