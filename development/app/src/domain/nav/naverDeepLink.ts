const NAVER_MAP_APP_PACKAGE = 'com.evns.cleverdriverapp'

export type NaverRouteDestination = {
  latitude: number
  longitude: number
  name: string
}

/** Builds a Naver Map app deep link that starts car navigation to the destination. */
export function buildNaverRouteUrl(dest: NaverRouteDestination): string {
  const name = encodeURIComponent(dest.name)
  return `nmap://route/car?dlat=${dest.latitude}&dlng=${dest.longitude}&dname=${name}&appname=${NAVER_MAP_APP_PACKAGE}`
}

/** Web fallback when the Naver Map app isn't installed. */
export function buildNaverRouteWebUrl(dest: { latitude: number; longitude: number }): string {
  return `https://map.naver.com/v5/directions/-/-/-/car?c=${dest.longitude},${dest.latitude},15`
}
