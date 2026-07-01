import { withNoStoreDriverApiRequest } from '../deliveryServer/driverApiRequestOptions'
import { DriverApiHttpError } from '../deliveryServer/driverApiError'

export type RiderVehicleInfo = {
  bikeId: string
  plateNumber: string
  imei: string
  serviceType: string
  currentLatitude: number | null
  currentLongitude: number | null
  odometerKm: number | null
  connectionStatus: string | null
  lastReceivedAt: string | null
}

export type RiderMaintenanceItem = {
  id: string
  idx: number
  name: string
  categories: string[]
  cycleKm: number | null
  cycleMonths: number | null
  memo: string
  alertThresholdPercent: number | null
  createdAt: string
  updatedAt: string
}

export type RiderMaintenanceRecord = {
  id: string
  idx: number
  bikeId: string
  itemId: string
  servicedAt: string
  servicedAtOdometerKm: number | null
  memo: string
  createdAt: string
  updatedAt: string
}

export type RiderNotification = {
  id: string
  idx: number
  type: string
  title: string
  body: string
  refBikeId: string | null
  refEntityId: string | null
  refRiderId: string | null
  occurredAt: string
  acknowledgedAt: string | null
  createdAt: string
}

export type RiderTip = {
  id: string
  idx: number
  address: string
  content: string
  latitude: number
  longitude: number
  status: 'PUBLISHED'
  submittedByRiderId: string
  createdAt: string
  updatedAt: string
}

export type RiderStation = {
  id: string
  idx: number
  name: string
  address: string
  latitude: number
  longitude: number
  status: 'ACTIVE'
  maxBatteryCapacity: number
  currentBatteryCount: number
  availableBatteryCount: number
  availableBatteryLabel: string
  capacityPercentage: number
  memo: string
  createdAt: string
  updatedAt: string
}

export type RiderProfileService = {
  getVehicle(): Promise<RiderVehicleInfo | null>
  getMaintenance(): Promise<{ items: RiderMaintenanceItem[]; records: RiderMaintenanceRecord[] }>
  listNotifications(): Promise<RiderNotification[]>
  getTips(): Promise<RiderTip[]>
  getStations(): Promise<RiderStation[]>
}

