import type {
  BatteryStation,
  BikeDeviceInstallation,
  BikeEquipment,
  ContractTemplate,
  Device,
  EquipmentType,
  InsuranceItem,
  InsurancePolicy,
  Rider,
  RiderContract,
  Vehicle
} from "@/types/domain";

export const riders: Rider[] = [
  { slug: "kim-minjun", name: "김민준", phone: "010-2411-9021", team: "강남 1팀", area: "강남/역삼", status: "활동", joinedAt: "2026-01-12" },
  { slug: "lee-hana", name: "이하나", phone: "010-3844-1750", team: "서초 2팀", area: "서초/방배", status: "활동", joinedAt: "2026-02-03" },
  { slug: "park-doyun", name: "박도윤", phone: "010-7752-3301", team: "송파 1팀", area: "잠실/석촌", status: "대기", joinedAt: "2026-03-18" }
];

export const vehicles: Vehicle[] = [
  { slug: "seoul-ba-4821", plateNumber: "서울바4821", model: "NIU NQi Cargo", status: "운행 중", assignmentStatus: "배정됨", batteryPercent: 78, riderName: "김민준", locationLabel: "강남역 11번 출구", lastSeenAt: "3분 전" },
  { slug: "seoul-ba-7390", plateNumber: "서울바7390", model: "Gogoro 2 Utility", status: "점검 필요", assignmentStatus: "미배정", batteryPercent: 21, locationLabel: "역삼 정비 거점", lastSeenAt: "18분 전" },
  { slug: "seoul-ba-1168", plateNumber: "서울바1168", model: "Thundercrew E2", status: "대기", assignmentStatus: "교대 예정", batteryPercent: 94, riderName: "이하나", locationLabel: "서초 스테이션", lastSeenAt: "8분 전" }
];


export const contractTemplates: ContractTemplate[] = [
  {
    slug: "unlimited-contract",
    name: "무제한 계약",
    durationMinutes: null,
    unlimited: true,
    durationLabel: "무제한",
    description: "기간 제한 없이 운영자가 별도 종료할 때까지 유지",
    enabled: true,
    systemTemplate: true
  },
  {
    slug: "standard-12-days",
    name: "표준 12일",
    durationMinutes: 17280,
    unlimited: false,
    durationLabel: "12일",
    description: "12일 단위 바이크 이용 계약",
    enabled: true,
    systemTemplate: false
  },
  {
    slug: "trial-3-days",
    name: "체험 3일",
    durationMinutes: 4320,
    unlimited: false,
    durationLabel: "3일",
    description: "단기 체험 운영 계약",
    enabled: false,
    systemTemplate: false
  }
];

export const contracts: RiderContract[] = [
  { slug: "contract-kim-minjun-2026", riderName: "김민준", contractType: "위탁 운영 계약", startsAt: "2026-01-15", endsAt: "2026-12-31", status: "활성", area: "강남/역삼" },
  { slug: "contract-lee-hana-2026", riderName: "이하나", contractType: "정규 운영 계약", startsAt: "2026-02-10", endsAt: "2026-06-30", status: "만료 예정", area: "서초/방배" },
  { slug: "contract-park-doyun-draft", riderName: "박도윤", contractType: "파트타임 계약", startsAt: "2026-05-01", endsAt: "2026-08-31", status: "초안", area: "송파/잠실" }
];


export const insuranceItems: InsuranceItem[] = [
  { slug: "hyundai-rider-basic", name: "현대해상 라이더 기본", description: "라이더 기본 책임보험 항목", enabled: true },
  { slug: "samsung-rider-plus", name: "삼성화재 라이더 플러스", description: "보장 확장형 라이더 보험 항목", enabled: true },
  { slug: "db-bike-legacy", name: "DB손해보험 차량 구형", description: "차량 보험 후속 확장용 비활성 항목", enabled: false }
];

export const insurancePolicies: InsurancePolicy[] = [
  { slug: "ins-kim-minjun", holderLabel: "김민준 · 010-2411-9021", targetType: "라이더", provider: "현대해상", policyNumber: "HD-26-884102", startsAt: "2026-01-15", endsAt: "2027-01-14", status: "정상" },
  { slug: "ins-lee-hana", holderLabel: "이하나 · 010-3844-1750", targetType: "라이더", provider: "삼성화재", policyNumber: "SS-91-24015", startsAt: "2026-02-10", endsAt: "2027-02-09", status: "정상" }
];

