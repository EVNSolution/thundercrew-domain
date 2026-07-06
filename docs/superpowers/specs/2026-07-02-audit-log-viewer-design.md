# 작업 로그(감사로그) 열람 + actor·핵심 CRUD 감사 추가 Design

**Date:** 2026-07-02
**Branch:** `cc-audit-log-viewer` (off `dev`)
**Status:** Approved (design), pending spec review
**Asana:** (CLEVER) SI-썬더크루 → "웹사이트 수정 사항" #5 "업무·자원 관리 작업 로그 열람 기능"

---

## 1. 배경 / 결정

운영자가 업무관리·자원관리에서 한 작업(배차 생성/수정, 차량·라이더·매칭 CRUD 등) 이력을 조회할 수 있게 한다.

기존 인프라(활용 확인 완료):
- `audit_logs` 테이블(V42): `entity_type, entity_id, field, old_value, new_value, actor, occurred_at` + 표준 감사컬럼. 인덱스 `(entity_type, entity_id)`, `(occurred_at desc)`.
- 읽기/쓰기 API `GET/POST /api/v1/audit-logs`(ADMIN 전용), 프론트 클라이언트 `listAuditLogs()`/`recordAuditLog()` 존재.

두 가지 공백:
1. **actor가 항상 null** — 누가 했는지 안 남음(프론트가 안 보냄, 백엔드가 null 세팅).
2. **감사 커버리지가 얇음** — 현재 기록: 차량 운영상태 변경·정비 완료·라이더 보험(프론트) + 배차 완료(백엔드)뿐. **차량/라이더/매칭/배차 CRUD는 미기록** → 뷰어만 붙이면 볼 게 없음.

**결정(사용자 승인): 뷰어 + actor 캡처 + 핵심 CRUD 서버사이드 감사 추가.**

---

## 2. 목표 / 비목표

**목표**
- 관리 화면에 작업 로그 조회 UI 추가.
- 모든 감사 기록에 actor(로그인 관리자) 자동 기록.
- 핵심 command 경로(차량·라이더·매칭·배차 CRUD)에 서버사이드 감사 기록 추가.

**비목표**
- 필드별 상세 diff — 안 함(이벤트 단위 요약 기록). 
- 전체 command 경로 감사(정비 카탈로그 등 비핵심) — 이번 범위 밖.
- audit_logs 스키마 변경 — 없음(기존 컬럼 그대로).
- 날짜범위/전문검색/무한 페이지네이션 — 안 함(entityType 필터 + limit로 충분).

---

## 3. actor 캡처 (한 곳)

`AuditLogCommandService.record()`가 현재 `actor=null`로 세팅. 이를 **Spring SecurityContext에서 인증 principal(관리자 loginId)을 꺼내 actor로 채우도록** 변경.
- `SecurityContextHolder.getContext().getAuthentication()`의 name(=loginId). 인증 없거나 익명이면 null 유지(안전).
- `POST /api/v1/audit-logs`는 ADMIN 인증이므로, **기존 프론트 감사(상태·정비·보험)도 이 변경만으로 actor가 자동으로 남는다.** 프론트는 actor 안 보냄(현행 유지).
- 서버사이드 record 호출(§4)도 같은 컨텍스트라 actor 자동.

---

## 4. 핵심 CRUD 서버사이드 감사

각 command 서비스에 `AuditLogCommandService` 주입 후, 성공한 create/update/delete(+terminate) 시 감사 1건 기록. **이벤트 단위**(필드별 diff 아님):

| 서비스 | 이벤트 | entityType | field | newValue(사람이 읽는 식별자/요약) |
|--------|--------|-----------|-------|------------------------------------|
| `BikeCommandService` | create/update/softDelete | `BIKE` | `__created__`/`__updated__`/`__deleted__` | 차량번호(+요약) |
| `RiderCommandService` | create/update/delete | `RIDER` | 동일 | 이름/연락처 |
| `RiderBikeContractCommandService` | create/update/terminate | `CONTRACT` | `__created__`/`__updated__`/`__terminated__` | "차량번호↔라이더" |
| `DispatchOrderCommandService` | create/update | `DISPATCH_ORDER` | `__created__`/`__updated__` | 고객명/주소 요약 (완료는 기존 유지) |

