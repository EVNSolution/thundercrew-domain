import { useCallback, useEffect, useMemo, useState } from 'react'
import { Platform, SafeAreaView, StatusBar, StyleSheet, View } from 'react-native'

import { createDispatchService, createProfileService, readRiderRuntimeConfig } from './config/riderRuntimeConfig'
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

  // 라이더 차량의 서비스유형으로 탭 구성 결정: CALL 이면 대기 콜 탭 노출, 아니면 내 배차만.
  // null=미확정. 프로필 실패/차량 없음이면 false(비CALL) 취급.
  const [isCallRider, setIsCallRider] = useState<boolean | null>(null)

  useEffect(() => {
    if (accessToken === null) {
      setIsCallRider(null)
      return
    }
    const profile = createProfileService(config, accessToken)
    if (profile === null) {
      return
    }
    let cancelled = false
    profile
      .getVehicle()
      .then((vehicle) => {
        if (!cancelled) setIsCallRider(vehicle?.serviceType === 'CALL')
      })
      .catch(() => {
        if (!cancelled) setIsCallRider(false)
      })
    return () => {
      cancelled = true
    }
  }, [config, accessToken])

  const handleUnauthorized = useCallback(() => {
    void logoutSession(store) // fire-and-forget: UI는 즉시 전환, 토큰 클리어는 백그라운드
    setAccessToken(null)
    setSelectedOrder(null)
    setPhase('login')
  }, [store])

  return (
    <View style={styles.outer}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" translucent />
      <SafeAreaView style={styles.body}>
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
          isCallRider={isCallRider}
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
    </View>
  )
}

const styles = StyleSheet.create({
  // 앱이 edge-to-edge 라 상태바가 콘텐츠 위에 투명하게 겹친다. 바깥을 검게 깔고
  // body 를 상태바 높이만큼 marginTop 으로 내려, 상태바 영역만 검게 보이게 한다
  // (흰색 시계·아이콘이 흰 배경에 묻히지 않도록). barStyle=light 로 흰 글씨.
  outer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  body: {
    flex: 1,
    backgroundColor: '#ffffff',
    marginTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 0,
  },
})
