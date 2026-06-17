# 팁 제출→발행 플로우 (관리자/서버 측) — 설계

대형 앱 프로젝트 #3. 라이더 앱 제출 트리거는 별도 트랙; 여기선 서버+관리자.

## 모델 (기존 Tip에 상태 추가, V45)
- Tip에 `status`(PENDING|PUBLISHED, 기본 PUBLISHED — 기존 행/관리자 직접 추가는 PUBLISHED) + `submitted_by_rider_id`(uuid nullable) 추가.
- 라이더 제출: `POST /api/v1/tips/submissions` {address, content, latitude, longitude, riderId?} → status=PENDING Tip 생성 + 공통 notifications에 type=TIP_SUBMISSION 알림(title/ body=주소·내용, refEntityId=tipId, refRiderId).
- 발행: `POST /api/v1/tips/{id}/publish` → PENDING→PUBLISHED. (관리자)
- Tip read(지도 마커 + TipsPanel 목록)는 **PUBLISHED만** 노출. 펜딩은 알림/별도.

## 관리자 UI
- 알림 센터 TIP_SUBMISSION 항목(📍)에 **[발행]** 액션 → publish 호출 + 알림 acknowledge → 지도에 표시.
- TipsPanel: status 컬럼(대기/발행). (펜딩은 발행 전까지 지도 미표시)

## 전체 앱 표시
PUBLISHED 팁 = 기존 Tip read로 노출 → 앱이 나중에 소비. 웹 지도엔 즉시.

## QA
앱 없이 제출 엔드포인트를 API로 호출 → PENDING + 알림 → 발행 → 지도 표시 체인 검증.

## 범위 밖
라이더 앱 제출 UI, 앱 측 팁 표시.
