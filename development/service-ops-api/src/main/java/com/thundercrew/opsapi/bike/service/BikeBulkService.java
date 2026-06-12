package com.thundercrew.opsapi.bike.service;

import com.thundercrew.opsapi.bike.domain.Bike;
import com.thundercrew.opsapi.bike.domain.BikeEngineType;
import com.thundercrew.opsapi.bike.domain.BikeOperationStatus;
import com.thundercrew.opsapi.bike.domain.BikeServiceType;
import com.thundercrew.opsapi.bike.domain.BikeWheelType;
import com.thundercrew.opsapi.bike.repository.BikeRepository;
import com.thundercrew.opsapi.common.bulk.BulkApplyResponse;
import com.thundercrew.opsapi.common.bulk.BulkPreviewResponse;
import com.thundercrew.opsapi.common.bulk.BulkRowResult;
import com.thundercrew.opsapi.common.excel.ExcelExporter;
import com.thundercrew.opsapi.common.excel.ExcelParser;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class BikeBulkService {

    private static final int DATA_START_ROW = 2;

    private final BikeRepository bikeRepository;

    public BikeBulkService(BikeRepository bikeRepository) {
        this.bikeRepository = bikeRepository;
    }

    public BulkPreviewResponse preview(InputStream excelStream) throws IOException {
        List<List<String>> rows = ExcelParser.parseRows(excelStream, DATA_START_ROW);
        List<BulkRowResult> results = new ArrayList<>();
        int rowNum = DATA_START_ROW + 1; // convert 0-indexed dataStartRow to 1-indexed Excel row number
        for (List<String> cols : rows) {
            results.add(evaluateRow(cols, rowNum++));
        }
        return BulkPreviewResponse.of(results);
    }

    @Transactional
    public BulkApplyResponse apply(InputStream excelStream) throws IOException {
        List<List<String>> rows = ExcelParser.parseRows(excelStream, DATA_START_ROW);
        long applied = 0;
        long skipped = 0;
        for (List<String> cols : rows) {
            try {
                String plateNumber = cell(cols, 0);
                if (plateNumber.isBlank()) {
                    skipped++;
                    continue;
                }
                BikeWheelType wheelType = parseWheelType(cell(cols, 1));
                BikeEngineType engineType = parseEngineType(cell(cols, 2));
                String imei = cell(cols, 3).isBlank() ? null : cell(cols, 3);

                Optional<Bike> existing = bikeRepository.findByPlateNumberAndDeletedAtIsNull(plateNumber);
                if (existing.isPresent()) {
                    Bike bike = existing.get();
                    bike.setWheelType(wheelType);
                    bike.setImei(imei);
                    bike.updateBasicProfile(null, null, null, engineType, null, null);
                    bikeRepository.save(bike);
                } else {
                    Bike bike = Bike.create(plateNumber, null, null, engineType,
                            BikeServiceType.SINGLE, BikeOperationStatus.READY, null);
                    bike.setWheelType(wheelType);
                    bike.setImei(imei);
                    bikeRepository.save(bike);
                }
                applied++;
            } catch (Exception e) {
                skipped++;
            }
        }
        return new BulkApplyResponse(applied, skipped);
    }

    public byte[] export() throws IOException {
        List<Bike> bikes = bikeRepository.findAllByDeletedAtIsNull();
        List<List<String>> rows = bikes.stream()
                .map(b -> List.of(
                        b.getPlateNumber(),
                        b.getWheelType() == BikeWheelType.TWO_WHEEL ? "2륜" : "4륜",
                        b.getEngineType() == BikeEngineType.ELECTRIC ? "전기" : "내연",
                        b.getImei() != null ? b.getImei() : ""))
                .toList();
        return ExcelExporter.export(BikeBulkService.class, "vehicles-template.xlsx",
                DATA_START_ROW, rows);
    }

    private BulkRowResult evaluateRow(List<String> cols, int rowNum) {
        String plateNumber = cell(cols, 0);
        if (plateNumber.isBlank()) {
            return BulkRowResult.error(rowNum, "(빈 행)", "차량번호 없음");
        }
        try {
            BikeWheelType newWheel = parseWheelType(cell(cols, 1));
            BikeEngineType newEngine = parseEngineType(cell(cols, 2));
            String newImei = cell(cols, 3).isBlank() ? null : cell(cols, 3);

            Optional<Bike> existing = bikeRepository.findByPlateNumberAndDeletedAtIsNull(plateNumber);
            if (existing.isEmpty()) {
                return BulkRowResult.newRow(rowNum, plateNumber);
            }
            Bike bike = existing.get();
            List<String> changes = new ArrayList<>();
            if (bike.getWheelType() != newWheel) changes.add("wheelType");
            if (bike.getEngineType() != newEngine) changes.add("engineType");
            if (!Objects.equals(bike.getImei(), newImei)) changes.add("imei");
            return changes.isEmpty()
                    ? BulkRowResult.unchanged(rowNum, plateNumber)
                    : BulkRowResult.update(rowNum, plateNumber, List.copyOf(changes));
        } catch (IllegalArgumentException e) {
            return BulkRowResult.error(rowNum, plateNumber, e.getMessage());
        }
    }

    private BikeWheelType parseWheelType(String val) {
        return switch (val) {
            case "2륜" -> BikeWheelType.TWO_WHEEL;
            case "4륜" -> BikeWheelType.FOUR_WHEEL;
            default -> throw new IllegalArgumentException("알 수 없는 차종: " + val);
        };
    }

    private BikeEngineType parseEngineType(String val) {
        return switch (val) {
            case "전기" -> BikeEngineType.ELECTRIC;
            case "내연" -> BikeEngineType.ICE;
            default -> throw new IllegalArgumentException("알 수 없는 동력: " + val);
        };
    }

    private static String cell(List<String> cols, int idx) {
        return idx < cols.size() ? cols.get(idx) : "";
    }
}
