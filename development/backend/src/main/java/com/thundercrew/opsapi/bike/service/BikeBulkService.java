package com.thundercrew.opsapi.bike.service;

import com.thundercrew.opsapi.bike.domain.Bike;
import com.thundercrew.opsapi.bike.domain.BikeEngineType;
import com.thundercrew.opsapi.bike.domain.BikeOperationStatus;
import com.thundercrew.opsapi.bike.domain.BikePurpose;
import com.thundercrew.opsapi.bike.domain.BikeWheelType;
import com.thundercrew.opsapi.bike.repository.BikeRepository;
import com.thundercrew.opsapi.common.bulk.BulkApplyResponse;
import com.thundercrew.opsapi.common.bulk.BulkPreviewResponse;
import com.thundercrew.opsapi.common.bulk.BulkRowResult;
import com.thundercrew.opsapi.common.excel.ExcelExporter;
import com.thundercrew.opsapi.common.excel.ExcelParser;
import com.thundercrew.opsapi.contract.repository.RiderBikeContractRepository;
import com.thundercrew.opsapi.equipment.domain.BikeEquipment;
import com.thundercrew.opsapi.equipment.domain.EquipmentType;
import com.thundercrew.opsapi.equipment.repository.BikeEquipmentRepository;
import com.thundercrew.opsapi.equipment.repository.EquipmentTypeRepository;
import java.time.Clock;
import java.time.LocalDate;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.data.domain.Pageable;
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

    private static final String BOX_TYPE_NAME = "함체";

    private final BikeRepository bikeRepository;
    private final RiderBikeContractRepository contractRepository;
    private final EquipmentTypeRepository equipmentTypeRepository;
    private final BikeEquipmentRepository bikeEquipmentRepository;
    private final Clock clock;

    public BikeBulkService(
            BikeRepository bikeRepository,
            RiderBikeContractRepository contractRepository,
            EquipmentTypeRepository equipmentTypeRepository,
            BikeEquipmentRepository bikeEquipmentRepository,
            Clock clock
    ) {
        this.bikeRepository = bikeRepository;
        this.contractRepository = contractRepository;
        this.equipmentTypeRepository = equipmentTypeRepository;
        this.bikeEquipmentRepository = bikeEquipmentRepository;
        this.clock = clock;
    }

    /** 함체 장비 유형 (V63 시드). 없으면 함체 열은 무시된다. */
    private Optional<EquipmentType> boxType() {
        return equipmentTypeRepository.findByDeletedAtIsNull(Pageable.unpaged()).stream()
                .filter(t -> BOX_TYPE_NAME.equals(t.getName()) && t.isEnabled())
                .findFirst();
    }

    /** 함체가 부착된 bikeId 집합 — export/미리보기 diff 용. */
    private Set<UUID> boxAttachedBikeIds(UUID boxTypeId) {
        return bikeEquipmentRepository.findByDeletedAtIsNull(Pageable.unpaged()).stream()
                .filter(e -> boxTypeId.equals(e.getEquipmentTypeId()) && e.getRemovedAt() == null)
                .map(BikeEquipment::getBikeId)
                .collect(Collectors.toSet());
    }

    /** 함체 열 적용 — O=부착 보장, X=해제 보장, 그 외(빈/-)=변경 없음. */
    private void applyBox(Bike bike, String cellValue, Optional<EquipmentType> boxType) {
        if (boxType.isEmpty()) return;
        boolean attach;
        if ("O".equalsIgnoreCase(cellValue)) attach = true;
        else if ("X".equalsIgnoreCase(cellValue)) attach = false;
        else return;
        UUID typeId = boxType.get().getId();
        Optional<BikeEquipment> current = bikeEquipmentRepository
                .findByBikeIdAndDeletedAtIsNull(bike.getId(), Pageable.unpaged()).stream()
                .filter(e -> typeId.equals(e.getEquipmentTypeId()) && e.getRemovedAt() == null)
                .findFirst();
        if (attach && current.isEmpty()) {
            bikeEquipmentRepository.save(BikeEquipment.create(
                    bike.getId(), typeId, BOX_TYPE_NAME, null, null,
                    clock.instant(), LocalDate.of(2099, 12, 31), null, "엑셀 업로드 함체 부착"));
        } else if (!attach && current.isPresent()) {
            current.get().remove(clock.instant(), "엑셀 업로드 함체 해제");
            bikeEquipmentRepository.save(current.get());
        }
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
                // 열 순서는 자원 관리 차량 표와 동일: 용도/구분/엔진/함체/IMEI/단말기.
                BikePurpose purpose = parsePurpose(cell(cols, 1));
                BikeWheelType wheelType = parseWheelType(cell(cols, 2));
                BikeEngineType engineType = parseEngineType(cell(cols, 3));
                String boxCell = cell(cols, 4);
                String imei = cell(cols, 5).isBlank() ? null : cell(cols, 5);
                String terminalId = cell(cols, 6).isBlank() ? null : cell(cols, 6);

                Optional<Bike> existing = bikeRepository.findByPlateNumberAndDeletedAtIsNull(plateNumber);
                if (existing.isPresent()) {
                    Bike bike = existing.get();
                    // 단건 수정과 같은 가드 — 활성 매칭 중 용도 변경은 계약
                    // invariant(용도↔직무↔형태)를 깨므로 벌크에서도 거른다.
                    if (bike.getPurpose() != purpose
                            && contractRepository.findActiveByBikeId(bike.getId()).isPresent()) {
                        skipped++;
                        continue;
                    }
                    bike.setPurpose(purpose);
                    bike.setWheelType(wheelType);
                    bike.setImei(imei);
                    bike.setTerminalId(terminalId);
                    bike.updateBasicProfile(null, null, null, engineType, null);
                    bikeRepository.save(bike);
                } else {
                    Bike bike = Bike.create(plateNumber, null, null, engineType,
                            BikeOperationStatus.READY, null);
                    bike.setPurpose(purpose);
                    bike.setWheelType(wheelType);
                    bike.setImei(imei);
                    bike.setTerminalId(terminalId);
                    bikeRepository.save(bike);
                }
                bikeRepository.findByPlateNumberAndDeletedAtIsNull(plateNumber)
                        .ifPresent(saved -> applyBox(saved, boxCell, boxType()));
                applied++;
            } catch (Exception e) {
                skipped++;
            }
        }
        return new BulkApplyResponse(applied, skipped);
    }

    public byte[] export() throws IOException {
        List<Bike> bikes = bikeRepository.findAllByDeletedAtIsNull();
        Set<UUID> attached = boxType().map(t -> boxAttachedBikeIds(t.getId())).orElse(Set.of());
        List<List<String>> rows = bikes.stream()
                .map(b -> List.of(
                        b.getPlateNumber(),
                        b.getPurpose() == BikePurpose.CLEANING ? "클린차량" : "배송용",
                        b.getWheelType() == BikeWheelType.TWO_WHEEL ? "2륜" : "4륜",
                        engineLabel(b.getEngineType()),
                        // UI 컬럼과 동일 — 배송용만 O/X, 클린차량은 "-".
                        b.getPurpose() == BikePurpose.CLEANING ? "-" : (attached.contains(b.getId()) ? "O" : "X"),
                        b.getImei() != null ? b.getImei() : "",
                        b.getTerminalId() != null ? b.getTerminalId() : ""))
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
            BikePurpose newPurpose = parsePurpose(cell(cols, 1));
            BikeWheelType newWheel = parseWheelType(cell(cols, 2));
            BikeEngineType newEngine = parseEngineType(cell(cols, 3));
            String newBox = cell(cols, 4);
            String newImei = cell(cols, 5).isBlank() ? null : cell(cols, 5);
            String newTerminalId = cell(cols, 6).isBlank() ? null : cell(cols, 6);

            Optional<Bike> existing = bikeRepository.findByPlateNumberAndDeletedAtIsNull(plateNumber);
            if (existing.isEmpty()) {
                return BulkRowResult.newRow(rowNum, plateNumber);
            }
            Bike bike = existing.get();
            if (bike.getPurpose() != newPurpose
                    && contractRepository.findActiveByBikeId(bike.getId()).isPresent()) {
                return BulkRowResult.error(rowNum, plateNumber, "활성 매칭이 있는 차량의 용도는 변경할 수 없습니다");
            }
            List<String> changes = new ArrayList<>();
            if (bike.getPurpose() != newPurpose) changes.add("purpose");
            if (bike.getWheelType() != newWheel) changes.add("wheelType");
            if (bike.getEngineType() != newEngine) changes.add("engineType");
            if (!Objects.equals(bike.getImei(), newImei)) changes.add("imei");
            if (!Objects.equals(bike.getTerminalId(), newTerminalId)) changes.add("terminalId");
            if ("O".equalsIgnoreCase(newBox) || "X".equalsIgnoreCase(newBox)) {
                boolean attachedNow = boxType()
                        .map(t -> boxAttachedBikeIds(t.getId()).contains(bike.getId()))
                        .orElse(false);
                if (attachedNow != "O".equalsIgnoreCase(newBox)) changes.add("box");
            }
            return changes.isEmpty()
                    ? BulkRowResult.unchanged(rowNum, plateNumber)
                    : BulkRowResult.update(rowNum, plateNumber, List.copyOf(changes));
        } catch (IllegalArgumentException e) {
            return BulkRowResult.error(rowNum, plateNumber, e.getMessage());
        }
    }

    private BikePurpose parsePurpose(String val) {
        return switch (val) {
            case "배송용" -> BikePurpose.DELIVERY;
            case "클린차량" -> BikePurpose.CLEANING;
            default -> throw new IllegalArgumentException("알 수 없는 용도: " + val);
        };
    }

    private static String engineLabel(BikeEngineType engineType) {
        return switch (engineType) {
            case ELECTRIC -> "전기";
            case ICE -> "내연";
            case LPG -> "LPG";
        };
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
            case "LPG" -> BikeEngineType.LPG;
            default -> throw new IllegalArgumentException("알 수 없는 동력: " + val);
        };
    }

    private static String cell(List<String> cols, int idx) {
        return idx < cols.size() ? cols.get(idx) : "";
    }
}
