# 드라이버 API Phase 1 (thundercrew 백엔드) Implementation Plan

> REQUIRED SUB-SKILL: superpowers:subagent-driven-development.

**Goal:** `clever-driver-app`이 쓸 라이더(드라이버)용 REST 엔드포인트를 `/api/v1/rider/me/*`에 추가한다. 읽기(완료배차·오퍼콜·팁·충전소·정비·알림) + 쓰기(콜 수락·배송 완료 사진), 전부 **본인 소유 검증**.

**Architecture:** 기존 `RiderSelfReadController`/`RiderSelfCommandController`(`/api/v1/rider`, JWT `riderId` → `activeBikeIdOrNull`) 패턴 확장. 기존 dispatch/tip/station/maintenance/notification 서비스 **재사용**. SecurityConfig(`/api/v1/rider/**`=ROLE_RIDER)·ArchUnit(`isRiderSelfCommand` 클래스 단위 allowlist) **변경 불필요**. 마이그레이션 없음.

**Spec:** [docs/superpowers/specs/2026-06-29-driver-app-integration-design.md](../specs/2026-06-29-driver-app-integration-design.md)

**확정 결정:**
- 완료 `completedBy` = `riderId`.
- 완료 소유권: 주문 `bikeId == 내 activeBikeId` 아니면 403.
- 오퍼콜: 내 차량 `serviceType==CALL`일 때만 목록 노출(아니면 빈 배열); accept는 서비스가 CALL 검증.
- 팁=PUBLISHED만, 충전소=ACTIVE만, 알림=`ref_rider_id==riderId OR ref_bike_id==내 bikeId`.
- 정비=내 차량 items+records 묶음(앱이 상태 파생).

---

## Task 1: 보강 read (data access) + DTO

**Files:**
- Modify: `tip/service/TipReadService.java` (+ repo if needed)
- Modify: `station/service/StationReadService.java` + `station/repository/BatteryStationRepository.java`
- Modify: `notification/service/NotificationReadService.java` + `notification/repository/NotificationRepository.java`
- Create: `rider/dto/RiderMaintenanceResponse.java`

- [ ] **Step 1: 팁 PUBLISHED 목록**
  `TipReadService`에 추가 (repo엔 `findByStatusAndDeletedAtIsNull(TipStatus)` 이미 있음):
  ```java
  public List<TipReadResponse> listPublished() {
      return tipRepository.findByStatusAndDeletedAtIsNull(TipStatus.PUBLISHED).stream()
              .map(TipReadResponse::from).toList();
  }
  ```
  (`TipReadResponse.from` 매핑이 기존에 있으면 재사용; 없으면 `listTips`가 쓰는 매핑 방식 그대로.)

- [ ] **Step 2: 충전소 ACTIVE 목록**
  `BatteryStationRepository`에 `List<BatteryStation> findByStatusAndDeletedAtIsNull(BatteryStationStatus status);` 추가.
  `StationReadService`에:
  ```java
  public List<BatteryStationReadResponse> listActive() {
      return stationRepository.findByStatusAndDeletedAtIsNull(BatteryStationStatus.ACTIVE).stream()
              .map(BatteryStationReadResponse::from).toList();
  }
  ```
  (매핑은 `listStations`가 쓰는 방식 재사용.)

- [ ] **Step 3: 알림 rider/bike 스코프**
  `NotificationRepository`에 JPQL 추가:
  ```java
  @Query("select n from Notification n where n.deletedAt is null "
       + "and (n.refRiderId = :riderId or n.refBikeId = :bikeId) order by n.occurredAt desc")
  List<Notification> findRecentForRiderOrBike(@Param("riderId") UUID riderId,
                                              @Param("bikeId") UUID bikeId, Pageable pageable);
  ```
  `NotificationReadService`에:
  ```java
  public List<NotificationReadResponse> listForRiderOrBike(UUID riderId, UUID bikeId) {
      return notificationRepository.findRecentForRiderOrBike(riderId, bikeId, PageRequest.of(0, 100))
              .stream().map(NotificationReadResponse::from).toList();
  }
  ```
  (bikeId가 null이면 `or n.refBikeId = null`이 되어 ref_bike_id=null 알림이 잡힐 수 있으니, service에서 bikeId null이면 임의의 매칭 안 되는 UUID를 넘기거나 별도 처리 — 안전하게: `bikeId == null ? new UUID(0,0) : bikeId`.)

