package com.thundercrew.opsapi.dispatch.service;

import com.thundercrew.opsapi.bike.domain.Bike;
import com.thundercrew.opsapi.bike.domain.BikePurpose;
import com.thundercrew.opsapi.bike.repository.BikeRepository;
import com.thundercrew.opsapi.contract.domain.RiderBikeContract;
import com.thundercrew.opsapi.contract.repository.RiderBikeContractRepository;
import com.thundercrew.opsapi.common.bulk.BulkApplyResponse;
import com.thundercrew.opsapi.common.excel.ExcelExporter;
import com.thundercrew.opsapi.common.excel.ExcelParser;
import com.thundercrew.opsapi.dispatch.domain.DispatchOrder;
import com.thundercrew.opsapi.dispatch.domain.DispatchOrderStatus;
import com.thundercrew.opsapi.dispatch.dto.DispatchBulkApplyRequest;
import com.thundercrew.opsapi.dispatch.dto.DispatchBulkApplyRow;
import com.thundercrew.opsapi.dispatch.dto.DispatchBulkPreviewResponse;
import com.thundercrew.opsapi.dispatch.dto.DispatchBulkPreviewRow;
import com.thundercrew.opsapi.dispatch.repository.DispatchOrderRepository;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Excel bulk operations for dispatch orders.
 *
 * <p>This flow is a hybrid because geocoding is frontend-only in this codebase (no NCP secret on the
 * backend, matching BSS/station): {@link #preview} parses + validates the Excel and returns rows
 * carrying the parsed payload + resolved bikeId but NO coordinates; the frontend geocodes each NEW
 * row and posts them to {@link #apply}, which is a JSON endpoint, not an Excel upload.
 */
@Service
public class DispatchOrderBulkService {

    /** 0-based row index where data begins (matches BikeBulkService / dispatch-template.xlsx). */
    private static final int DATA_START_ROW = 2;

    private final DispatchOrderCommandService commandService;
    private final DispatchOrderRepository dispatchOrderRepository;
    private final BikeRepository bikeRepository;
    private final RiderBikeContractRepository contractRepository;
    private final int defaultServiceMinutes;

    public DispatchOrderBulkService(DispatchOrderCommandService commandService,
                                    DispatchOrderRepository dispatchOrderRepository,
                                    BikeRepository bikeRepository,
                                    RiderBikeContractRepository contractRepository,
                                    @org.springframework.beans.factory.annotation.Value(
                                            "${thundercrew.dispatch.default-service-minutes:60}") int defaultServiceMinutes) {
        this.commandService = commandService;
        this.dispatchOrderRepository = dispatchOrderRepository;
        this.bikeRepository = bikeRepository;
        this.contractRepository = contractRepository;
        this.defaultServiceMinutes = defaultServiceMinutes;
    }

    /**
     * 배차 가능 여부 — 용도 일치 + 활성 매칭 보유. 배차 방식 축(단일/순차)은 용도
     * 단일화(V59)로 사라졌다: 배송 엑셀은 배송용 차량에, 클리닝 엑셀은 클린차량에만.
     * 불가하면 사유 문자열, 가능하면 null.
     */
    private String eligibilityError(Bike bike, BikePurpose required) {
        if (bike.getPurpose() != required) {
            return (required == BikePurpose.DELIVERY ? "배송용" : "클린") + " 차량이 아닙니다 (용도: " + bike.getPurpose() + ")";
        }
        if (contractRepository.findActiveByBikeId(bike.getId()).isEmpty()) {
            return "활성 매칭이 없는 차량입니다";
        }
        return null;
    }

    /**
     * Parse + validate the uploaded Excel. Columns: [0]=차량번호, [1]=고객명, [2]=연락처, [3]=배송지주소.
     * Valid rows become NEW (carrying the resolved bikeId); invalid rows become ERROR. No geocoding.
     */
    public DispatchBulkPreviewResponse preview(InputStream excelStream) throws IOException {
        List<List<String>> rows = ExcelParser.parseRows(excelStream, DATA_START_ROW);
        List<DispatchBulkPreviewRow> results = new ArrayList<>();
        int rowNum = DATA_START_ROW + 1; // 0-based dataStartRow -> 1-based Excel row number
        for (List<String> cols : rows) {
            results.add(evaluateRow(cols, rowNum++));
        }
        return DispatchBulkPreviewResponse.of(results);
    }

    /** Persist the frontend-geocoded rows. Each row is appended for its bike. */
    @Transactional
    public BulkApplyResponse apply(DispatchBulkApplyRequest request) {
        List<UUID> bikeIds = request.rows().stream().map(DispatchBulkApplyRow::bikeId).distinct().toList();
        Map<UUID, Bike> bikeById = new HashMap<>();
        bikeRepository.findAllByIdIn(bikeIds).forEach(b -> bikeById.put(b.getId(), b));

        long applied = 0;
        long skipped = 0;
        for (DispatchBulkApplyRow row : request.rows()) {
            Bike bike = bikeById.get(row.bikeId());
            if (bike == null || eligibilityError(bike, BikePurpose.DELIVERY) != null) {
                skipped++;
                continue;
            }
            commandService.appendForBike(
                    row.bikeId(),
                    row.customerName(),
                    row.customerPhone(),
                    row.address(),
                    row.latitude(),
                    row.longitude(),
                    row.originAddress(),
                    row.originLatitude(),
                    row.originLongitude());
            applied++;
        }
        return new BulkApplyResponse(applied, skipped);
    }

    /** Export currently ASSIGNED orders as rows [차량번호, 고객명, 연락처, 배송지주소]. */
    public byte[] export() throws IOException {
        List<DispatchOrder> orders =
                dispatchOrderRepository.findByStatusAndDeletedAtIsNull(DispatchOrderStatus.ASSIGNED);
        List<UUID> bikeIds = orders.stream().map(DispatchOrder::getBikeId).distinct().toList();
        Map<UUID, String> plateByBikeId = bikeRepository.findAllByIdIn(bikeIds).stream()
                .collect(Collectors.toMap(Bike::getId, Bike::getPlateNumber, (a, b) -> a));

        List<List<String>> rows = orders.stream()
                .map(o -> List.of(
                        plateByBikeId.getOrDefault(o.getBikeId(), ""),
                        o.getCustomerName(),
                        o.getCustomerPhone(),
                        o.getAddress(),
                        o.getOriginAddress() != null ? o.getOriginAddress() : ""))
                .toList();
        return ExcelExporter.export(DispatchOrderBulkService.class, "dispatch-template.xlsx",
                DATA_START_ROW, rows);
    }

    /** 순차 배차 미리보기. 컬럼: [0]차량번호 [1]고객명 [2]연락처 [3]배송지주소 [4]순번. */
    public DispatchBulkPreviewResponse previewSequential(InputStream excelStream) throws IOException {
        List<List<String>> rows = ExcelParser.parseRows(excelStream, DATA_START_ROW);
        List<DispatchBulkPreviewRow> results = new ArrayList<>();
        int rowNum = DATA_START_ROW + 1;
        for (List<String> cols : rows) {
            results.add(evaluateSequentialRow(cols, rowNum++));
        }
        return DispatchBulkPreviewResponse.of(results);
    }

    /**
     * 클리닝(시간 배차) 업로드 적용. 순번 축은 없다 — 예정 시각이 결 배차
     * 순서다. 단건 create 와 같은 불변식을 지킨다: 예정 시각 없는 행과 같은
     * 차량 시간 겹침 행은 skip (scheduled_at null 인 반쪽 클리닝 행은 일정표·
     * 겹침 검사·알림 전부에서 투명해진다).
     */
    @Transactional
    public BulkApplyResponse applySequential(DispatchBulkApplyRequest request) {
        List<UUID> bikeIds = request.rows().stream().map(DispatchBulkApplyRow::bikeId).distinct().toList();
        Map<UUID, Bike> bikeById = new HashMap<>();
        bikeRepository.findAllByIdIn(bikeIds).forEach(b -> bikeById.put(b.getId(), b));

        long applied = 0;
        long skipped = 0;
        List<DispatchBulkApplyRow> ordered = request.rows().stream()
                .sorted(Comparator
                        .comparing(DispatchBulkApplyRow::bikeId)
                        .thenComparing(r -> r.scheduledAt() == null ? java.time.Instant.MAX : r.scheduledAt()))
                .toList();
        for (DispatchBulkApplyRow row : ordered) {
            Bike bike = bikeById.get(row.bikeId());
            if (bike == null || eligibilityError(bike, BikePurpose.CLEANING) != null) {
                skipped++;
                continue;
            }
            if (row.scheduledAt() == null) {
                skipped++;
                continue;
            }
            int minutes = row.serviceMinutes() != null ? row.serviceMinutes() : defaultServiceMinutes;
            java.time.Instant endAt = row.scheduledAt().plus(java.time.Duration.ofMinutes(minutes));
            if (dispatchOrderRepository.existsCleaningOverlap(
                    row.bikeId(), row.scheduledAt(), endAt, defaultServiceMinutes)) {
                skipped++;
                continue;
            }
            commandService.appendForBike(row.bikeId(), row.customerName(), row.customerPhone(),
                    row.address(), row.latitude(), row.longitude(),
                    row.originAddress(), row.originLatitude(), row.originLongitude(),
                    row.scheduledAt(), row.serviceMinutes());
            applied++;
        }
        return new BulkApplyResponse(applied, skipped);
    }

    /**
     * 클리닝(시간 배차) 업로드 행 검증. 열: 차량번호/고객명/연락처/주소/
     * 예정 시각(yyyy-MM-dd HH:mm, KST)/소요분(선택)/출발지(선택).
     * 순번 열은 시간 배차 전환(V56)으로 없어졌다 — 예정 시각순이 결 순서.
     */
    private DispatchBulkPreviewRow evaluateSequentialRow(List<String> cols, int rowNum) {
        String plate = cell(cols, 0);
        String customerName = cell(cols, 1);
        String customerPhone = cell(cols, 2);
        String address = cell(cols, 3);
        String scheduledRaw = cell(cols, 4);
        String minutesRaw = cell(cols, 5);
        String originAddress = cell(cols, 6).isBlank() ? null : cell(cols, 6);

        if (plate.isBlank()) {
            return DispatchBulkPreviewRow.errorSeq(rowNum, plate, null, customerName, customerPhone, address, null, "차량번호 없음");
        }
        Optional<Bike> bike = bikeRepository.findByPlateNumberAndDeletedAtIsNull(plate);
        if (bike.isEmpty()) {
            return DispatchBulkPreviewRow.errorSeq(rowNum, plate, null, customerName, customerPhone, address, null, "차량 없음: " + plate);
        }
        String seqError = eligibilityError(bike.get(), BikePurpose.CLEANING);
        if (seqError != null) {
            return DispatchBulkPreviewRow.errorSeq(rowNum, plate, bike.get().getId(),
                    customerName, customerPhone, address, null, seqError);
        }
        UUID bikeId = bike.get().getId();
        if (customerName.isBlank()) {
            return DispatchBulkPreviewRow.errorSeq(rowNum, plate, bikeId, customerName, customerPhone, address, null, "고객명 없음");
        }
        if (customerPhone.isBlank()) {
            return DispatchBulkPreviewRow.errorSeq(rowNum, plate, bikeId, customerName, customerPhone, address, null, "연락처 없음");
        }
        if (address.isBlank()) {
            return DispatchBulkPreviewRow.errorSeq(rowNum, plate, bikeId, customerName, customerPhone, address, null, "주소 없음");
        }
        java.time.Instant scheduledAt = parseScheduledAt(scheduledRaw);
        if (scheduledAt == null) {
            return DispatchBulkPreviewRow.errorSeq(rowNum, plate, bikeId, customerName, customerPhone, address, null,
                    "예정 시각 없음 또는 형식 오류 (yyyy-MM-dd HH:mm): " + scheduledRaw);
        }
        Integer serviceMinutes = null;
        if (!minutesRaw.isBlank()) {
            try {
                serviceMinutes = Integer.parseInt(minutesRaw.trim());
            } catch (NumberFormatException e) {
                return DispatchBulkPreviewRow.errorSeq(rowNum, plate, bikeId, customerName, customerPhone, address, null,
                        "소요분 형식 오류: " + minutesRaw);
            }
            if (serviceMinutes < 5 || serviceMinutes > 1440) {
                return DispatchBulkPreviewRow.errorSeq(rowNum, plate, bikeId, customerName, customerPhone, address, null,
                        "소요분은 5~1440 이어야 합니다: " + minutesRaw);
            }
        }
        return DispatchBulkPreviewRow.newRowScheduled(rowNum, plate, bikeId,
                customerName, customerPhone, address, scheduledAt.toString(), serviceMinutes, originAddress);
    }

    /** "yyyy-MM-dd HH:mm" (또는 T 구분) KST 벽시계 → Instant. 미인식이면 null. */
    private static java.time.Instant parseScheduledAt(String raw) {
        if (raw == null || raw.isBlank()) return null;
        String normalized = raw.trim().replace('T', ' ');
        try {
            java.time.LocalDateTime local = java.time.LocalDateTime.parse(
                    normalized,
                    java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm"));
            return local.atZone(java.time.ZoneOffset.ofHours(9)).toInstant();
        } catch (java.time.format.DateTimeParseException e) {
            return null;
        }
    }
    private DispatchBulkPreviewRow evaluateRow(List<String> cols, int rowNum) {
        String plate = cell(cols, 0);
        String customerName = cell(cols, 1);
        String customerPhone = cell(cols, 2);
        String address = cell(cols, 3);
        String originAddress = cell(cols, 4).isBlank() ? null : cell(cols, 4);

        if (plate.isBlank()) {
            return DispatchBulkPreviewRow.error(rowNum, plate, null,
                    customerName, customerPhone, address, "차량번호 없음");
        }
        Optional<Bike> bike = bikeRepository.findByPlateNumberAndDeletedAtIsNull(plate);
        if (bike.isEmpty()) {
            return DispatchBulkPreviewRow.error(rowNum, plate, null,
                    customerName, customerPhone, address, "차량 없음: " + plate);
        }
        String singleError = eligibilityError(bike.get(), BikePurpose.DELIVERY);
        if (singleError != null) {
            return DispatchBulkPreviewRow.error(rowNum, plate, bike.get().getId(),
                    customerName, customerPhone, address, singleError);
        }
        if (customerName.isBlank()) {
            return DispatchBulkPreviewRow.error(rowNum, plate, bike.get().getId(),
                    customerName, customerPhone, address, "고객명 없음");
        }
        if (customerPhone.isBlank()) {
            return DispatchBulkPreviewRow.error(rowNum, plate, bike.get().getId(),
                    customerName, customerPhone, address, "연락처 없음");
        }
        if (address.isBlank()) {
            return DispatchBulkPreviewRow.error(rowNum, plate, bike.get().getId(),
                    customerName, customerPhone, address, "배송지주소 없음");
        }
        return DispatchBulkPreviewRow.newRow(rowNum, plate, bike.get().getId(),
                customerName, customerPhone, address, originAddress);
    }

    private static String cell(List<String> cols, int idx) {
        return idx < cols.size() ? cols.get(idx) : "";
    }
}
