import { withNoStoreDriverApiRequest } from '../deliveryServer/driverApiRequestOptions'
import { DriverApiHttpError } from '../deliveryServer/driverApiError'

export type RiderAuthTokens = {
  tokenType: string
  accessToken: string
  expiresAt: string
  refreshToken: string
  refreshExpiresAt: string
  rider: unknown
}

export type RiderAuthService = {
  login(input: { phoneNumber: string; password: string }): Promise<RiderAuthTokens>
  refresh(input: { refreshToken: string }): Promise<RiderAuthTokens>
}

export function createRiderAuthService(deps: {
  baseUrl: string
  fetchImpl?: typeof fetch
}): RiderAuthService {
  const fetchImpl = deps.fetchImpl ?? fetch
  const base = deps.baseUrl.replace(/\/+$/u, '')

  async function request(endpoint: string, body: unknown): Promise<RiderAuthTokens> {
    const url = `${base}${endpoint}`
    const init = withNoStoreDriverApiRequest({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
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
    return parseRiderAuthTokens(json, endpoint)
  }

  return {
    login: (input) => request('/api/v1/rider-auth/login', input),
    refresh: (input) => request('/api/v1/rider-auth/refresh', input),
  }
}

function parseRiderAuthTokens(value: unknown, endpoint: string): RiderAuthTokens {
  if (
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(value)
  ) {
    throw new DriverApiHttpError({ endpoint, status: 'unknown' })
  }

  const obj = value as Record<string, unknown>

  if (
    typeof obj.tokenType !== 'string' ||
    typeof obj.accessToken !== 'string' ||
    typeof obj.expiresAt !== 'string' ||
    typeof obj.refreshToken !== 'string' ||
    typeof obj.refreshExpiresAt !== 'string' ||
    obj.rider === undefined
  ) {
    throw new DriverApiHttpError({ endpoint, status: 'unknown' })
  }

  return {
    tokenType: obj.tokenType,
    accessToken: obj.accessToken,
    expiresAt: obj.expiresAt,
    refreshToken: obj.refreshToken,
    refreshExpiresAt: obj.refreshExpiresAt,
    rider: obj.rider,
  }
}