- [ ] **Step 4: 정비 묶음 DTO**
  ```java
  public record RiderMaintenanceResponse(
      List<MaintenanceItemReadResponse> items,
      List<VehicleMaintenanceRecordReadResponse> records
  ) {}
  ```

- [ ] **Step 5: 컴파일**
  Run: `cd development/service-ops-api && ./gradlew compileJava` → BUILD SUCCESSFUL.

- [ ] **Step 6: Commit** `feat: rider-scoped read helpers (published tips, active stations, rider notifications, maintenance dto)`

---

## Task 2: 라이더 read 엔드포인트 + 계약 테스트

**Files:**
- Modify: `rider/controller/RiderSelfReadController.java`
- Modify: `rider/service/RiderVehicleReadService.java` (활성차량+CALL 판정 헬퍼가 없으면 bikeId만 재사용)
- Test: `src/test/java/com/thundercrew/opsapi/RiderDriverApiContractTests.java` (신설)

- [ ] **Step 1: 계약 테스트 작성(실패 확인)**
  `RiderDriverApiContractTests extends PostgresContainerSupport`. JWT 취득/시드 패턴은 `RiderSelfReadApiContractTests` 그대로(admin 시드 → rider 시드 → `PATCH /riders/{id}/credential` → `POST /rider-auth/login` → accessToken 추출). bike `service_type='CALL'` + 활성 contract 시드.
  테스트: 각 GET 200 + 모양 단언:
  - `GET /rider/me/dispatch-orders/completed` → 완료 주문 배열
  - `GET /rider/me/offered-calls` → (CALL 차량) OFFERED 주문 배열 / (비-CALL) 빈 배열
  - `GET /rider/me/tips` → PUBLISHED만(PENDING 시드 1건은 제외 확인)
  - `GET /rider/me/stations` → ACTIVE만(INACTIVE 시드 제외)
  - `GET /rider/me/maintenance` → `{items:[...], records:[...]}`
  - `GET /rider/me/notifications` → ref_rider_id/ref_bike_id 매칭만
  - 활성 차량 없는 라이더 → 배차/오퍼/정비 빈 결과(404 아님)

- [ ] **Step 2: 컨트롤러 GET 추가**
  `RiderSelfReadController`에 의존성(TipReadService, StationReadService, MaintenanceReadService, NotificationReadService) 주입 후:
  ```java
  @GetMapping("/me/dispatch-orders/completed")
  List<DispatchOrderReadResponse> myCompleted(@AuthenticationPrincipal Jwt jwt) {
      UUID bikeId = riderVehicleReadService.activeBikeIdOrNull(riderId(jwt));
      return bikeId == null ? List.of() : dispatchOrderReadService.listCompletedByBike(bikeId);
  }

  @GetMapping("/me/offered-calls")
  List<DispatchOrderReadResponse> myOfferedCalls(@AuthenticationPrincipal Jwt jwt) {
      UUID bikeId = riderVehicleReadService.activeBikeIdOrNull(riderId(jwt));
      if (bikeId == null) return List.of();
      // 내 차량이 CALL 일 때만 노출
      if (!riderVehicleReadService.isCallBike(bikeId)) return List.of();
      return deliveryCallService.listOffered();
  }

  @GetMapping("/me/tips")
  List<TipReadResponse> myTips() { return tipReadService.listPublished(); }

  @GetMapping("/me/stations")
  List<BatteryStationReadResponse> myStations() { return stationReadService.listActive(); }

  @GetMapping("/me/maintenance")
  RiderMaintenanceResponse myMaintenance(@AuthenticationPrincipal Jwt jwt) {
      UUID bikeId = riderVehicleReadService.activeBikeIdOrNull(riderId(jwt));
      if (bikeId == null) return new RiderMaintenanceResponse(List.of(), List.of());
      return new RiderMaintenanceResponse(
          maintenanceReadService.listItemsForBike(bikeId),
          maintenanceReadService.listRecordsForBike(bikeId));
  }

  @GetMapping("/me/notifications")
  List<NotificationReadResponse> myNotifications(@AuthenticationPrincipal Jwt jwt) {
      UUID rid = riderId(jwt);
      UUID bikeId = riderVehicleReadService.activeBikeIdOrNull(rid);
      return notificationReadService.listForRiderOrBike(rid, bikeId);
  }

  private static UUID riderId(Jwt jwt) { return UUID.fromString(jwt.getClaimAsString("riderId")); }
  ```
  `riderVehicleReadService.isCallBike(UUID bikeId)` 헬퍼 추가(`bikeRepository.findByIdAndDeletedAtIsNull(bikeId).map(b -> b.getServiceType()==BikeServiceType.CALL).orElse(false)`).

