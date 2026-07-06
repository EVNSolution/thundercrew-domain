import { useEffect, useState } from 'react'

import { createExpoForegroundLocationPermissionService } from '../../platform/expo/location/expoLocationPermissionService'
import { createExpoForegroundLocationSnapshotService } from '../../platform/expo/location/expoForegroundLocationSnapshotService'

export type CurrentLocation = { latitude: number; longitude: number }

/**
 * Requests foreground location permission once on mount and, if granted,
 * returns a one-shot GPS snapshot of the rider's position.
 *
 * `origin` is null until a fix arrives, and stays null if the user denies
 * permission or the fix fails — callers fall back to destination-only.
 * The real-time blue dot itself is driven by the native map's location
 * tracking mode; this snapshot only seeds the initial camera framing.
 */
export function useCurrentLocation(): { origin: CurrentLocation | null } {
  const [origin, setOrigin] = useState<CurrentLocation | null>(null)

  useEffect(() => {
    let cancelled = false

    async function resolveLocation() {
      try {
        const permission = createExpoForegroundLocationPermissionService()
        const result = await permission.requestForegroundPermission()
        if (cancelled || result.status !== 'granted') {
          return
        }

        const snapshot = createExpoForegroundLocationSnapshotService()
        const fix = await snapshot.getCurrentForegroundLocation()
        if (cancelled) {
          return
        }
        setOrigin({ latitude: fix.latitude, longitude: fix.longitude })
      } catch {
        // 권한 거부·GPS 실패 → origin 유지(null) → 목적지만 표시.
      }
    }

    void resolveLocation()
    return () => {
      cancelled = true
    }
  }, [])

  return { origin }
}
