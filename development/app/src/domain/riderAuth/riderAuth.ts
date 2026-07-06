import { normalizeDriverPhoneEntry } from '../phone/phoneEntry'
import { isDriverApiUnauthorizedError } from '../../api/deliveryServer/driverApiError'
import type { RiderAuthService, RiderAuthTokens } from '../../api/thundercrew/riderAuthClient'

export type RiderAuthLoginResult =
  | { kind: 'success'; tokens: RiderAuthTokens }
  | { kind: 'invalid_credentials' }
  | { kind: 'error'; message: string }

export async function loginRider(
  input: { phoneNumber: string; name: string },
  service: RiderAuthService,
): Promise<RiderAuthLoginResult> {
  const normalized = normalizeDriverPhoneEntry({
    countryIso2: inferCountryFromE164(input.phoneNumber),
    nationalPhoneInput: input.phoneNumber,
  })

  // Accept pre-normalized E.164 strings (already include +countrycode) — if
  // normalizeDriverPhoneEntry rejects it, fall back to checking directly that it
  // looks like an E.164 number.
  const phoneNumber = normalized.ok ? normalized.phoneE164 : tryAcceptE164(input.phoneNumber)

  if (phoneNumber === null) {
    return { kind: 'error', message: 'Enter a valid phone number including country code.' }
  }

  if (input.name.trim().length === 0) {
    return { kind: 'error', message: 'Name is required.' }
  }

  try {
    const tokens = await service.login({ phoneNumber, name: input.name.trim() })
    return { kind: 'success', tokens }
  } catch (err) {
    if (isDriverApiUnauthorizedError(err)) {
      return { kind: 'invalid_credentials' }
    }

    return {
      kind: 'error',
      message: err instanceof Error ? err.message : 'Login failed. Please try again.',
    }
  }
}

// Attempt to infer a country from an E.164-style string so we can pass it to
// normalizeDriverPhoneEntry. If the string isn't E.164 this will fail and we
// fall through to tryAcceptE164.
function inferCountryFromE164(phone: string): string {
  // We only need a plausible iso2 to let normalizeDriverPhoneEntry validate;
  // pass empty string so it will return ok:false and we fall through.
  return ''
}

// Accept a string that already looks like E.164 (+digits, 8–16 chars total).
function tryAcceptE164(phone: string): string | null {
  const trimmed = phone.trim()
  if (/^\+\d{7,15}$/u.test(trimmed)) {
    return trimmed
  }
  return null
}
