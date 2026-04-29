import type { BatteryStation, InsurancePolicy, Rider, RiderContract, Vehicle } from "@/types/domain";

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

export const contracts: RiderContract[] = [
  { slug: "contract-kim-minjun-2026", riderName: "김민준", contractType: "위탁 운영 계약", startsAt: "2026-01-15", endsAt: "2026-12-31", status: "활성", area: "강남/역삼" },
  { slug: "contract-lee-hana-2026", riderName: "이하나", contractType: "정규 운영 계약", startsAt: "2026-02-10", endsAt: "2026-06-30", status: "만료 예정", area: "서초/방배" },
  { slug: "contract-park-doyun-draft", riderName: "박도윤", contractType: "파트타임 계약", startsAt: "2026-05-01", endsAt: "2026-08-31", status: "초안", area: "송파/잠실" }
];

export const insurancePolicies: InsurancePolicy[] = [
  { slug: "ins-kim-minjun", holderLabel: "김민준 · 010-2411-9021", targetType: "라이더", provider: "현대해상", policyNumber: "HD-26-884102", startsAt: "2026-01-15", endsAt: "2027-01-14", status: "정상" },
  { slug: "ins-seoul-ba-4821", holderLabel: "서울바4821 · NIU NQi Cargo", targetType: "차량", provider: "DB손해보험", policyNumber: "DB-EM-7712", startsAt: "2025-07-01", endsAt: "2026-06-30", status: "만료 예정" },
  { slug: "ins-lee-hana", holderLabel: "이하나 · 010-3844-1750", targetType: "라이더", provider: "삼성화재", policyNumber: "SS-91-24015", startsAt: "2026-02-10", endsAt: "2027-02-09", status: "정상" }
];

export const stations: BatteryStation[] = [
  { slug: "gangnam-station", name: "강남 교체 스테이션", address: "서울 강남구 테헤란로 152", status: "운영 중", batteryCount: 48, replaceableCount: 31, latitude: 37.5007, longitude: 127.0364 },
  { slug: "seocho-station", name: "서초 물류 스테이션", address: "서울 서초구 사임당로 174", status: "운영 중", batteryCount: 35, replaceableCount: 19, latitude: 37.4921, longitude: 127.0242 },
  { slug: "songpa-station", name: "송파 점검 스테이션", address: "서울 송파구 올림픽로 300", status: "점검 중", batteryCount: 22, replaceableCount: 4, latitude: 37.5145, longitude: 127.1059 }
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
