# 배송 완료(사진 증빙) + 단일 배차 무순서 목록 — 설계

## 목표
차량 상세의 배차 큐에서 운영자가 배송 건을 완료할 때 **사진 1장을 필수로 첨부**하고, 완료 이벤트를 **공통 audit_logs에 로그로 남긴다**. 단일 배차 큐는 "현재/대기 순서" 대신 **무순서 배송 목록**으로 표시한다(기사가 순서를 알아서 정한다는 의미). 순차/왕복은 기존 순서 + 거리·ETA 유지. 기사 앱은 이번 범위 제외(운영자가 admin 웹에서 완료 대행).

## 결정
- 사진 저장: **DB bytea** (신규 객체스토리지 인프라 없이 진행). 업로드 최대 ~5MB.
- 사진: 건당 **1장, 완료 필수**(없으면 완료 불가).
- 적용 범위: **모든 배차(단일+순차+왕복) 완료**에 사진 필수.
- 로그: ⑤의 **공통 audit_logs 재사용**(배송 완료 이벤트), 사진 bytea는 주문에 별도 저장.

## 데이터 모델 (V43)
`dispatch_orders` 컬럼 추가:
- `completion_photo` bytea (nullable)
- `completion_photo_content_type` varchar(100) (nullable)
- `completed_by` uuid (nullable)
(`completed_at` 기존)

## 백엔드
- `DispatchOrder.complete(Instant when, byte[] photo, String contentType, UUID completedBy)` — photo null/empty면 거부(도메인 불변식). status ASSIGNED→COMPLETED.
- `POST /api/v1/dispatch-orders/{id}/complete` → 멀티파트(`@RequestPart("photo") MultipartFile photo`) 필수. 5MB 초과/빈 파일 거부(400).
- 완료 서비스에서 **AuditLogCommandService.record**(entityType=`DISPATCH_ORDER`, entityId=orderId, field=`status`, oldValue=`ASSIGNED`, newValue=`COMPLETED`, actor=completedBy) 호출(백엔드 원자적 기록).
- `GET /api/v1/dispatch-orders/{id}/completion-photo` → 이미지 바이트 + content-type(read 컨트롤러).
- `GET /api/v1/dispatch-orders/completed?bikeId=` → 그 차량의 완료 주문 목록(사진 bytea 제외, 메타 + hasCompletionPhoto만). 리포지토리 `findByBikeIdAndStatusAndDeletedAtIsNullOrderByCompletedAtDesc`.
- `DispatchOrderReadResponse`에 `completedBy`, `hasCompletionPhoto` 추가(바이트 미포함).
- 배치(라운드) 완료도 주문 단위 complete를 거치므로 동일 규칙.

## 프론트엔드
- 차량 상세 `DispatchQueueSection`:
  - **배송 패밀리(단일/CALL/OTHER)**: 무순서 목록(현재/대기·ETA 없음). 각 건: 고객·연락처·주소(·출발지) + [완료(사진)] + [취소].
  - **청소 패밀리(순차/왕복)**: 기존 현재/대기 + 거리·ETA 유지.
- [완료(사진)] 버튼: 숨은 file input(capture) → 사진 1장 선택 시 멀티파트 완료 호출(필수). 성공 시 목록에서 제거.
- **완료 내역** 접이식 섹션: 그 차량의 최근 완료 배송 + 사진 보기(썸네일). 사진은 same-origin Next.js 프록시 라우트(`/api/dispatch/completion-photo/[id]`)가 백엔드에서 인증 fetch해 스트리밍 → `<img src>`로 표시.
- `completeDispatchOrderAction`이 사진(File)을 받도록 변경 — 모든 완료 호출부가 사진 업로드 흐름이 됨.

## 검증
- 백엔드: compileJava/compileTestJava + 멀티파트 완료→사진 저장→GET 반환, 사진 없으면 거부, audit 기록 contract 테스트.
- 프론트: typecheck/lint/build.
- prod: 배차 건 완료(사진 첨부)→목록 제거 + 완료 내역에서 사진 확인 + audit 적재.

## 범위 밖
기사 모바일 앱, 객체스토리지 전환, 사진 여러 장.
