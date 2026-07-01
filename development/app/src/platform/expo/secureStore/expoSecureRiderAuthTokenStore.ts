import * as SecureStore from 'expo-secure-store'

import { createRiderAuthTokenStore, type RiderAuthTokenStore } from '../../../domain/riderAuth/riderAuthTokenStore'

export function createExpoSecureRiderAuthTokenStore(): RiderAuthTokenStore {
  return createRiderAuthTokenStore({ storage: SecureStore })
}
