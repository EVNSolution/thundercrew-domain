import { useState } from 'react'
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native'

import { NaverDestinationMap } from '../components/NaverDestinationMap'
import { useCurrentLocation } from '../hooks/useCurrentLocation'
import { completeOrderWithPhoto } from '../../domain/session/completeOrder'
import { buildNaverRouteUrl, buildNaverRouteWebUrl } from '../../domain/nav/naverDeepLink'
import { createExpoProofPhotoCaptureService } from '../../platform/expo/camera/expoProofPhotoCaptureService'
import type { RiderDispatchOrder, RiderDispatchService } from '../../api/thundercrew/riderDispatchClient'

export type OrderDetailScreenProps = {
  dispatch: RiderDispatchService
  order: RiderDispatchOrder
  onBack: () => void
  onCompleted: () => void
}

export function OrderDetailScreen({ dispatch, order, onBack, onCompleted }: OrderDetailScreenProps) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { origin } = useCurrentLocation()

  async function navigate() {
    const url = buildNaverRouteUrl({ latitude: order.latitude, longitude: order.longitude, name: order.customerName })
    try {
      const canOpen = await Linking.canOpenURL(url)
      await Linking.openURL(canOpen ? url : buildNaverRouteWebUrl(order))
    } catch {
      await Linking.openURL(buildNaverRouteWebUrl(order))
    }
  }

  async function complete() {
    setBusy(true)
    setError(null)
    try {
      const camera = createExpoProofPhotoCaptureService()
      const result = await completeOrderWithPhoto({ camera, dispatch, orderId: order.id })

      if (result.kind === 'success') {
        onCompleted()
        return
      }
      if (result.kind === 'cancelled') {
        return
      }
      if (result.kind === 'permission_denied') {
        setError(result.message)
        return
      }
      setError(result.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <View style={styles.container}>
      <Pressable onPress={onBack}>
        <Text style={styles.backLink}>← 목록</Text>
      </Pressable>
      <View style={styles.info}>
        <Text style={styles.name}>{order.customerName}</Text>
        <Text>{order.customerPhone}</Text>
        <Text style={styles.address}>{order.address}</Text>
      </View>
      <View style={styles.mapContainer}>
        <NaverDestinationMap
          latitude={order.latitude}
          longitude={order.longitude}
          label={order.customerName}
          origin={origin}
        />
      </View>
      {error !== null ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.actions}>
        <Pressable onPress={navigate} disabled={busy}>
          <Text style={styles.navigateLink}>길안내</Text>
        </Pressable>
        <Pressable onPress={complete} disabled={busy}>
          <Text style={styles.completeLink}>{busy ? '처리 중…' : '완료(사진)'}</Text>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backLink: {
    padding: 12,
  },
  info: {
    gap: 4,
    padding: 16,
  },
  name: {
    fontSize: 18,
    fontWeight: '600',
  },
  address: {
    color: '#555',
  },
  mapContainer: {
    height: 240,
  },
  error: {
    color: '#dc2626',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
  },
  navigateLink: {
    color: '#0a58ca',
  },
  completeLink: {
    color: '#198754',
  },
})
