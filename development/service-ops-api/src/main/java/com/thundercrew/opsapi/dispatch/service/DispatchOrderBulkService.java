package com.thundercrew.opsapi.dispatch.service;

import com.thundercrew.opsapi.bike.domain.Bike;
import com.thundercrew.opsapi.bike.repository.BikeRepository;
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

    public DispatchOrderBulkService(DispatchOrderCommandService commandService,
                                    DispatchOrderRepository dispatchOrderRepository,
                                    BikeRepository bikeRepository) {
        this.commandService = commandService;
        this.dispatchOrderRepository = dispatchOrderRepository;
        this.bikeRepository = bikeRepository;
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
        long applied = 0;
        for (DispatchBulkApplyRow row : request.rows()) {
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
        return new BulkApplyResponse(applied, 0);
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

    /** 차량별 순번 오름차순 정렬 후 큐에 append (순번=정렬 키, 저장 sequence 는 append 연속값). */
    @Transactional
    public BulkApplyResponse applySequential(DispatchBulkApplyRequest request) {
        long applied = 0;
        List<DispatchBulkApplyRow> ordered = request.rows().stream()
                .sorted(Comparator
                        .comparing(DispatchBulkApplyRow::bikeId)
                        .thenComparing(r -> r.sequence() == null ? Long.MAX_VALUE : r.sequence()))
                .toList();
        for (DispatchBulkApplyRow row : ordered) {
            commandService.appendForBike(row.bikeId(), row.customerName(), row.customerPhone(),
                    row.address(), row.latitude(), row.longitude(),
                    row.originAddress(), row.originLatitude(), row.originLongitude());
            applied++;
        }
        return new BulkApplyResponse(applied, 0);
    }

    private DispatchBulkPreviewRow evaluateSequentialRow(List<String> cols, int rowNum) {
        String plate = cell(cols, 0);
        String customerName = cell(cols, 1);
        String customerPhone = cell(cols, 2);
        String address = cell(cols, 3);
        String seqRaw = cell(cols, 4);
        String originAddress = cell(cols, 5).isBlank() ? null : cell(cols, 5);

        if (plate.isBlank()) {
            return DispatchBulkPreviewRow.errorSeq(rowNum, plate, null, customerName, customerPhone, address, null, "차량번호 없음");
        }
        Optional<Bike> bike = bikeRepository.findByPlateNumberAndDeletedAtIsNull(plate);
        if (bike.isEmpty()) {
            return DispatchBulkPreviewRow.errorSeq(rowNum, plate, null, customerName, customerPhone, address, null, "차량 없음: " + plate);
        }
        UUID bikeId = bike.get().getId();
        if (customerName.isBlank()) {
            return DispatchBulkPreviewRow.errorSeq(rowNum, plate, bikeId, customerName, customerPhone, address, null, "고객명 없음");
        }
        if (customerPhone.isBlank()) {
            return DispatchBulkPreviewRow.errorSeq(rowNum, plate, bikeId, customerName, customerPhone, address, null, "연락처 없음");
        }
        if (address.isBlank()) {
            return DispatchBulkPreviewRow.errorSeq(rowNum, plate, bikeId, customerName, customerPhone, address, null, "배송지주소 없음");
        }
        Integer sequence;
        try {
            sequence = Integer.parseInt(seqRaw.trim());
        } catch (NumberFormatException ex) {
            return DispatchBulkPreviewRow.errorSeq(rowNum, plate, bikeId, customerName, customerPhone, address, null,
                    seqRaw.isBlank() ? "순번 없음" : "순번 형식 오류: " + seqRaw);
        }
        return DispatchBulkPreviewRow.newRowSeq(rowNum, plate, bikeId, customerName, customerPhone, address, sequence, originAddress);
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
