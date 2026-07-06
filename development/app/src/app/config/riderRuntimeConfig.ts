import { createRiderAuthService, type RiderAuthService } from '../../api/thundercrew/riderAuthClient'
import { createRiderDispatchService, type RiderDispatchService } from '../../api/thundercrew/riderDispatchClient'

export type RiderRuntimeConfig =
  | { mode: 'mock' }
  | { mode: 'live'; thundercrewBaseUrl: string }

export function readRiderRuntimeConfig(
  env: Partial<Record<'EXPO_PUBLIC_THUNDERCREW_SERVICE_OPS_BASE_URL', string>>,
): RiderRuntimeConfig {
  const base = env.EXPO_PUBLIC_THUNDERCREW_SERVICE_OPS_BASE_URL?.trim()
  if (base === undefined || base === '') {
    return { mode: 'mock' }
  }

  return { mode: 'live', thundercrewBaseUrl: base }
}

/** Creates the auth service (pre-login) when running live; null in mock mode. */
export function createAuthService(config: RiderRuntimeConfig): RiderAuthService | null {
  if (config.mode !== 'live') return null
  return createRiderAuthService({ baseUrl: config.thundercrewBaseUrl })
}

/** Creates the dispatch service (post-login) from an accessToken; null in mock mode. */
export function createDispatchService(config: RiderRuntimeConfig, accessToken: string): RiderDispatchService | null {
  if (config.mode !== 'live') return null
  return createRiderDispatchService({ baseUrl: config.thundercrewBaseUrl, accessToken })
}
