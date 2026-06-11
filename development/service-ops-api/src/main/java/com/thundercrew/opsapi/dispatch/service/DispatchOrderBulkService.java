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
                    row.longitude());
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
                        o.getAddress()))
                .toList();
        return ExcelExporter.export(DispatchOrderBulkService.class, "dispatch-template.xlsx",
                DATA_START_ROW, rows);
    }

    private DispatchBulkPreviewRow evaluateRow(List<String> cols, int rowNum) {
        String plate = cell(cols, 0);
        String customerName = cell(cols, 1);
        String customerPhone = cell(cols, 2);
        String address = cell(cols, 3);

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
                customerName, customerPhone, address);
    }

    private static String cell(List<String> cols, int idx) {
        return idx < cols.size() ? cols.get(idx) : "";
    }
}
