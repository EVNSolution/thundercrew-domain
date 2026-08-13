/**
 * 감사 mock 스토어 — 운영자가 무엇을 바꿨는지.
 *
 * 이 스토어는 **다른 스토어에 의존하지 않는다.** 반대로 차량·주문·예약·정비
 * 스토어가 여기에 기록을 남긴다. 감사가 자산 스토어를 참조하면 순환이 생기고,
 * 무엇보다 감사는 "그 시점에 무엇을 했는가"를 남기는 것이므로 대상의 현재
 * 상태를 다시 읽어서는 안 된다 — 지금 값을 읽으면 변경 전 값이 사라진다.
 *
 * 용도별로 나누지 않는다. 행위자가 관리자 계정이고 관리자에게는 용도가 없다.
 * 다만 대상(차량·계약)에는 용도가 있으므로 대상 용도는 컬럼으로 남긴다.
 *
 * 기준: docs/frontend/03-screen-feature-map.md §13
 */

export type AuditTargetKind =
  | 'VEHICLE'
  | 'RIDER'
  | 'CONTRACT'
  | 'EQUIPMENT'
  | 'ORDER'
  | 'RESERVATION'
  | 'MAINTENANCE_ITEM'
  | 'MAINTENANCE_RECORD'
  | 'SETTINGS';

export type AuditAction = 'CREATE' | 'UPDATE' | 'MOVE' | 'DELETE' | 'ASSIGN' | 'CANCEL' | 'COMPLETE';

/** 용도는 문자열로 들고 있는다. fleet-store 를 참조하면 순환이 된다. */
export type AuditPurpose = 'DELIVERY' | 'CLEANING' | null;

export const TARGET_LABEL: Record<AuditTargetKind, string> = {
  VEHICLE: '차량',
  RIDER: '인력',
  CONTRACT: '계약',
  EQUIPMENT: '장비',
  ORDER: '주문',
  RESERVATION: '예약',
  MAINTENANCE_ITEM: '정비 품목',
  MAINTENANCE_RECORD: '정비 기록',
  SETTINGS: '설정',
};

export const ACTION_LABEL: Record<AuditAction, string> = {
  CREATE: '등록',
  UPDATE: '수정',
  MOVE: '이동',
  DELETE: '삭제',
  ASSIGN: '배정',
  CANCEL: '취소',
  COMPLETE: '완료',
};

export interface AuditEntry {
  readonly id: string;
  readonly at: number;
  readonly actor: string;
  readonly action: AuditAction;
  readonly targetKind: AuditTargetKind;
  /** 대상 식별 문자열. 차량번호·이름·주문번호처럼 사람이 읽는 값. */
  readonly targetLabel: string;
  readonly targetPurpose: AuditPurpose;
  /** 무엇을 했는지 한 줄. */
  readonly summary: string;
  /** 변경 전후. 값이 아닌 동작(배정·완료)에는 없다. */
  readonly before: string | null;
  readonly after: string | null;
}

