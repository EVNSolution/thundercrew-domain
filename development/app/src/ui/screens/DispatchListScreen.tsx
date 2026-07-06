import { useCallback, useEffect, useMemo, useState } from 'react'
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native'

import { acceptCall, loadRiderDeliveries } from '../../domain/dispatch/riderDispatch'
import { NaverFleetMap, type FleetMapOrder } from '../components/NaverFleetMap'
import { useCurrentLocation } from '../hooks/useCurrentLocation'
import type { RiderDispatchOrder, RiderDispatchService } from '../../api/thundercrew/riderDispatchClient'

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
  const { origin } = useCurrentLocation()

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const result = await loadRiderDeliveries(dispatch)
    setLoading(false)

    if (result.kind === 'unauthorized') {
      onUnauthorized()
      return
    }
    if (result.kind === 'error') {
      setError(result.message)
      return
    }

    setAssigned(result.assigned)
    setOffered(result.offered)
  }, [dispatch, onUnauthorized])

  useEffect(() => {
    load()
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
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
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
