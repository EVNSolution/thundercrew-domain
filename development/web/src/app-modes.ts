/**
 * 진입 모드와 메뉴 정의.
 *
 * 용도는 사이드바 토글이 아니라 진입 모드다. 로그인 후 모드를 고르고
 * 그 모드의 화면으로 들어간다. 배송용과 클린차량은 관제·배차·이력·관리
 * 4개 화면이 각각 별개이고, 정비 모드는 용도 무관 전 차량을 다룬다.
 *
 * 기준: docs/frontend/03-screen-feature-map.md §1
 */

export type ModeId = 'delivery' | 'cleaning' | 'maintenance';

/** 모드별 화면. 전역 화면(감사·진단·설정)은 세 모드 하단에 공통으로 붙는다. */
export type ScreenId =
  | 'control'
  | 'dispatch'
  | 'records'
  | 'master-data'
  | 'maintenance-vehicles'
  | 'maintenance-items'
  | 'maintenance-records'
  | 'audit'
  | 'diagnostics'
  | 'settings';

export interface MenuItem {
  readonly screen: ScreenId;
  readonly label: string;
  /** 페이지 제목 옆 한 줄 설명. */
  readonly description: string;
}

export interface ModeDefinition {
  readonly id: ModeId;
  readonly label: string;
  /** URL prefix. 쿠키가 정본이고 이 값은 북마크·공유용이다. */
  readonly path: string;
  readonly menu: readonly MenuItem[];
  /** 모드 진입 시 첫 화면. */
  readonly home: ScreenId;
}

export const GLOBAL_MENU: readonly MenuItem[] = [
  { screen: 'audit', label: '감사', description: '운영자가 무엇을 바꿨는지 확인합니다.' },
  { screen: 'diagnostics', label: '진단', description: '단말 연동과 데이터 정합성 상태를 확인합니다.' },
] as const;

export const SETTINGS_MENU: MenuItem = {
  screen: 'settings',
  label: '설정',
  description: '서비스 기준과 외부 연동을 설정합니다.',
};

export const MODES: Record<ModeId, ModeDefinition> = {
  delivery: {
    id: 'delivery',
    label: '배송용',
    path: '/delivery',
    home: 'control',
    menu: [
      { screen: 'control', label: '관제', description: '차량이 어디 있고 무엇을 잡았는지 봅니다.' },
      { screen: 'dispatch', label: '배차', description: '주문을 풀에 올리면 배송원이 잡습니다.' },
      { screen: 'records', label: '이력', description: '완료된 배송과 증빙을 확인합니다.' },
      { screen: 'master-data', label: '관리', description: '배송 운영이 쓰는 기준정보를 관리합니다.' },
    ],
  },
  cleaning: {
    id: 'cleaning',
    label: '클린차량',
    path: '/cleaning',
    home: 'control',
    menu: [
      { screen: 'control', label: '관제', description: '예정 시각을 지키고 있는지 봅니다.' },
      { screen: 'dispatch', label: '배차', description: '서비스 시각을 예약하고 클리너를 배정합니다.' },
      { screen: 'records', label: '이력', description: '예정 시각을 얼마나 지켰는지 확인합니다.' },
      { screen: 'master-data', label: '관리', description: '클리닝 운영이 쓰는 기준정보를 관리합니다.' },
    ],
  },
  maintenance: {
    id: 'maintenance',
    label: '정비',
    path: '/maintenance',
    home: 'maintenance-vehicles',
    menu: [
      {
        screen: 'maintenance-vehicles',
        label: '정비',
        description: '차량을 고르고 정비 품목을 체크합니다.',
      },
      { screen: 'maintenance-items', label: '품목', description: '정비 품목과 주기를 관리합니다.' },
      {
        screen: 'maintenance-records',
        label: '이력',
        description: '전 차량의 정비 실시 기록입니다.',
      },
    ],
  },
};

export const MODE_ORDER: readonly ModeId[] = ['delivery', 'cleaning', 'maintenance'] as const;

/** 전역 화면은 모드를 바꿔도 그대로 유지한다. */
const GLOBAL_SCREENS: readonly ScreenId[] = ['audit', 'diagnostics', 'settings'] as const;

export function isGlobalScreen(screen: ScreenId): boolean {
  return GLOBAL_SCREENS.includes(screen);
}

/** 해당 모드에서 볼 수 있는 화면인지. 모드 전환 시 첫 화면으로 되돌릴지 판단한다. */
export function screenBelongsToMode(screen: ScreenId, mode: ModeId): boolean {
  if (isGlobalScreen(screen)) return true;
  return MODES[mode].menu.some((item) => item.screen === screen);
}

export function findMenuItem(screen: ScreenId, mode: ModeId): MenuItem | undefined {
  if (screen === 'settings') return SETTINGS_MENU;
  const global = GLOBAL_MENU.find((item) => item.screen === screen);
  if (global) return global;
  return MODES[mode].menu.find((item) => item.screen === screen);
}

export function isModeId(value: string | null | undefined): value is ModeId {
  return value === 'delivery' || value === 'cleaning' || value === 'maintenance';
}