export interface AuditState {
  readonly entries: readonly AuditEntry[];
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

function minutesAgo(minutes: number): number {
  return Date.now() - minutes * MINUTE;
}

/**
 * 행위자. 로그인한 관리자 이름이다. 세션에서 한 번 넣어두고 이후 기록에 붙인다.
 * 토큰이 아니라 표시용 이름이므로 여기 들고 있어도 된다.
 */
let actor = '목업 관리자';

export function setAuditActor(name: string): void {
  if (name.trim().length > 0) actor = name.trim();
}

let sequence = 0;

function seedEntries(): AuditEntry[] {
  // 시드는 now 기준이다. QA 가 언제 열어도 "오늘 무슨 일이 있었나"가 보인다.
  const rows: ReadonlyArray<Omit<AuditEntry, 'id'>> = [
    {
      at: minutesAgo(14),
      actor: '김운영',
      action: 'MOVE',
      targetKind: 'VEHICLE',
      targetLabel: '56다 1122',
      targetPurpose: 'CLEANING',
      summary: '용도를 이동했습니다.',
      before: '배송용',
      after: '클린차량',
    },
    {
      at: minutesAgo(38),
      actor: '김운영',
      action: 'UPDATE',
      targetKind: 'SETTINGS',
      targetLabel: '배송 방치 임계',
      targetPurpose: null,
      summary: '설정을 저장했습니다.',
      before: '15분',
      after: '10분',
    },
    {
      at: minutesAgo(52),
      actor: '박관제',
      action: 'ASSIGN',
      targetKind: 'ORDER',
      targetLabel: 'ORD-2411',
      targetPurpose: 'DELIVERY',
      summary: '방치된 주문을 운영자가 직접 배정했습니다.',
      before: null,
      after: '이수민',
    },
    {
      at: minutesAgo(70),
      actor: '박관제',
      action: 'CANCEL',
      targetKind: 'ORDER',
      targetLabel: 'ORD-2408',
      targetPurpose: 'DELIVERY',
      summary: '주문을 회수했습니다.',
      before: '풀 대기',
      after: '회수',
    },
    {
      at: minutesAgo(96),
      actor: '정비1팀 김수',
      action: 'CREATE',
      targetKind: 'MAINTENANCE_RECORD',
      targetLabel: '90마 3344 브레이크 패드 (앞)',
      targetPurpose: 'CLEANING',
      summary: '정비 실시를 기록했습니다.',
      before: null,
      after: '28,900 km',
    },
    {
      at: minutesAgo(120),
      actor: '김운영',
      action: 'UPDATE',
      targetKind: 'MAINTENANCE_ITEM',
      targetLabel: 'LPG 봄베 검사',
      targetPurpose: null,
      summary: '적용 분류를 바꿨습니다.',
      before: '1분류',
      after: '2분류',
    },
    {
      at: minutesAgo(164),
      actor: '김운영',
      action: 'MOVE',
      targetKind: 'RIDER',
      targetLabel: '한소희',
      targetPurpose: null,
      summary: '직무를 바꿨습니다.',
      before: '배송원',
      after: '클리너',
    },
    {
      at: minutesAgo(210),
      actor: '이배차',
      action: 'CREATE',
      targetKind: 'RESERVATION',
      targetLabel: '역삼 오피스 3층',
      targetPurpose: 'CLEANING',
      summary: '예약을 등록했습니다.',
      before: null,
      after: '14:30 · 순차',
    },
    {
      at: minutesAgo(246),
      actor: '이배차',
      action: 'UPDATE',
      targetKind: 'RESERVATION',
      targetLabel: '삼성 리테일 1층',
      targetPurpose: 'CLEANING',
      summary: '예정 시각을 옮겼습니다.',
      before: '13:00',
      after: '13:30',
    },
    {
      at: minutesAgo(292),
      actor: '김운영',
      action: 'DELETE',
      targetKind: 'EQUIPMENT',
      targetLabel: '함체(TC-BOX-0142)',
      targetPurpose: 'DELIVERY',
      summary: '장비를 탈거했습니다.',
      before: '장착',
      after: '탈거',
    },
    {
      at: minutesAgo(330),
      actor: '김운영',
      action: 'UPDATE',
      targetKind: 'VEHICLE',
      targetLabel: '12가 3456',
      targetPurpose: 'DELIVERY',
      summary: '차량 정보를 저장했습니다.',
      before: '강남권',
      after: '마포권',
    },
    {
      at: Date.now() - 7 * HOUR,
      actor: '박관제',
      action: 'COMPLETE',
      targetKind: 'ORDER',
      targetLabel: 'ORD-2390',
      targetPurpose: 'DELIVERY',
      summary: '주문을 완료 처리했습니다.',
      before: null,
      after: null,
    },
    {
      at: Date.now() - 26 * HOUR,
      actor: '김운영',
      action: 'CANCEL',
      targetKind: 'CONTRACT',
      targetLabel: '월 렌탈 · 인수 지참',
      targetPurpose: 'DELIVERY',
      summary: '계약을 종료했습니다.',
      before: '활성',
      after: '종료',
    },
    {
      at: Date.now() - 30 * HOUR,
      actor: '김운영',
      action: 'UPDATE',
      targetKind: 'SETTINGS',
      targetLabel: 'OTOPLUG observer',
      targetPurpose: null,
      summary: '설정을 저장했습니다.',
      before: '중지',
      after: '사용',
    },
  ];

  return rows.map((row) => {
    sequence += 1;
    return { ...row, id: `au-${sequence}` };
  });
}

let state: AuditState = { entries: seedEntries() };
const listeners = new Set<() => void>();

export function subscribeAudit(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getAuditSnapshot(): AuditState {
  return state;
}

export interface AuditInput {
  readonly action: AuditAction;
  readonly targetKind: AuditTargetKind;
  readonly targetLabel: string;
  readonly targetPurpose?: AuditPurpose;
  readonly summary: string;
  readonly before?: string | null;
  readonly after?: string | null;
  /** 기록자를 따로 지정할 때. 비우면 로그인한 관리자다. */
  readonly actor?: string;
  /**
   * 같은 편집을 하나로 합치는 키. 같은 대상의 같은 항목을 뜻한다.
   *
   * 텍스트 입력은 글자마다 저장되므로 그대로 기록하면 "차량번호를 고쳤다"
   * 한 번이 로그 20줄이 된다. 같은 키가 짧은 시간 안에 다시 오면 마지막
   * 기록을 갈아치우고 **변경 전 값은 처음 것을 유지한다** — 감사에서 알고 싶은
   * 것은 중간 과정이 아니라 "무엇이 무엇으로 바뀌었나"다.
   */
  readonly coalesceKey?: string;
}

/** 이 시간 안에 같은 항목을 또 고치면 한 줄로 합친다. */
const COALESCE_WINDOW_MS = 90_000;

/** 합칠 대상을 찾기 위해 마지막 기록의 키를 들고 있는다. */
const coalesceKeys = new Map<string, string>();

/**
 * 기록을 남긴다. 최신이 앞이다.
 *
 * **거부된 동작은 기록하지 않는다.** 막힌 이동은 아무것도 바꾸지 않았으므로
 * 감사 로그에 남으면 "바뀐 것"을 찾는 사람을 오히려 헷갈리게 한다.
 */
export function logAudit(input: AuditInput): void {
  const now = Date.now();
  const who = input.actor ?? actor;

  if (input.coalesceKey) {
    const previousId = coalesceKeys.get(input.coalesceKey);
    const head = state.entries[0];
    // 직전 기록이어야 합친다. 사이에 다른 동작이 끼면 순서가 뒤집힌다.
    if (previousId && head && head.id === previousId && now - head.at < COALESCE_WINDOW_MS) {
      const merged: AuditEntry = {
        ...head,
        at: now,
        after: input.after ?? null,
      };
      // 되돌려 놓았으면 바뀐 것이 없다. 기록을 남기지 않는다.
      const rest = state.entries.slice(1);
      state = { entries: merged.before === merged.after ? rest : [merged, ...rest] };
      if (merged.before === merged.after) coalesceKeys.delete(input.coalesceKey);
      listeners.forEach((listener) => listener());
      return;
    }
  }

  sequence += 1;
  const entry: AuditEntry = {
    id: `au-${sequence}`,
    at: now,
    actor: who,
    action: input.action,
    targetKind: input.targetKind,
    targetLabel: input.targetLabel,
    targetPurpose: input.targetPurpose ?? null,
    summary: input.summary,
    before: input.before ?? null,
    after: input.after ?? null,
  };
  if (input.coalesceKey) coalesceKeys.set(input.coalesceKey, entry.id);
  state = { entries: [entry, ...state.entries] };
  listeners.forEach((listener) => listener());
}

/**
 * 목적격 조사. 종성이 있으면 `을`, 없으면 `를`.
 *
 * "메모 을 고쳤습니다" 처럼 조사를 고정하면 로그가 기계 번역처럼 읽힌다.
 * 항목 이름이 데이터에서 오므로 붙이는 쪽에서 계산해야 한다.
 */
export function objectParticle(word: string): string {
  const last = word.trim().slice(-1);
  const code = last.charCodeAt(0);
  // 한글 음절이 아니면 판단할 수 없다. 영문·괄호로 끝나는 이름은 `을` 이 무난하다.
  if (code < 0xac00 || code > 0xd7a3) return '을';
  return (code - 0xac00) % 28 === 0 ? '를' : '을';
}

export function auditActors(entries: readonly AuditEntry[]): readonly string[] {
  return [...new Set(entries.map((entry) => entry.actor))].sort();
}

export type AuditRange = 'TODAY' | 'WEEK' | 'ALL';

export const RANGE_LABEL: Record<AuditRange, string> = {
  TODAY: '오늘',
  WEEK: '7일',
  ALL: '전체',
};

export function withinRange(entry: AuditEntry, range: AuditRange, now: number): boolean {
  if (range === 'ALL') return true;
  if (range === 'WEEK') return entry.at >= now - 7 * 24 * HOUR;
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  return entry.at >= start.getTime();
}
