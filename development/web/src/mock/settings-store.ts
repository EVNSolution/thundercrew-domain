/**
 * 설정 mock 스토어.
 *
 * 설정은 **다른 화면이 실제로 읽는 값**이다. 임계값을 각 화면에 상수로 박아두면
 * 설정 화면은 아무것도 하지 않는 폼이 되고, QA 는 바꿔봐도 아무 일도 안 일어나는
 * 것을 버그로 신고하게 된다. 그래서 방치 임계·지연 허용·미수신 임계는 여기서만
 * 정의하고 배송·클리닝·진단 화면이 이 값을 읽는다.
 *
 * 기준: docs/frontend/03-screen-feature-map.md §15
 */

/** 액센트 색 선택지. 상태색(빨강·초록·주황)과 혼동되는 계열은 넣지 않는다. */
export const ACCENT_CHOICES: ReadonlyArray<{
  readonly id: string;
  readonly label: string;
  readonly base: string;
  readonly soft: string;
}> = [
  { id: 'blue', label: '파랑', base: '#0066cc', soft: '#e8f2ff' },
  { id: 'indigo', label: '인디고', base: '#3d4db8', soft: '#ecedfb' },
  { id: 'violet', label: '바이올렛', base: '#7a5af8', soft: '#efeaff' },
  { id: 'teal', label: '틸', base: '#0a7ea4', soft: '#e4f4f9' },
  { id: 'slate', label: '슬레이트', base: '#44566c', soft: '#eceff3' },
];

export interface OperationSettings {
  /**
   * 정비 임박 임계 (%). 품목마다 개별 임계가 있으므로 이 값은 **새 품목의
   * 기본값**이다. 기존 품목의 값을 덮어쓰지 않는다 — 덮어쓰면 품목별로
   * 다르게 잡아둔 운영 기준이 설정 한 번에 날아간다.
   */
  readonly maintenanceSoonPercent: number;
  /** 배송 방치 임계 (분). 이 시간을 넘게 아무도 잡지 않으면 경보한다. */
  readonly staleOrderMinutes: number;
  /** 클리닝 지연 허용 (분). 예정 시각에서 이만큼 넘어가면 지연으로 본다. */
  readonly cleaningToleranceMinutes: number;
  /** 텔레메트리 미수신 경보 임계 (분). */
  readonly telemetryStaleMinutes: number;
  readonly telemetryEnabled: boolean;
  /** 수집 주기 (초). */
  readonly telemetryIntervalSeconds: number;
  /** OTOPLUG observer 연동. */
  readonly deviceObserverEnabled: boolean;
  readonly deviceObserverEndpoint: string;
  /** `ACCENT_CHOICES` 의 id. 라이트 한 세트만 받는다 — 다크모드는 두지 않는다. */
  readonly accentId: string;
}

export interface SettingsState {
  readonly settings: OperationSettings;
  /** 저장하지 않은 편집이 있는지. 폼은 초안을 따로 들고 있고 저장 시 여기로 들어온다. */
  readonly lastMessage: { readonly kind: 'ok' | 'rejected'; readonly text: string } | null;
}

export const DEFAULT_SETTINGS: OperationSettings = {
  maintenanceSoonPercent: 85,
  staleOrderMinutes: 10,
  cleaningToleranceMinutes: 5,
  telemetryStaleMinutes: 15,
  telemetryEnabled: true,
  telemetryIntervalSeconds: 30,
  deviceObserverEnabled: true,
  deviceObserverEndpoint: 'https://observer.otoplug.example/v1/events',
  accentId: 'blue',
};

let state: SettingsState = { settings: DEFAULT_SETTINGS, lastMessage: null };
const listeners = new Set<() => void>();

function emit(next: SettingsState): void {
  state = next;
  listeners.forEach((listener) => listener());
}

