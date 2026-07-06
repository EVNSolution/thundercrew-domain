export type LatLng = { latitude: number; longitude: number }

/**
 * Naver map `Region`: south-west corner (`latitude`/`longitude`) plus the span
 * to the north-east corner (`latitudeDelta`/`longitudeDelta`).
 */
export type Region = {
  latitude: number
  longitude: number
  latitudeDelta: number
  longitudeDelta: number
}

export type MeCenteredRegionOptions = {
  /** Minimum half-span in degrees (~0.01° ≈ 1.1km) so a lone point isn't over-zoomed. */
  minHalfSpanDeg?: number
  /** Multiplier applied to the half-span so markers aren't flush against the edge. */
  padding?: number
}

/**
 * A Region centered on `me` that is just large enough to contain every order,
 * with the rider in the middle. Because the map keeps the rider centered
 * (Follow tracking), the region is symmetric around `me`: the SW corner is
 * `me - halfSpan` and the span is `2 * halfSpan`, so the region's center is
 * exactly `me`.
 */
export function computeMeCenteredRegion(
  me: LatLng,
  orders: readonly LatLng[],
  options: MeCenteredRegionOptions = {},
): Region {
  const minHalfSpan = options.minHalfSpanDeg ?? 0.01
  const padding = options.padding ?? 1.3

  let latHalf = minHalfSpan
  let lngHalf = minHalfSpan
  for (const order of orders) {
    latHalf = Math.max(latHalf, Math.abs(order.latitude - me.latitude))
    lngHalf = Math.max(lngHalf, Math.abs(order.longitude - me.longitude))
  }

  latHalf *= padding
  lngHalf *= padding

  return {
    latitude: me.latitude - latHalf,
    longitude: me.longitude - lngHalf,
    latitudeDelta: 2 * latHalf,
    longitudeDelta: 2 * lngHalf,
  }
}
