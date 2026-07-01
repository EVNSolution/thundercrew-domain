import { isDriverApiUnauthorizedError } from '../../api/deliveryServer/driverApiError'
import type { RiderStation, RiderTip } from '../../api/thundercrew/riderProfileClient'

export type { RiderStation, RiderTip }

export type RiderMapService = {
  getTips(): Promise<RiderTip[]>
  getStations(): Promise<RiderStation[]>
}

export type RiderMapResult =
  | { kind: 'loaded'; tips: RiderTip[]; stations: RiderStation[] }
  | { kind: 'unauthorized' }
  | { kind: 'error'; message: string }

export async function loadRiderMapData(service: RiderMapService): Promise<RiderMapResult> {
  let tips: RiderTip[]
  let stations: RiderStation[]

  try {
    ;[tips, stations] = await Promise.all([service.getTips(), service.getStations()])
  } catch (err) {
    if (isDriverApiUnauthorizedError(err)) {
      return { kind: 'unauthorized' }
    }

    return {
      kind: 'error',
      message: err instanceof Error ? err.message : 'Failed to load map data.',
    }
  }

  return { kind: 'loaded', tips, stations }
}