export function subscribeSettings(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSettingsSnapshot(): SettingsState {
  return state;
}

/** 지금 설정값. 스토어 밖(순수 함수)에서 임계값이 필요할 때 쓴다. */
export function currentSettings(): OperationSettings {
  return state.settings;
}

export function accentOf(id: string) {
  return ACCENT_CHOICES.find((choice) => choice.id === id) ?? ACCENT_CHOICES[0];
}

export interface SettingsProblem {
  readonly field: keyof OperationSettings;
  readonly text: string;
}

/**
 * 저장 전 검증. 0 이나 음수 임계는 "항상 경보"와 같아서 경보를 무의미하게 만든다.
 * 막지 않고 통과시키면 화면 전체가 빨개진 뒤에야 원인을 찾게 된다.
 */
export function validateSettings(draft: OperationSettings): readonly SettingsProblem[] {
  const problems: SettingsProblem[] = [];
  if (!Number.isFinite(draft.staleOrderMinutes) || draft.staleOrderMinutes < 1) {
    problems.push({ field: 'staleOrderMinutes', text: '배송 방치 임계는 1분 이상이어야 합니다.' });
  }
  if (!Number.isFinite(draft.cleaningToleranceMinutes) || draft.cleaningToleranceMinutes < 0) {
    problems.push({
      field: 'cleaningToleranceMinutes',
      text: '클리닝 지연 허용은 0분 이상이어야 합니다.',
    });
  }
  if (!Number.isFinite(draft.telemetryStaleMinutes) || draft.telemetryStaleMinutes < 1) {
    problems.push({
      field: 'telemetryStaleMinutes',
      text: '미수신 경보 임계는 1분 이상이어야 합니다.',
    });
  }
  if (draft.maintenanceSoonPercent < 50 || draft.maintenanceSoonPercent > 100) {
    problems.push({
      field: 'maintenanceSoonPercent',
      text: '정비 임박 임계는 50~100% 사이여야 합니다.',
    });
  }
  if (draft.telemetryEnabled && draft.telemetryIntervalSeconds < 5) {
    problems.push({
      field: 'telemetryIntervalSeconds',
      text: '수집 주기는 5초 이상이어야 합니다.',
    });
  }
  if (draft.deviceObserverEnabled && !/^https:\/\/\S+$/.test(draft.deviceObserverEndpoint)) {
    problems.push({
      field: 'deviceObserverEndpoint',
      text: 'observer 주소는 https 로 시작해야 합니다.',
    });
  }
  return problems;
}

/** 무엇이 어떻게 바뀌었는지. 감사 로그에 넣을 문장을 만든다. */
export interface SettingsDiff {
  readonly label: string;
  readonly before: string;
  readonly after: string;
}

const FIELD_LABEL: Record<keyof OperationSettings, string> = {
  maintenanceSoonPercent: '정비 임박 임계',
  staleOrderMinutes: '배송 방치 임계',
  cleaningToleranceMinutes: '클리닝 지연 허용',
  telemetryStaleMinutes: '미수신 경보 임계',
  telemetryEnabled: '텔레메트리 수집',
  telemetryIntervalSeconds: '수집 주기',
  deviceObserverEnabled: 'OTOPLUG observer',
  deviceObserverEndpoint: 'observer 주소',
  accentId: '액센트 색',
};

function display(field: keyof OperationSettings, value: OperationSettings[keyof OperationSettings]) {
  if (typeof value === 'boolean') return value ? '사용' : '중지';
  if (field === 'accentId') return accentOf(String(value)).label;
  if (field === 'maintenanceSoonPercent') return `${value}%`;
  if (field === 'telemetryIntervalSeconds') return `${value}초`;
  if (field === 'deviceObserverEndpoint') return String(value);
  return `${value}분`;
}

export function diffSettings(
  before: OperationSettings,
  after: OperationSettings,
): readonly SettingsDiff[] {
  const keys = Object.keys(FIELD_LABEL) as Array<keyof OperationSettings>;
  return keys
    .filter((key) => before[key] !== after[key])
    .map((key) => ({
      label: FIELD_LABEL[key],
      before: display(key, before[key]),
      after: display(key, after[key]),
    }));
}

export function saveSettings(draft: OperationSettings): readonly SettingsDiff[] {
  const problems = validateSettings(draft);
  if (problems.length > 0) {
    emit({
      ...state,
      lastMessage: { kind: 'rejected', text: problems[0].text },
    });
    return [];
  }

  const changes = diffSettings(state.settings, draft);
  if (changes.length === 0) {
    emit({ ...state, lastMessage: { kind: 'ok', text: '바뀐 값이 없습니다.' } });
    return [];
  }

  emit({
    settings: draft,
    lastMessage: { kind: 'ok', text: `${changes.length}개 항목을 저장했습니다.` },
  });
  return changes;
}

export function clearSettingsMessage(): void {
  if (state.lastMessage === null) return;
  emit({ ...state, lastMessage: null });
}
