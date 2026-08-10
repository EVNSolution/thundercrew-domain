import type { ModeId, ScreenId } from '../app-modes';

/**
 * 화면 껍데기의 내용 계획.
 *
 * 슬라이스 1 은 셸·진입·화면 껍데기까지다. 각 화면이 어떤 패널로 구성되고
 * 어떤 데이터를 어디서 읽을지를 여기 선언해 두고, 껍데기가 그대로 렌더한다.
 * 화면을 실제로 채울 때 이 목록을 컴포넌트로 하나씩 바꿔 나간다.
 *
 * 기준: docs/frontend/03-screen-feature-map.md
 */

export interface PlannedPanel {
  readonly title: string;
  readonly note: string;
  /** 데이터 출처. 아직 없는 것은 "신규"로 둔다. */
  readonly source: string;
  readonly layout: '관제형' | '표형' | '목록+상세형' | '폼형';
}

export interface ScreenPlan {
  readonly panels: readonly PlannedPanel[];
  /** 이 화면에서 아직 정해지지 않은 것. QA 중 판단이 필요한 지점. */
  readonly open: readonly string[];
}

type PlanKey = `${ModeId}:${ScreenId}`;

export const SCREEN_PLANS: Partial<Record<PlanKey, ScreenPlan>> = {
  'delivery:control': {
    panels: [
      { title: 'KPI', note: '차량 수, 운행 중, 미배정 주문, 미수신', source: 'GET /dashboard/map-state?purpose=DELIVERY', layout: '관제형' },
      { title: '지도', note: '차량 핀(권역 색), 스테이션 핀, 미배정 주문 핀', source: '같음', layout: '관제형' },
      { title: '권역 필터', note: '권역 on/off', source: '로컬', layout: '관제형' },
      { title: '차량 상세', note: '상태, 배터리, 라이더, 함체 상태, 정비 요약', source: 'GET /dashboard/bike-snapshot/{id}', layout: '관제형' },
      { title: '잡은 주문', note: '순서 없이 잡은 시각순', source: 'GET /dispatch-orders?bikeId=', layout: '관제형' },
      { title: '시동 제어 · 경로 재생 · 팁', note: '현장 대응', source: 'POST /bikes/{id}/ignition, /tips', layout: '관제형' },
    ],
    open: ['미배정 주문을 지도 핀으로 띄울지', '여러 주문을 잡았을 때 순서가 없어 경로선을 그릴 수 없음'],
  },
  'delivery:dispatch': {
    panels: [
      { title: '주문 등록', note: '맨 위. 고객명·연락처·주소·권역·메모 → 풀에 올리기', source: 'POST /dispatch-orders', layout: '표형' },
      { title: '미배정 주문', note: '경과 시간. 방치 임계 초과는 빨강 + 직접 배정', source: 'GET /dispatch-orders?status=OFFERED', layout: '표형' },
      { title: '잡힌 주문', note: '잡은 시각, 풀 대기, 잡은 경로(배송원/운영자)', source: 'GET /dispatch-orders?status=ASSIGNED', layout: '표형' },
    ],
    open: ['방치 임계 기본값', '한 배송원이 동시에 잡을 수 있는 건수 제한', '잡은 주문 반납 허용 여부', '주문 마감 시각 개념'],
  },
  'delivery:records': {
    panels: [
      { title: '풀 대기 시간', note: '평균·최대 대기, 방치 발생, 운영자 지정 건수', source: '파생', layout: '표형' },
      { title: '완료 배송', note: '완료 시각, 풀 대기, 차량, 배송원, 주소, 증빙', source: 'GET /dispatch-orders?status=DONE', layout: '표형' },
      { title: '주문 상세', note: '등록 → 잡힘 → 완료 세 시각과 간격', source: '같음', layout: '표형' },
    ],
    open: ['보존 기간과 페이지네이션'],
  },
  'delivery:master-data': {
    panels: [
      { title: '차량', note: '용도는 읽기 전용 + 이동 버튼. 장비에 함체 포함', source: 'GET /bikes?purpose=DELIVERY', layout: '목록+상세형' },
      { title: '라이더', note: '직무는 읽기 전용 + 이동 버튼. 숙련도·권역·교육', source: 'GET /riders?role=RIDER', layout: '목록+상세형' },
      { title: '계약', note: '인수방식 = 인수 / 반납', source: 'GET /rider-bike-contracts', layout: '목록+상세형' },
      { title: '보험', note: '라이더 보험 연결 + 항목', source: 'GET /rider-insurances, /insurance-items', layout: '목록+상세형' },
      { title: '스테이션 · 장비 · 단말 · 권역', note: '클린차량 관리와 같은 데이터 (공유)', source: 'GET /battery-stations, /equipment-types, /devices, 권역 신규', layout: '목록+상세형' },
    ],
    open: ['용도 이동 시 활성 계약 처리 — 종료 강제 vs 인수방식 재선택', '등록 직후 일정 기간은 제약 없이 이동 허용할지'],
  },
  'cleaning:control': {
    panels: [
      { title: 'KPI', note: '오늘 예약, 진행 중, 지연, 완료', source: 'map-state 확장 필요', layout: '관제형' },
      { title: '예정 타임라인', note: '주 표현. 시간축 × 차량. 현재 시각선, 지연 블록', source: 'dispatch_orders.service_scheduled_at', layout: '관제형' },
      { title: '지도', note: '보조. 차량 핀, 서비스 지점', source: 'GET /dashboard/map-state?purpose=CLEANING', layout: '관제형' },
      { title: '차량 상세', note: '예정 시각, 실제 도착, 편차, 예상 소요, 고객 알림', source: 'bike-snapshot 확장', layout: '관제형' },
      { title: '남은 예약 · 지연 전파', note: '예정 조정, 고객 재알림', source: 'PATCH /dispatch-orders/{id}', layout: '관제형' },
    ],
    open: ['타임라인과 지도 비율', '타임라인 시간 범위 기본값', '지연 전파를 자동으로 밀어줄지'],
  },
  'cleaning:dispatch': {
    panels: [
      { title: '오늘 예약', note: '시간순. 예정·소요·차량·클리너·방식·지점·상태', source: 'GET /dispatch-orders', layout: '표형' },
      { title: '순차 등록', note: '지점 행 N개(예정 시각·소요·주소). 순서는 시각 정렬 결과로 읽기 전용', source: 'POST /dispatch-orders', layout: '표형' },
      { title: '시간 충돌 검사', note: '같은 차량의 예정+소요 구간 겹침 경고', source: '신규', layout: '표형' },
      { title: '왕복 등록', note: '수거 일괄 → 배송 단계 전환', source: 'POST /dispatch-batches', layout: '표형' },
    ],
    open: ['시간 충돌을 경고로 둘지 차단으로 둘지', 'sequence 를 저장하지 않고 조회 시 정렬 — 확정 필요', '드래그로 순서를 바꾸고 시각이 따라오는 방식을 원하면 이 결정이 뒤집힘'],
  },
  'cleaning:records': {
    panels: [
      { title: '시각 준수', note: '정시율, 평균 편차, 최대 지연, 평균 소요', source: '파생', layout: '표형' },
      { title: '완료 서비스', note: '예정, 도착, 편차, 소요, 차량, 클리너', source: 'GET /dispatch-orders?status=DONE', layout: '표형' },
      { title: '고객 알림 결과', note: '발송 시각, 종류, 성공·실패', source: 'notifications', layout: '표형' },
    ],
    open: ['지연 원인을 입력받을지 시스템이 추정할지', '정시 기준 — 몇 분 이내'],
  },
  'cleaning:master-data': {
    panels: [
      { title: '차량', note: '용도는 읽기 전용 + 이동 버튼. 함체 제외', source: 'GET /bikes?purpose=CLEANING', layout: '목록+상세형' },
      { title: '클리너', note: '직무는 읽기 전용 + 이동 버튼', source: 'GET /riders?role=CLEANER', layout: '목록+상세형' },
      { title: '계약', note: '인수방식 = 직영 / 협력', source: 'GET /rider-bike-contracts', layout: '목록+상세형' },
      { title: '보험', note: '클리너 보험 연결 + 항목', source: 'GET /rider-insurances', layout: '목록+상세형' },
      { title: '스테이션 · 장비 · 단말 · 권역', note: '배송용 관리와 같은 데이터 (공유)', source: '같음', layout: '목록+상세형' },
    ],
    open: ['협력 계약에 협력사 정보(업체명·정산 조건)가 필요한지'],
  },
  'maintenance:maintenance-vehicles': {
    panels: [
      { title: '차량', note: '전 차량. 용도 칩 + 휠·엔진. 용도 필터는 선택(기본 전체)', source: 'GET /bikes', layout: '목록+상세형' },
      { title: '정비 체크리스트', note: '(휠 × 엔진) 6분류에 맞는 품목. 체크 시 기록 생성', source: 'POST /vehicle-maintenance-records', layout: '목록+상세형' },
      { title: '체크 입력', note: '주행거리, 담당자', source: '같음', layout: '목록+상세형' },
    ],
    open: ['체크 해제(오입력 취소) — 기록 삭제 vs 취소 기록 추가', '조치 필요 차량을 상단 고정할지', '정비소가 여러 곳이면 정비 위치 개념 필요'],
  },
  'maintenance:maintenance-items': {
    panels: [
      { title: '품목', note: '품목명, 적용 분류, 주기(km/월), 알림 임계, 적용 차량 수', source: 'GET /maintenance-items', layout: '목록+상세형' },
      { title: '적용 분류', note: '휠 × 엔진 6분류 다중 선택. LPG 2분류 신규', source: '같음', layout: '목록+상세형' },
    ],
    open: ['km 과 개월을 둘 다 넣으면 어느 쪽 기준인지', 'LPG 분류 추가 시 기존 내연 품목 재부여 검수'],
  },
  'maintenance:maintenance-records': {
    panels: [
      { title: '요약', note: '실시 건수, 대상 차량, 현재 초과·임박', source: '파생', layout: '표형' },
      { title: '정비 기록', note: '실시 시각, 차량, 용도 칩, 품목, 주행거리, 담당자', source: 'GET /vehicle-maintenance-records', layout: '표형' },
    ],
    open: ['비용 항목이 필요한지'],
  },
};