- [ ] **Step 3: 테스트 GREEN** `./gradlew test --tests "*RiderDriverApiContractTests*"` (Docker 필요; 없으면 compile + DONE_WITH_CONCERNS).

- [ ] **Step 4: Commit** `feat: rider driver read endpoints (completed/offered/tips/stations/maintenance/notifications)`

---

## Task 3: 라이더 write 엔드포인트(콜 수락·배송 완료) + 테스트

**Files:**
- Create: `rider/service/RiderSelfDispatchService.java`
- Modify: `rider/controller/RiderSelfCommandController.java`
- Test: `RiderDriverApiContractTests.java` (write 케이스 추가)

- [ ] **Step 1: 소유권 서비스**
  `RiderSelfDispatchService`(@Service @Transactional):
  ```java
  public DispatchOrderReadResponse acceptOfferedCall(UUID riderId, UUID orderId) {
      UUID bikeId = riderVehicleReadService.activeBikeIdOrNull(riderId);
      if (bikeId == null) throw new InvalidStateTransitionException("활성 차량이 없습니다.");
      return deliveryCallService.acceptCall(orderId, bikeId); // CALL 차종 + OFFERED 검증은 서비스가 함
  }

  public DispatchOrderReadResponse completeMyDispatch(UUID riderId, UUID orderId, byte[] photo, String contentType) {
      UUID bikeId = riderVehicleReadService.activeBikeIdOrNull(riderId);
      if (bikeId == null) throw new InvalidStateTransitionException("활성 차량이 없습니다.");
      DispatchOrder order = dispatchOrderReadService.findOrderForPhoto(orderId); // 엔티티
      if (!bikeId.equals(order.getBikeId())) {
          throw new ForbiddenOperationException("본인 배차가 아닙니다."); // 403 매핑되는 기존 예외 사용(없으면 적절한 것)
      }
      return dispatchOrderCommandService.complete(orderId, photo, contentType, riderId);
  }
  ```
  (403용 예외는 코드베이스에 있는 표준 예외 사용 — 없으면 `AccessDeniedException` 또는 도메인 예외. 구현자가 기존 ExceptionHandler 매핑 확인 후 선택.)

- [ ] **Step 2: 컨트롤러 POST 추가** (`RiderSelfCommandController`, ArchUnit 자동 통과):
  ```java
  @PostMapping("/me/offered-calls/{id}/accept")
  DispatchOrderReadResponse acceptCall(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
      return riderSelfDispatchService.acceptOfferedCall(riderId(jwt), id);
  }

  @PostMapping(value = "/me/dispatch-orders/{id}/complete", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
  DispatchOrderReadResponse complete(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id,
          @RequestPart("photo") MultipartFile photo) throws IOException {
      return riderSelfDispatchService.completeMyDispatch(riderId(jwt), id, photo.getBytes(), photo.getContentType());
  }
  ```

- [ ] **Step 3: 테스트(write)** — accept: OFFERED 콜 시드 → 라이더 accept → status ASSIGNED + bikeId=내차량. 소유권 위반 complete(다른 bike 주문) → 403. 정상 complete(multipart 사진) → COMPLETED.

- [ ] **Step 4: 컴파일/테스트 + Commit** `feat: rider accept call + complete dispatch (ownership-checked)`

---

## Task 4: 최종 검증 + PR
- [ ] `cd development/service-ops-api && ./gradlew compileJava compileTestJava` → SUCCESS. 가능하면 `./gradlew test --tests "*RiderDriver*"`(Docker). arch 테스트 pre-red는 무시([[project_archboundary_test_pre_red]]).
- [ ] PR → dev. 본문에 엔드포인트 목록 + "앱/웹은 이 계약 위에 빌드".

## Self-Review
- 스펙 Phase 1 엔드포인트 전부 매핑(read 6 + write 2 + 기존 재사용). ✅
- SecurityConfig/ArchUnit/마이그레이션 변경 없음(맵으로 확인). ✅
- 소유권 검증(complete) + CALL 검증(accept) 포함. ✅
- YAGNI: 정비 알람 상태 파생은 앱에서(백엔드 summary 미신설), FCM/위치 ingest 제외.
