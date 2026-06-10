package com.thundercrew.opsapi.contract.service;

import com.thundercrew.opsapi.bike.domain.Bike;
import com.thundercrew.opsapi.bike.repository.BikeRepository;
import com.thundercrew.opsapi.common.bulk.BulkApplyResponse;
import com.thundercrew.opsapi.common.bulk.BulkPreviewResponse;
import com.thundercrew.opsapi.common.bulk.BulkRowResult;
import com.thundercrew.opsapi.common.excel.ExcelExporter;
import com.thundercrew.opsapi.common.excel.ExcelParser;
import com.thundercrew.opsapi.contract.domain.ContractCategory;
import com.thundercrew.opsapi.contract.domain.ContractReturnType;
import com.thundercrew.opsapi.contract.domain.ContractTemplate;
import com.thundercrew.opsapi.contract.domain.RiderBikeContract;
import com.thundercrew.opsapi.contract.repository.ContractTemplateRepository;
import com.thundercrew.opsapi.contract.repository.RiderBikeContractRepository;
import com.thundercrew.opsapi.rider.domain.Rider;
import com.thundercrew.opsapi.rider.repository.RiderRepository;
import java.io.IOException;
import java.io.InputStream;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ContractBulkService {

    private static final int DATA_START_ROW = 3;

    private final BikeRepository bikeRepository;
    private final RiderRepository riderRepository;
    private final ContractTemplateRepository templateRepository;
    private final RiderBikeContractRepository contractRepository;

    public ContractBulkService(
            BikeRepository bikeRepository,
            RiderRepository riderRepository,
            ContractTemplateRepository templateRepository,
            RiderBikeContractRepository contractRepository) {
        this.bikeRepository = bikeRepository;
        this.riderRepository = riderRepository;
        this.templateRepository = templateRepository;
        this.contractRepository = contractRepository;
    }

    public BulkPreviewResponse preview(InputStream excelStream) throws IOException {
        List<List<String>> rows = ExcelParser.parseRows(excelStream, DATA_START_ROW);
        List<BulkRowResult> results = new ArrayList<>();
        int rowNum = DATA_START_ROW + 1; // 0-indexed → 1-indexed Excel row
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
                String plate = cell(cols, 0);
                String phone = cell(cols, 2);
                if (plate.isBlank() || phone.isBlank()) {
                    skipped++;
                    continue;
                }
                Optional<Bike> bike = bikeRepository.findByPlateNumberAndDeletedAtIsNull(plate);
                Optional<Rider> rider = riderRepository.findByPhoneNumberAndDeletedAtIsNull(phone);
                if (bike.isEmpty() || rider.isEmpty()) {
                    skipped++;
                    continue;
                }
                ContractCategory category = parseCategory(cell(cols, 3));
                ContractReturnType returnType = parseReturnType(cell(cols, 4));
                Optional<ContractTemplate> template = templateRepository
                        .findFirstByCategoryAndReturnTypeAndEnabledTrueAndDeletedAtIsNull(
                                category, returnType);
                if (template.isEmpty()) {
                    skipped++;
                    continue;
                }
                Instant startAt = parseDate(cell(cols, 5));
                Instant endAt = parseDate(cell(cols, 6));
                Optional<RiderBikeContract> existing = contractRepository
                        .findActiveByBikeIdAndRiderId(bike.get().getId(), rider.get().getId());
                if (existing.isPresent()) {
                    existing.get().updateDates(template.get().getId(), startAt, endAt);
                    contractRepository.save(existing.get());
                } else {
                    contractRepository.save(RiderBikeContract.create(
                            rider.get().getId(), bike.get().getId(),
                            template.get().getId(), startAt, endAt, null));
                }
                applied++;
            } catch (Exception e) {
                skipped++;
            }
        }
        return new BulkApplyResponse(applied, skipped);
    }

    public byte[] export() throws IOException {
        List<RiderBikeContract> contracts =
                contractRepository.findAllByTerminatedAtIsNullAndDeletedAtIsNull();
        List<List<String>> rows = contracts.stream()
                .map(c -> List.of(
                        "", "", "", "", "",
                        c.getStartAt().toString(),
                        c.getEndAt() != null ? c.getEndAt().toString() : "",
                        "N"))
                .toList();
        return ExcelExporter.export(ContractBulkService.class, "matching-template.xlsx",
                DATA_START_ROW, rows);
    }

    private BulkRowResult evaluateRow(List<String> cols, int rowNum) {
        String plate = cell(cols, 0);
        String phone = cell(cols, 2);
        String key = plate + " / " + phone;
        if (plate.isBlank() || phone.isBlank()) {
            return BulkRowResult.error(rowNum, key, "차량번호 또는 연락처 없음");
        }
        try {
            Optional<Bike> bike = bikeRepository.findByPlateNumberAndDeletedAtIsNull(plate);
            if (bike.isEmpty()) {
                return BulkRowResult.error(rowNum, key, "차량 없음: " + plate);
            }
            Optional<Rider> rider = riderRepository.findByPhoneNumberAndDeletedAtIsNull(phone);
            if (rider.isEmpty()) {
                return BulkRowResult.error(rowNum, key, "라이더 없음: " + phone);
            }
            ContractCategory category = parseCategory(cell(cols, 3));
            ContractReturnType returnType = parseReturnType(cell(cols, 4));
            Optional<ContractTemplate> template = templateRepository
                    .findFirstByCategoryAndReturnTypeAndEnabledTrueAndDeletedAtIsNull(
                            category, returnType);
            if (template.isEmpty()) {
                return BulkRowResult.error(rowNum, key,
                        "계약 템플릿 없음: " + cell(cols, 3) + "/" + cell(cols, 4));
            }
            Optional<RiderBikeContract> existing = contractRepository
                    .findActiveByBikeIdAndRiderId(bike.get().getId(), rider.get().getId());
            if (existing.isEmpty()) {
                return BulkRowResult.newRow(rowNum, key);
            }
            List<String> changes = new ArrayList<>();
            if (!existing.get().getContractTemplateId().equals(template.get().getId())) {
                changes.add("template");
            }
            Instant newStart = parseDate(cell(cols, 5));
            Instant newEnd = parseDate(cell(cols, 6));
            if (!existing.get().getStartAt().equals(newStart)) changes.add("startAt");
            if (existing.get().getEndAt() == null
                    ? newEnd != null
                    : !existing.get().getEndAt().equals(newEnd)) {
                changes.add("endAt");
            }
            return changes.isEmpty()
                    ? BulkRowResult.unchanged(rowNum, key)
                    : BulkRowResult.update(rowNum, key, List.copyOf(changes));
        } catch (IllegalArgumentException e) {
            return BulkRowResult.error(rowNum, key, e.getMessage());
        }
    }

    private ContractCategory parseCategory(String val) {
        return switch (val) {
            case "구독" -> ContractCategory.SUBSCRIPTION;
            case "렌탈" -> ContractCategory.RENTAL;
            default -> throw new IllegalArgumentException("알 수 없는 계약구분: " + val);
        };
    }

    private ContractReturnType parseReturnType(String val) {
        return switch (val) {
            case "인수형" -> ContractReturnType.TAKEOVER;
            case "반납형" -> ContractReturnType.RETURN;
            default -> throw new IllegalArgumentException("알 수 없는 반납형태: " + val);
        };
    }

    private Instant parseDate(String val) {
        if (val == null || val.isBlank()) {
            return null;
        }
        return LocalDate.parse(val).atStartOfDay(ZoneOffset.UTC).toInstant();
    }

    private static String cell(List<String> cols, int idx) {
        return idx < cols.size() ? cols.get(idx) : "";
    }
}