export function createRiderProfileService(deps: {
  baseUrl: string
  accessToken: string
  fetchImpl?: typeof fetch
}): RiderProfileService {
  const fetchImpl = deps.fetchImpl ?? fetch
  const base = deps.baseUrl.replace(/\/+$/u, '')

  async function getJson(endpoint: string): Promise<unknown> {
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

    return response.json()
  }

  return {
    async getVehicle(): Promise<RiderVehicleInfo | null> {
      const endpoint = '/api/v1/rider/me/vehicle'
      const json = await getJson(endpoint)

      // Tolerate empty object (no-vehicle rider)
      if (typeof json !== 'object' || json === null || Array.isArray(json)) {
        return null
      }

      const obj = json as Record<string, unknown>

      // Empty object means no vehicle
      if (Object.keys(obj).length === 0) {
        return null
      }

      if (
        typeof obj.bikeId !== 'string' ||
        typeof obj.plateNumber !== 'string' ||
        typeof obj.imei !== 'string' ||
        typeof obj.serviceType !== 'string'
      ) {
        return null
      }

      return {
        bikeId: obj.bikeId,
        plateNumber: obj.plateNumber,
        imei: obj.imei,
        serviceType: obj.serviceType,
        currentLatitude: typeof obj.currentLatitude === 'number' ? obj.currentLatitude : null,
        currentLongitude: typeof obj.currentLongitude === 'number' ? obj.currentLongitude : null,
        odometerKm: typeof obj.odometerKm === 'number' ? obj.odometerKm : null,
        connectionStatus: typeof obj.connectionStatus === 'string' ? obj.connectionStatus : null,
        lastReceivedAt: typeof obj.lastReceivedAt === 'string' ? obj.lastReceivedAt : null,
      }
    },

    async getMaintenance(): Promise<{ items: RiderMaintenanceItem[]; records: RiderMaintenanceRecord[] }> {
      const endpoint = '/api/v1/rider/me/maintenance'
      const json = await getJson(endpoint)

      if (typeof json !== 'object' || json === null || Array.isArray(json)) {
        throw new DriverApiHttpError({ endpoint, status: 'unknown' })
      }

      const obj = json as Record<string, unknown>
      const rawItems = obj.items
      const rawRecords = obj.records

      if (!Array.isArray(rawItems) || !Array.isArray(rawRecords)) {
        throw new DriverApiHttpError({ endpoint, status: 'unknown' })
      }

      const items: RiderMaintenanceItem[] = rawItems.map((item: unknown) =>
        parseMaintenanceItem(item, endpoint),
      )
      const records: RiderMaintenanceRecord[] = rawRecords.map((record: unknown) =>
        parseMaintenanceRecord(record, endpoint),
      )

      return { items, records }
    },

    async listNotifications(): Promise<RiderNotification[]> {
      const endpoint = '/api/v1/rider/me/notifications'
      const json = await getJson(endpoint)

      if (!Array.isArray(json)) {
        throw new DriverApiHttpError({ endpoint, status: 'unknown' })
      }

      return json.map((item: unknown) => parseNotification(item, endpoint))
    },

    async getTips(): Promise<RiderTip[]> {
      const endpoint = '/api/v1/rider/me/tips'
      const json = await getJson(endpoint)

      if (!Array.isArray(json)) {
        throw new DriverApiHttpError({ endpoint, status: 'unknown' })
      }

      return json.map((item: unknown) => parseTip(item, endpoint))
    },

    async getStations(): Promise<RiderStation[]> {
      const endpoint = '/api/v1/rider/me/stations'
      const json = await getJson(endpoint)

      if (!Array.isArray(json)) {
        throw new DriverApiHttpError({ endpoint, status: 'unknown' })
      }

      const stations: RiderStation[] = []
      for (const item of json) {
        const station = parseStation(item, endpoint)
        if (station !== null) {
          stations.push(station)
        }
      }
      return stations
    },
  }
}

function parseMaintenanceItem(value: unknown, endpoint: string): RiderMaintenanceItem {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new DriverApiHttpError({ endpoint, status: 'unknown' })
  }

  const obj = value as Record<string, unknown>

  if (
    typeof obj.id !== 'string' ||
    typeof obj.idx !== 'number' ||
    typeof obj.name !== 'string' ||
    !Array.isArray(obj.categories) ||
    typeof obj.memo !== 'string' ||
    typeof obj.createdAt !== 'string' ||
    typeof obj.updatedAt !== 'string'
  ) {
    throw new DriverApiHttpError({ endpoint, status: 'unknown' })
  }

  return {
    id: obj.id,
    idx: obj.idx,
    name: obj.name,
    categories: (obj.categories as unknown[]).map((c) => String(c)),
    cycleKm: typeof obj.cycleKm === 'number' ? obj.cycleKm : null,
    cycleMonths: typeof obj.cycleMonths === 'number' ? obj.cycleMonths : null,
    memo: obj.memo,
    alertThresholdPercent: typeof obj.alertThresholdPercent === 'number' ? obj.alertThresholdPercent : null,
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
  }
}

function parseMaintenanceRecord(value: unknown, endpoint: string): RiderMaintenanceRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new DriverApiHttpError({ endpoint, status: 'unknown' })
  }

  const obj = value as Record<string, unknown>

  if (
    typeof obj.id !== 'string' ||
    typeof obj.idx !== 'number' ||
    typeof obj.bikeId !== 'string' ||
    typeof obj.itemId !== 'string' ||
    typeof obj.servicedAt !== 'string' ||
    typeof obj.memo !== 'string' ||
    typeof obj.createdAt !== 'string' ||
    typeof obj.updatedAt !== 'string'
  ) {
    throw new DriverApiHttpError({ endpoint, status: 'unknown' })
  }

  return {
    id: obj.id,
    idx: obj.idx,
    bikeId: obj.bikeId,
    itemId: obj.itemId,
    servicedAt: obj.servicedAt,
    servicedAtOdometerKm: typeof obj.servicedAtOdometerKm === 'number' ? obj.servicedAtOdometerKm : null,
    memo: obj.memo,
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
  }
}

