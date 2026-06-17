# 정비 % 알람 + 관리자 알림 센터 — 설계

대형 앱 프로젝트의 첫 서브프로젝트(백엔드/관리자웹). 앱은 별도 트랙.

## A. 정비 % 알람
- **알람 임계 %**: `MaintenanceItem.alert_threshold_percent`(int, nullable; null=알람 off, 기본 입력값 90). 정비 관리 항목 편집 다이얼로그에 입력.
- **소진율 계산**(기존 derive 동일 의미): 항목별로
  - 개월: (now − 최근 record.servicedAt) / cycleMonths
  - km: (현재 odometer − record.servicedAtOdometerKm) / cycleKm  (둘 다 있을 때만)
  - consumed = 사용 가능한 비율 중 **최댓값**. consumed ≥ threshold/100 → 알람.
  - **기준선 = 최근 정비 record**(표준 정비 의미). 최근 record 없으면(미정비) 이번 범위에선 알람 생성 안 함(기준선 없음).
- **평가 트리거**: 백엔드 `@Scheduled`(10분 주기, `@EnableScheduling`). 대상 = **operationStatus=IN_SERVICE 차량만**("운행 진입 시 체킹"). 차량별 적용 항목(카테고리=wheel×engine)에 대해 평가.
- **중복 방지**: 같은 (bikeId, itemId)에 대해, **최근 record.servicedAt 이후 생성된 미해제 MAINTENANCE_ALARM 알림**이 이미 있으면 재생성 안 함(현재 주기당 1회). 교환 완료(새 record)로 주기 리셋되면 다시 발생.
- **전달**: 웹 알림 센터 + 알림 레코드에 매칭 라이더 id 기록(앱이 나중에 읽음).
- ⚠️ prod 텔레메트리 odometer는 합성/null → **km 알람은 실데이터로 잘 안 뜸, 개월(시간) 알람은 정상**.

## B. 공통 알림 + 관리자 알림 센터
- **신규 `notifications` 테이블**: id, idx, `type`(varchar; MAINTENANCE_ALARM 등), `title`, `body`, `ref_bike_id`(uuid null), `ref_entity_id`(uuid null), `ref_rider_id`(uuid null), `occurred_at`, `acknowledged_at`(null), + base audit. 인덱스 (occurred_at desc), (acknowledged_at).
- **API**: `GET /api/v1/notifications?unacknowledgedOnly=&type=`(최근 top 100 desc), `POST /api/v1/notifications/{id}/acknowledge`. command 컨트롤러 arch allow-list 등록.
- **관리자 UX**: 기존 벨(🔔) 확장 — 미확인 배지 + 클릭 시 우측 슬라이드 패널. 항목별 유형 아이콘(⚙️정비/📍팁/🔑재시동)·차량·내용·시각 + **확인(acknowledge)** + 유형별 액션(정비→차량 상세, 팁→발행[나중]). 미확인 상단.
- 기존 reignition 알림 시드는 유지(점진 통합). 이번엔 generic notifications(정비 알람)를 추가 로드해 병합·그룹.

## 구현 범위
**백엔드(V44)**: maintenance_items.alert_threshold_percent + DTO; notifications 테이블/엔티티/repo/read+command 서비스/컨트롤러 + arch allow-list; @EnableScheduling + MaintenanceAlarmEvaluator(@Scheduled); 매칭 라이더 조회; 테스트.
**프론트**: ServiceOpsMaintenanceItem + alertThresholdPercent; MaintenanceItemDetailDialog % 입력; 알림 센터(NotificationContext/Bell + 우측 패널 + acknowledge + 유형 그룹/아이콘 + CSS) + generic notifications 클라이언트/액션.

## 범위 밖
라이더 앱 전달(앱 트랙), 팁 제출 플로우(#3), reignition 완전 통합.
