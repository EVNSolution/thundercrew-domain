import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AppState, FlatList, Pressable, RefreshControl, StyleSheet, Text, Vibration, View } from 'react-native'

import { acceptCall, loadRiderDeliveries } from '../../domain/dispatch/riderDispatch'
import { detectNewOfferedCallIds } from '../../domain/dispatch/offeredCallAlerts'
import { NaverFleetMap, type FleetMapOrder } from '../components/NaverFleetMap'
import { CallAlertBanner } from '../components/CallAlertBanner'
import { useCurrentLocation } from '../hooks/useCurrentLocation'
import type { RiderDispatchOrder, RiderDispatchService } from '../../api/thundercrew/riderDispatchClient'

const POLL_INTERVAL_MS = 10000

type Tab = 'assigned' | 'offered'

export type DispatchListScreenProps = {
  dispatch: RiderDispatchService
  onOpen: (order: RiderDispatchOrder) => void
  onUnauthorized: () => void
}

export function DispatchListScreen({ dispatch, onOpen, onUnauthorized }: DispatchListScreenProps) {
  const [tab, setTab] = useState<Tab>('assigned')
  const [assigned, setAssigned] = useState<RiderDispatchOrder[]>([])
  const [offered, setOffered] = useState<RiderDispatchOrder[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [callAlert, setCallAlert] = useState<string | null>(null)
  const { origin } = useCurrentLocation()

  const seenOfferedRef = useRef<Set<string>>(new Set())
  const firstLoadRef = useRef(true)

  const load = useCallback(
    async (silent = false) => {
      if (!silent) {
        setLoading(true)
        setError(null)
      }
      const result = await loadRiderDeliveries(dispatch)
      if (!silent) {
        setLoading(false)
      }

      if (result.kind === 'unauthorized') {
        onUnauthorized()
        return
      }
      if (result.kind === 'error') {
        // 조용한 폴링 실패(네트워크 blip)는 무시하고 마지막 데이터를 유지한다.
        if (!silent) {
          setError(result.message)
        }
        return
      }

      setAssigned(result.assigned)
      setOffered(result.offered)

      // 새 대기 콜 감지 → 인앱 배너 + 진동. 최초 로드는 기준만 잡고 알림하지 않는다.
      const offeredIds = result.offered.map((order) => order.id)
      if (firstLoadRef.current) {
        firstLoadRef.current = false
      } else {
        const newIds = detectNewOfferedCallIds(seenOfferedRef.current, offeredIds)
        if (newIds.length > 0) {
          const first = result.offered.find((order) => order.id === newIds[0])
          const suffix = newIds.length > 1 ? ` 외 ${newIds.length - 1}건` : ''
          setCallAlert(`${first?.customerName ?? ''} · ${first?.address ?? ''}${suffix}`)
          Vibration.vibrate(400)
        }
      }
      seenOfferedRef.current = new Set(offeredIds)
    },
    [dispatch, onUnauthorized],
  )

  useEffect(() => {
    load()
  }, [load])

  // 포그라운드일 때만 10초마다 조용히 폴링 — 새 콜 등장/수락을 반영한다.
  useEffect(() => {
    const interval = setInterval(() => {
      if (AppState.currentState === 'active') {
        void load(true)
      }
    }, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [load])

  async function accept(order: RiderDispatchOrder) {
    const result = await acceptCall(order.id, dispatch)
    if (result.kind === 'unauthorized') {
      onUnauthorized()
      return
    }
    if (result.kind === 'forbidden' || result.kind === 'error') {
      setError(result.kind === 'error' ? result.message : '이 콜을 수락할 수 없습니다.')
      return
    }

    setTab('assigned')
    await load()
  }

  const orders = tab === 'assigned' ? assigned : offered

  const mapOrders = useMemo<FleetMapOrder[]>(
    () =>
      orders.map((order) => ({
        id: order.id,
        latitude: order.latitude,
        longitude: order.longitude,
        label: order.customerName,
      })),
    [orders],
  )

  return (
    <View style={styles.container}>
      <CallAlertBanner
        message={callAlert}
        onPress={() => setTab('offered')}
        onDismiss={() => setCallAlert(null)}
      />
      <View style={styles.mapWrap}>
        <NaverFleetMap origin={origin} orders={mapOrders} />
      </View>
      <View style={styles.content}>
      <View style={styles.tabBar}>
        <Pressable style={styles.tabButton} onPress={() => setTab('assigned')}>
          <Text style={[styles.tabText, tab === 'assigned' ? styles.tabTextActive : null]}>내 배차</Text>
        </Pressable>
        <Pressable style={styles.tabButton} onPress={() => setTab('offered')}>
          <Text style={[styles.tabText, tab === 'offered' ? styles.tabTextActive : null]}>대기 콜</Text>
        </Pressable>
      </View>
      {error !== null ? <Text style={styles.error}>{error}</Text> : null}
      {tab === 'offered' && !loading && offered.length === 0 ? (
        <Text style={styles.emptyHint}>대기 중인 콜이 없습니다. (콜 배차 차량만 표시됩니다)</Text>
      ) : null}
      <FlatList
        style={styles.list}
        data={orders}
        keyExtractor={(order) => order.id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => load()} />}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{item.customerName}</Text>
            <Text style={styles.cardAddress}>{item.address}</Text>
            {tab === 'assigned' ? (
              <Pressable onPress={() => onOpen(item)}>
                <Text style={styles.detailLink}>상세 보기</Text>
              </Pressable>
            ) : (
              <Pressable onPress={() => accept(item)}>
                <Text style={styles.acceptLink}>수락</Text>
              </Pressable>
            )}
          </View>
        )}
      />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  mapWrap: {
    flex: 4,
  },
  content: {
    flex: 6,
  },
  list: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
  tabButton: {
    padding: 12,
  },
  tabText: {
    color: '#64748b',
    fontWeight: '400',
  },
  tabTextActive: {
    color: '#0f172a',
    fontWeight: '700',
  },
  error: {
    color: '#dc2626',
    padding: 8,
  },
  emptyHint: {
    color: '#666',
    padding: 16,
  },
  card: {
    borderBottomWidth: 1,
    borderColor: '#eee',
    padding: 16,
  },
  cardTitle: {
    fontWeight: '600',
  },
  cardAddress: {
    color: '#555',
  },
  detailLink: {
    color: '#0a58ca',
    marginTop: 6,
  },
  acceptLink: {
    color: '#198754',
    marginTop: 6,
  },
})