function parseNotification(value: unknown, endpoint: string): RiderNotification {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new DriverApiHttpError({ endpoint, status: 'unknown' })
  }

  const obj = value as Record<string, unknown>

  if (
    typeof obj.id !== 'string' ||
    typeof obj.idx !== 'number' ||
    typeof obj.type !== 'string' ||
    typeof obj.title !== 'string' ||
    typeof obj.body !== 'string' ||
    typeof obj.occurredAt !== 'string' ||
    typeof obj.createdAt !== 'string'
  ) {
    throw new DriverApiHttpError({ endpoint, status: 'unknown' })
  }

  return {
    id: obj.id,
    idx: obj.idx,
    type: obj.type,
    title: obj.title,
    body: obj.body,
    refBikeId: typeof obj.refBikeId === 'string' ? obj.refBikeId : null,
    refEntityId: typeof obj.refEntityId === 'string' ? obj.refEntityId : null,
    refRiderId: typeof obj.refRiderId === 'string' ? obj.refRiderId : null,
    occurredAt: obj.occurredAt,
    acknowledgedAt: typeof obj.acknowledgedAt === 'string' ? obj.acknowledgedAt : null,
    createdAt: obj.createdAt,
  }
}

function parseTip(value: unknown, endpoint: string): RiderTip {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new DriverApiHttpError({ endpoint, status: 'unknown' })
  }

  const obj = value as Record<string, unknown>

  if (
    typeof obj.id !== 'string' ||
    typeof obj.idx !== 'number' ||
    typeof obj.address !== 'string' ||
    typeof obj.content !== 'string' ||
    typeof obj.submittedByRiderId !== 'string' ||
    typeof obj.createdAt !== 'string' ||
    typeof obj.updatedAt !== 'string'
  ) {
    throw new DriverApiHttpError({ endpoint, status: 'unknown' })
  }

  const latitude = Number(obj.latitude)
  const longitude = Number(obj.longitude)

  if (isNaN(latitude) || isNaN(longitude)) {
    throw new DriverApiHttpError({ endpoint, status: 'unknown' })
  }

  return {
    id: obj.id,
    idx: obj.idx,
    address: obj.address,
    content: obj.content,
    latitude,
    longitude,
    status: 'PUBLISHED',
    submittedByRiderId: obj.submittedByRiderId,
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
  }
}

// Returns null when lat/lng are NaN so the caller can skip the entry.
function parseStation(value: unknown, endpoint: string): RiderStation | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new DriverApiHttpError({ endpoint, status: 'unknown' })
  }

  const obj = value as Record<string, unknown>

  if (
    typeof obj.id !== 'string' ||
    typeof obj.idx !== 'number' ||
    typeof obj.name !== 'string' ||
    typeof obj.address !== 'string' ||
    typeof obj.availableBatteryLabel !== 'string' ||
    typeof obj.memo !== 'string' ||
    typeof obj.createdAt !== 'string' ||
    typeof obj.updatedAt !== 'string'
  ) {
    throw new DriverApiHttpError({ endpoint, status: 'unknown' })
  }

  const latitude = Number(obj.latitude)
  const longitude = Number(obj.longitude)

  // Backend may serialize BigDecimal as string — coerce; skip entry if invalid.
  if (isNaN(latitude) || isNaN(longitude)) {
    return null
  }

  return {
    id: obj.id,
    idx: obj.idx,
    name: obj.name,
    address: obj.address,
    latitude,
    longitude,
    status: 'ACTIVE',
    maxBatteryCapacity: typeof obj.maxBatteryCapacity === 'number' ? obj.maxBatteryCapacity : 0,
    currentBatteryCount: typeof obj.currentBatteryCount === 'number' ? obj.currentBatteryCount : 0,
    availableBatteryCount: typeof obj.availableBatteryCount === 'number' ? obj.availableBatteryCount : 0,
    availableBatteryLabel: obj.availableBatteryLabel,
    capacityPercentage: typeof obj.capacityPercentage === 'number' ? obj.capacityPercentage : 0,
    memo: obj.memo,
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
  }
}
