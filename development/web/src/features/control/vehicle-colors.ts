/**
 * 차량 마커 색.
 *
 * `clever-dsv-web` `src/features/control/control-vehicles.ts` 의 팔레트와
 * 해시 방식을 그대로 옮겼다. 차량 ID 를 해시해 16색 중 하나를 고정 배정하므로
 * 같은 차량은 항상 같은 색이고, 색이 겹쳐도 레이블로 구분된다.
 *
 * 잡은 주문이 없는 차량은 회색이다. 지도에서 "지금 일하는 차량"이 먼저 읽힌다.
 */

export const VEHICLE_NO_ORDERS_COLOR = '#8e8e93';

const VEHICLE_PALETTE = [
  '#0066cc',
  '#c4458f',
  '#d56b1d',
  '#6f52b5',
  '#007f78',
  '#c4493d',
  '#8a5a44',
  '#2b7a9b',
  '#7a7f00',
  '#b33f62',
  '#4b6cb7',
  '#aa5a00',
  '#008f5a',
  '#7b4fa3',
  '#b84c8a',
  '#4e7d2a',
] as const;

export function vehicleColor(vehicleId: string): string {
  let hash = 0;
  for (const character of vehicleId) {
    hash = (Math.imul(hash, 31) + character.charCodeAt(0)) | 0;
  }
  return VEHICLE_PALETTE[(hash >>> 0) % VEHICLE_PALETTE.length];
}

/** 잡은 주문 수에 따라 색을 정한다. 0 이면 회색. */
export function vehicleMarkerColor(vehicleId: string, heldOrderCount: number): string {
  return heldOrderCount > 0 ? vehicleColor(vehicleId) : VEHICLE_NO_ORDERS_COLOR;
}

/**
 * DSV 마커 안에 들어가는 차량 글리프. Material 계열 배송 트럭 path 를 그대로 쓴다.
 * viewBox 24×24 기준이고 검정으로 채운다.
 */
export const VEHICLE_ICON_PATH =
  'M20 8H17V4H3C1.9 4 1 4.9 1 6V17H3C3 18.66 4.34 20 6 20C7.66 20 9 18.66 9 17H15C15 18.66 16.34 20 18 20C19.66 20 21 18.66 21 17H23V12L20 8ZM19.5 9.5L21.46 12H17V9.5H19.5ZM6 18C5.45 18 5 17.55 5 17C5 16.45 5.45 16 6 16C6.55 16 7 16.45 7 17C7 17.55 6.55 18 6 18ZM8.22 15C7.67 14.39 6.89 14 6 14C5.11 14 4.33 14.39 3.78 15H3V6H15V15H8.22ZM18 18C17.45 18 17 17.55 17 17C17 16.45 17.45 16 18 16C18.55 16 19 16.45 19 17C19 17.55 18.55 18 18 18Z';