export const stations: BatteryStation[] = [
  { slug: "gangnam-station", name: "강남 교체 스테이션", address: "서울 강남구 테헤란로 152", status: "운영 중", batteryCount: 48, replaceableCount: 31, latitude: 37.5007, longitude: 127.0364 },
  { slug: "seocho-station", name: "서초 물류 스테이션", address: "서울 서초구 사임당로 174", status: "운영 중", batteryCount: 35, replaceableCount: 19, latitude: 37.4921, longitude: 127.0242 },
  { slug: "songpa-station", name: "송파 점검 스테이션", address: "서울 송파구 올림픽로 300", status: "점검 중", batteryCount: 22, replaceableCount: 4, latitude: 37.5145, longitude: 127.1059 }
];

export const equipmentTypes: EquipmentType[] = [
  { slug: "brake-pad", name: "브레이크 패드", description: "제동계 소모품", enabled: true },
  { slug: "controller", name: "컨트롤러", description: "전기 이륜차 구동 제어 장치", enabled: true },
  { slug: "tire", name: "타이어", description: "전후륜 타이어", enabled: true }
];

export const bikeEquipments: BikeEquipment[] = [
  {
    slug: "equip-seoul-ba-4821-brake",
    bikeLabel: "서울바4821 · NIU NQi Cargo",
    equipmentTypeName: "브레이크 패드",
    equipmentLabel: "전륜 브레이크 패드",
    modelName: "BP-Urban-01",
    serialNumber: "BP-4821-F",
    installedAt: "2026-01-15T09:00:00+09:00",
    managementDueDate: "2026-05-15",
    managementStatus: "관리 예정",
    managementNote: "5월 정기점검 때 교체 여부 확인",
    memo: "강남 운영 차량"
  },
  {
    slug: "equip-seoul-ba-7390-controller",
    bikeLabel: "서울바7390 · Gogoro 2 Utility",
    equipmentTypeName: "컨트롤러",
    equipmentLabel: "메인 컨트롤러",
    modelName: "CTRL-G2",
    serialNumber: "CTRL-7390-M",
    installedAt: "2025-11-20T10:30:00+09:00",
    managementDueDate: "2026-04-20",
    managementStatus: "기한 초과",
    managementNote: "점검 입고 필요",
    memo: "점검 필요 차량"
  }
];

export const devices: Device[] = [
  {
    slug: "dev-4821-main",
    deviceUid: "TDEV-SEOUL-4821",
    manufacturer: "ThunderDevice",
    modelName: "TD-100",
    enabled: true,
    memo: "서울바4821 설치 단말"
  },
  {
    slug: "dev-7390-spare",
    deviceUid: "TDEV-SEOUL-7390",
    manufacturer: "ThunderDevice",
    modelName: "TD-100",
    enabled: true,
    memo: "점검 차량 예비 단말"
  },
  {
    slug: "dev-disabled-001",
    deviceUid: "TDEV-DISABLED-001",
    manufacturer: "ThunderDevice",
    modelName: "TD-050",
    enabled: false,
    memo: "설치 불가 비활성 단말"
  }
];

export const bikeDeviceInstallations: BikeDeviceInstallation[] = [
  {
    slug: "install-seoul-ba-4821-main",
    bikeLabel: "서울바4821 · NIU NQi Cargo",
    deviceLabel: "TDEV-SEOUL-4821 · TD-100",
    deviceUid: "TDEV-SEOUL-4821",
    installedAt: "2026-04-01T09:00:00+09:00",
    status: "설치 중",
    memo: "운영 중 단말"
  },
  {
    slug: "install-seoul-ba-7390-old",
    bikeLabel: "서울바7390 · Gogoro 2 Utility",
    deviceLabel: "TDEV-SEOUL-7390 · TD-100",
    deviceUid: "TDEV-SEOUL-7390",
    installedAt: "2026-03-15T10:30:00+09:00",
    removedAt: "2026-04-20T11:00:00+09:00",
    status: "제거됨",
    memo: "점검 입고로 제거"
  }
];

export const dashboardMetrics = [
  { label: "총 차량 수", value: vehicles.length, caption: "등록 기준" },
  { label: "운행 중 차량", value: vehicles.filter((v) => v.status === "운행 중").length, caption: "실시간 관제 mock" },
  { label: "점검 필요 차량", value: vehicles.filter((v) => v.status === "점검 필요").length, caption: "상태 변경 필요" },
  { label: "등록 라이더", value: riders.length, caption: "활동/대기 포함" },
  { label: "계약 만료 예정", value: contracts.filter((c) => c.status === "만료 예정").length, caption: "60일 이내" },
  { label: "보험 만료 예정", value: insurancePolicies.filter((p) => p.status === "만료 예정").length, caption: "60일 이내" },
  { label: "배터리 스테이션", value: stations.length, caption: "운영 거점" },
  { label: "교체 가능 배터리", value: stations.reduce((sum, station) => sum + station.replaceableCount, 0), caption: "전체 거점 합계" }
];
