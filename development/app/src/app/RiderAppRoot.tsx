import { useCallback, useEffect, useMemo, useState } from 'react'
import { SafeAreaView, StyleSheet } from 'react-native'

import { createDispatchService, readRiderRuntimeConfig } from './config/riderRuntimeConfig'
import { createExpoSecureRiderAuthTokenStore } from '../platform/expo/secureStore/expoSecureRiderAuthTokenStore'
import { logoutSession, restoreSession } from '../domain/session/riderSession'
import { LoginScreen } from '../ui/screens/LoginScreen'
import { DispatchListScreen } from '../ui/screens/DispatchListScreen'
import { OrderDetailScreen } from '../ui/screens/OrderDetailScreen'
import type { RiderDispatchOrder } from '../api/thundercrew/riderDispatchClient'

type Phase = 'loading' | 'login' | 'list' | 'detail'

export default function RiderAppRoot() {
  const config = useMemo(() => readRiderRuntimeConfig(process.env as Record<string, string>), [])
  const store = useMemo(() => createExpoSecureRiderAuthTokenStore(), [])

  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [phase, setPhase] = useState<Phase>('loading')
  const [selectedOrder, setSelectedOrder] = useState<RiderDispatchOrder | null>(null)

  useEffect(() => {
    let cancelled = false
    restoreSession(store).then((result) => {
      if (cancelled) return
      if (result.kind === 'active') {
        setAccessToken(result.accessToken)
        setPhase('list')
      } else {
        setPhase('login')
      }
    })
    return () => {
      cancelled = true
    }
  }, [store])

  const dispatch = useMemo(
    () => (accessToken !== null ? createDispatchService(config, accessToken) : null),
    [config, accessToken],
  )

  const handleUnauthorized = useCallback(() => {
    logoutSession(store)
    setAccessToken(null)
    setSelectedOrder(null)
    setPhase('login')
  }, [store])

  return (
    <SafeAreaView style={styles.root}>
      {phase === 'login' ? (
        <LoginScreen
          config={config}
          store={store}
          onLoggedIn={(token) => {
            setAccessToken(token)
            setPhase('list')
          }}
        />
      ) : null}
      {phase === 'list' && dispatch !== null ? (
        <DispatchListScreen
          dispatch={dispatch}
          onOpen={(order) => {
            setSelectedOrder(order)
            setPhase('detail')
          }}
          onUnauthorized={handleUnauthorized}
        />
      ) : null}
      {phase === 'detail' && dispatch !== null && selectedOrder !== null ? (
        <OrderDetailScreen
          dispatch={dispatch}
          order={selectedOrder}
          onBack={() => setPhase('list')}
          onCompleted={() => setPhase('list')}
        />
      ) : null}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
})