/** 전역 화면은 모드와 무관하게 같은 계획을 쓴다. */
export const GLOBAL_SCREEN_PLANS: Partial<Record<ScreenId, ScreenPlan>> = {
  audit: {
    panels: [
      { title: '작업 로그', note: '시각, 행위자, 대상, 대상 용도, 동작, 변경 전후', source: 'GET /audit-logs', layout: '표형' },
    ],
    open: ['변경 전후 값을 표에서 바로 보여줄지', '보존 기간'],
  },
  diagnostics: {
    panels: [
      { title: '무결성 점검', note: '참조 정합성 스캔 결과. 읽기 전용', source: 'GET /integrity/reference-checks', layout: '표형' },
      { title: '미수신 차량', note: '임계 이상 수신 없는 차량. 용도 컬럼 + 필터', source: 'TelemetryCurrentState', layout: '표형' },
      { title: '단말 동기화 로그', note: 'OTOPLUG 동기화 결과', source: 'GET /device-api-sync-logs', layout: '표형' },
      { title: '텔레메트리 수집 오류', note: '실패 원인과 단계', source: 'TelemetryIngestionErrorLog', layout: '표형' },
      { title: '재시동 알림 이력', note: '발생·확인 기록', source: 'GET /reignition-notifications', layout: '표형' },
    ],
    open: ['텔레메트리 로그 기간 필터 기본값을 좁게', '재시동 알림이 진단인지 이력인지'],
  },
  settings: {
    panels: [
      { title: '테마', note: '액센트 색 (라이트/다크)', source: '신규', layout: '폼형' },
      { title: '알림 기준', note: '배송 방치 임계, 클리닝 서비스 임박, 정비 임박, 미수신 경보', source: '신규', layout: '폼형' },
      { title: '텔레메트리', note: '수집 on/off, 수집 주기', source: 'TelemetryIngestion', layout: '폼형' },
      { title: '단말 연동', note: 'OTOPLUG observer', source: 'GET /otoplug/observers', layout: '폼형' },
      { title: '관리자 계정', note: '비밀번호 변경, 로그아웃', source: '/auth/*', layout: '폼형' },
    ],
    open: ['테마 색 설정 권한 — 관리자 전원이 바꿀 수 있으면 전역 설정이 계속 흔들림'],
  },
};

export function resolveScreenPlan(mode: ModeId, screen: ScreenId): ScreenPlan | undefined {
  return GLOBAL_SCREEN_PLANS[screen] ?? SCREEN_PLANS[`${mode}:${screen}`];
}
