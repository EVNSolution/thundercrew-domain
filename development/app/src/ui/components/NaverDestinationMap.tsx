import { Component, type ReactNode, useEffect, useRef } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import {
  NaverMapMarkerOverlay,
  NaverMapView,
  type NaverMapViewRef,
} from '@mj-studio/react-native-naver-map'

export type LatLng = { latitude: number; longitude: number }

export type NaverDestinationMapProps = {
  latitude: number
  longitude: number
  label: string
  /**
   * Rider's current position. When provided, the map shows the live "my
   * location" blue dot (NoFollow tracking) and frames both the rider and the
   * destination on first render. Null → destination-only (permission denied
   * or no fix yet).
   */
  origin?: LatLng | null
}

/**
 * Renders a Naver map with the destination marker. When `origin` is given it
 * also enables the live location overlay and fits both points into view.
 * Falls back to a plain coordinate readout if the native map view throws
 * (e.g. missing/invalid NCP client ID, unsupported device).
 */
export function NaverDestinationMap({ latitude, longitude, label, origin }: NaverDestinationMapProps) {
  const mapRef = useRef<NaverMapViewRef>(null)

  function fitCamera() {
    if (origin) {
      // 실시간 파란 점: NoFollow = 현위치 오버레이가 GPS 를 따라가되 카메라는 자동 이동 안 함.
      mapRef.current?.setLocationTrackingMode('NoFollow')
      // 내 위치 + 목적지 둘 다 보이는 최대 줌으로 카메라 맞춤.
      mapRef.current?.animateCameraWithTwoCoords({
        coord1: { latitude: origin.latitude, longitude: origin.longitude },
        coord2: { latitude, longitude },
        duration: 0,
      })
    }
  }

  // 지도 초기화(onInitialized) 후에 GPS 스냅샷이 도착하는 경우에도 둘 다 보이게 재프레이밍.
  useEffect(() => {
    fitCamera()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origin?.latitude, origin?.longitude, latitude, longitude])

  return (
    <NaverDestinationMapErrorBoundary latitude={latitude} longitude={longitude} label={label}>
      <NaverMapView
        ref={mapRef}
        style={styles.map}
        camera={{ latitude, longitude, zoom: 15 }}
        isShowLocationButton={false}
        isShowZoomControls={false}
        onInitialized={fitCamera}
      >
        <NaverMapMarkerOverlay latitude={latitude} longitude={longitude} caption={{ text: label }} />
      </NaverMapView>
    </NaverDestinationMapErrorBoundary>
  )
}

type ErrorBoundaryProps = NaverDestinationMapProps & { children: ReactNode }
type ErrorBoundaryState = { hasError: boolean }

class NaverDestinationMapErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return <CoordinateFallback latitude={this.props.latitude} longitude={this.props.longitude} label={this.props.label} />
    }

    return this.props.children
  }
}

function CoordinateFallback({ latitude, longitude, label }: NaverDestinationMapProps) {
  return (
    <View style={styles.fallback}>
      <Text style={styles.fallbackTitle}>{label}</Text>
      <Text style={styles.fallbackText}>
        {latitude.toFixed(6)}, {longitude.toFixed(6)}
      </Text>
      <Text style={styles.fallbackHint}>지도를 불러올 수 없습니다. 좌표를 참고하세요.</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  map: {
    flex: 1,
  },
  fallback: {
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    flex: 1,
    justifyContent: 'center',
    padding: 16,
  },
  fallbackTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  fallbackText: {
    color: '#334155',
    fontSize: 14,
    marginTop: 4,
  },
  fallbackHint: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
  },
})
