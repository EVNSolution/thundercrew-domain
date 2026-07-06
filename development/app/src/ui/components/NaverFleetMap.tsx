import { Component, type ReactNode, useEffect, useRef } from 'react'
import { StyleSheet } from 'react-native'
import {
  NaverMapMarkerOverlay,
  NaverMapView,
  type NaverMapViewRef,
} from '@mj-studio/react-native-naver-map'

import { computeMeCenteredRegion, type LatLng } from '../geo/meCenteredRegion'

export type FleetMapOrder = {
  id: string
  latitude: number
  longitude: number
  label: string
}

export type NaverFleetMapProps = {
  /** Rider's current position; null until a fix arrives (or permission denied). */
  origin: LatLng | null
  /** Orders to drop as markers (the active tab's list). */
  orders: FleetMapOrder[]
}

const DEFAULT_CAMERA = { latitude: 37.5665, longitude: 126.978, zoom: 12 }

/**
 * The dispatch list's top map. Keeps the rider centered (Follow tracking) with
 * a live blue dot, drops a marker for each order, and on first fix / whenever
 * the marker set changes frames the region so the rider and all orders fit.
 *
 * Renders nothing if the native map throws (missing NCP key, unsupported
 * device) so the list below keeps working.
 */
export function NaverFleetMap({ origin, orders }: NaverFleetMapProps) {
  return (
    <NaverFleetMapErrorBoundary>
      <FleetMapInner origin={origin} orders={orders} />
    </NaverFleetMapErrorBoundary>
  )
}

function FleetMapInner({ origin, orders }: NaverFleetMapProps) {
  const mapRef = useRef<NaverMapViewRef>(null)

  function frame() {
    if (origin) {
      // 내 위치를 항상 중앙에 두고(Follow), 최초/탭 전환 시 모든 주문이 보이게 fit.
      mapRef.current?.setLocationTrackingMode('Follow')
      mapRef.current?.animateRegionTo({ ...computeMeCenteredRegion(origin, orders), duration: 0 })
    }
  }

  // 지도 초기화 후 origin/주문이 도착·변경되는 경우에도 재프레이밍.
  useEffect(() => {
    frame()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origin?.latitude, origin?.longitude, orders])

  const initialCamera =
    origin ?? (orders[0] ? { latitude: orders[0].latitude, longitude: orders[0].longitude } : null)

  return (
    <NaverMapView
      ref={mapRef}
      style={styles.map}
      camera={initialCamera ? { ...initialCamera, zoom: 13 } : DEFAULT_CAMERA}
      isShowLocationButton={false}
      isShowZoomControls={false}
      onInitialized={frame}
    >
      {orders.map((order) => (
        <NaverMapMarkerOverlay
          key={order.id}
          latitude={order.latitude}
          longitude={order.longitude}
          caption={{ text: order.label }}
        />
      ))}
    </NaverMapView>
  )
}

type ErrorBoundaryState = { hasError: boolean }

class NaverFleetMapErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return null
    }
    return this.props.children
  }
}

const styles = StyleSheet.create({
  map: {
    flex: 1,
  },
})