- `entity_id` = 해당 엔티티 id, `field` NOT NULL이라 위 sentinel 사용, `old_value`는 delete/terminate에서 식별자, 그 외 null.
- 기록은 **성공 트랜잭션 내 마지막**에(실패 시 안 남게). 배차 완료의 기존 `DISPATCH_ORDER/status` 기록은 유지.
- entityType 상수: 기존(`BIKE_OPERATION_STATUS`·`MAINTENANCE`·`RIDER_INSURANCE`) + 신규(`BIKE`·`RIDER`·`CONTRACT`·`DISPATCH_ORDER`). 프론트 뷰어가 라벨 매핑.

---

## 5. 읽기 API 소폭 확장

CRUD 감사가 늘면 최근 100으론 부족. `GET /api/v1/audit-logs`에 옵션 추가:
- `entityType`(옵션): 특정 유형만.
- `limit`(옵션, 기본 200, 최대 500): 최근 N건.
- 기존 `entityId` 필터 유지.
- 리포지토리: `entityType` 유무 분기 + limit 적용(native 또는 Pageable). 서비스 `list(entityType, limit)` / `listByEntity(entityId)`.
- ADMIN 게이트·정렬(occurred_at desc) 유지.

---

## 6. 조회 UI (신규 패널)

- **신규** `components/management/AuditLogManagementPanel.tsx`: 마운트 시 `client.listAuditLogs()` 호출, 표 렌더.
- 표 컬럼: **발생시각 · 작업자(actor) · 대상(entityType 라벨) · 항목(field 라벨) · 변경(old→new)**. actor null이면 "—".
- 상단에 **entityType 필터 칩**(전체/차량/라이더/매칭/배차/상태/정비/보험) — 선택 시 `listAuditLogs`에 entityType 전달(서버 필터).
- `field` sentinel 라벨링: `__created__`→"생성", `__updated__`→"수정", `__deleted__`→"삭제", `__terminated__`→"종료", 그 외 원문.
- **배치:** `/management/resources` 페이지 `SECTIONS`에 `{ id: "mgmt-logs", label: "작업 로그" }` 추가 + `<section id="mgmt-logs"><AuditLogManagementPanel/></section>`.
- 프론트 타입: `ServiceOpsAuditLog`에 `actor` 포함 확인(백엔드 ReadResponse에 이미 있음) — 매핑만.

---

## 7. 테스트

**백엔드 계약테스트(Testcontainers/Docker 필요 — 로컬 무Docker 시 미실행, [[reference_no_backend_test_ci]] 참고. compileTestJava + 가능시 실행):**
- `AuditLogApiContractTests` 확장: (a) 인증 상태에서 record 시 **actor가 채워지는지**, (b) `entityType`/`limit` 필터 동작.
- 핵심 CRUD 각 계약테스트에 "작업 후 audit_logs에 해당 entityType 항목 1건 생김" 검증 추가(또는 감사 서비스 목킹 단위테스트).

**프론트:** typecheck + lint. 런타임은 사용자 dev/배포 후 QA(경쟁 서버 금지).

---

## 8. 손대는 파일 요약

| 파일 | 변경 |
|------|------|
| `audit/service/AuditLogCommandService.java` | record 시 actor=SecurityContext principal |
| `audit/repository/AuditLogRepository.java` + `AuditLogReadService.java` + `AuditLogReadController.java` | entityType 필터 + limit |
| `bike/service/BikeCommandService.java` | create/update/softDelete 감사 |
| `rider/service/RiderCommandService.java` | create/update/delete 감사 |
| `contract/service/RiderBikeContractCommandService.java` | create/update/terminate 감사 |
| `dispatch/service/DispatchOrderCommandService.java` | create/update 감사(완료는 기존) |
| 프론트 `components/management/AuditLogManagementPanel.tsx` (신규) + `app/management/resources/page.tsx` + `ManagementSectionNav` SECTIONS | 조회 UI |
| 프론트 `lib/services/service-ops-api.ts` | `listAuditLogs(entityType?, limit?)` 파라미터 확장, `ServiceOpsAuditLog.actor` |
| `AuditLogApiContractTests` + 핵심 CRUD 테스트 | actor·필터·커버리지 검증 |

## 9. 검증 계획
- 백엔드: `compileJava`/`compileTestJava` + (Docker 있으면) 감사 관련 테스트.
- 프론트: typecheck/lint.
- 런타임: 배포/사용자 dev에서 CRUD 후 작업 로그에 actor·항목이 뜨는지 QA.
