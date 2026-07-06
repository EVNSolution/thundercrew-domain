import { Component, type ReactNode } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { NaverMapMarkerOverlay, NaverMapView } from '@mj-studio/react-native-naver-map'

export type NaverDestinationMapProps = {
  latitude: number
  longitude: number
  label: string
}

/**
 * Renders a Naver map centered on the destination with a single marker.
 * Falls back to a plain coordinate readout if the native map view throws
 * (e.g. missing/invalid NCP client ID, unsupported device).
 */
export function NaverDestinationMap({ latitude, longitude, label }: NaverDestinationMapProps) {
  return (
    <NaverDestinationMapErrorBoundary latitude={latitude} longitude={longitude} label={label}>
      <NaverMapView
        style={styles.map}
        camera={{ latitude, longitude, zoom: 15 }}
        isShowLocationButton={false}
        isShowZoomControls={false}
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
