package com.thundercrew.opsapi.contract.service;

import com.thundercrew.opsapi.bike.domain.Bike;
import com.thundercrew.opsapi.bike.domain.BikePurpose;
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
                // 9-column layout:
                // col0=차량번호, col1=용도(자동 표시 — 파싱 안 함), col2=라이더이름, col3=연락처,
                // col4=계약형태, col5=인수방식, col6=시작일, col7=종료일, col8=검증결과
                String plate = cell(cols, 0);
                String phone = cell(cols, 3);
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
                ContractCategory category = parseCategory(cell(cols, 4));
                ContractReturnType returnType = parseReturnType(cell(cols, 5));
                Optional<ContractTemplate> template = templateRepository
                        .findFirstByCategoryAndReturnTypeAndEnabledTrueAndDeletedAtIsNull(
                                category, returnType);
                if (template.isEmpty()) {
                    skipped++;
                    continue;
                }
                Instant startAt = parseDate(cell(cols, 6));
                if (startAt == null) {
                    skipped++;
                    continue;
                }
                Instant endAt = parseDate(cell(cols, 7));

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
            } catch (IllegalArgumentException e) {
                skipped++;
            }
        }
        return new BulkApplyResponse(applied, skipped);
    }

    public byte[] export() throws IOException {
        List<RiderBikeContract> contracts =
                contractRepository.findAllByTerminatedAtIsNullAndDeletedAtIsNull();
        List<List<String>> rows = new ArrayList<>();
        for (RiderBikeContract c : contracts) {
            Optional<Bike> bikeOpt = bikeRepository.findByIdAndDeletedAtIsNull(c.getBikeId());
            if (bikeOpt.isEmpty()) continue;
            Optional<Rider> riderOpt = riderRepository.findByIdAndDeletedAtIsNull(c.getRiderId());
            if (riderOpt.isEmpty()) continue;
            Optional<ContractTemplate> templateOpt =
                    templateRepository.findByIdAndDeletedAtIsNull(c.getContractTemplateId());
            if (templateOpt.isEmpty()) continue;

            Bike bike = bikeOpt.get();
            Rider rider = riderOpt.get();
            ContractTemplate template = templateOpt.get();

            String categoryLabel = template.getCategory() == ContractCategory.SUBSCRIPTION
                    ? "구독" : "렌탈";
            String returnTypeLabel = template.getReturnType() == ContractReturnType.TAKEOVER
                    ? "인수형" : "반납형";

            // 9-column layout matching the template:
            // col0=차량번호, col1=용도(자동 표시 — 파싱 안 함), col2=라이더이름, col3=연락처,
            // col4=계약형태, col5=인수방식, col6=시작일(YYYY-MM-DD), col7=종료일(YYYY-MM-DD), col8=검증결과
            rows.add(List.of(
                    bike.getPlateNumber(),                                                                           // col0 차량번호
                    purposeLabel(bike.getPurpose()),                                                                 // col1 용도 (자동 표시)
                    rider.getName(),                                                                                 // col2 라이더 이름
                    rider.getPhoneNumber(),                                                                          // col3 연락처
                    categoryLabel,                                                                                   // col4 계약형태
                    returnTypeLabel,                                                                                 // col5 인수방식
                    LocalDate.ofInstant(c.getStartAt(), ZoneOffset.UTC).toString(),                                  // col6 시작일
                    c.getEndAt() != null ? LocalDate.ofInstant(c.getEndAt(), ZoneOffset.UTC).toString() : "",       // col7 종료일
                    ""));                                                                                            // col8 검증 결과 (blank)
        }
        return ExcelExporter.export(ContractBulkService.class, "matching-template.xlsx",
                DATA_START_ROW, rows);
    }

    public byte[] exportLog() throws IOException {
        List<RiderBikeContract> contracts = contractRepository.findAllByDeletedAtIsNullOrderByStartAtDesc();
        List<String> headers = List.of(
                "차량번호", "용도", "라이더이름", "연락처",
                "계약형태", "인수방식", "시작일", "종료예정일", "상태", "종료시각");
        List<List<String>> rows = new ArrayList<>();
        for (RiderBikeContract c : contracts) {
            // 로그는 이력 보존이 목적이라, 차량/라이더/템플릿이 (이후) 삭제됐어도 행을 남긴다 — 누락 필드는 "—".
            Bike bike = bikeRepository.findByIdAndDeletedAtIsNull(c.getBikeId()).orElse(null);
            Rider rider = riderRepository.findByIdAndDeletedAtIsNull(c.getRiderId()).orElse(null);
            ContractTemplate template = templateRepository.findByIdAndDeletedAtIsNull(c.getContractTemplateId()).orElse(null);

            String plate = bike != null ? bike.getPlateNumber() : "—";
            String svcType = bike != null ? purposeLabel(bike.getPurpose()) : "—";
            String riderName = rider != null ? rider.getName() : "—";
            String riderPhone = rider != null ? rider.getPhoneNumber() : "—";
            String category = template == null ? "—"
                    : (template.getCategory() == ContractCategory.SUBSCRIPTION ? "구독" : "렌탈");
            String returnType = template == null ? "—"
                    : (template.getReturnType() == ContractReturnType.TAKEOVER ? "인수형" : "반납형");
            String startDate = LocalDate.ofInstant(c.getStartAt(), ZoneOffset.UTC).toString();
            String endDate = c.getEndAt() != null ? LocalDate.ofInstant(c.getEndAt(), ZoneOffset.UTC).toString() : "";
            boolean terminated = c.getTerminatedAt() != null;
            String status = terminated ? "종료" : "진행 중";
            String terminatedAt = terminated ? LocalDate.ofInstant(c.getTerminatedAt(), ZoneOffset.UTC).toString() : "";

            rows.add(List.of(plate, svcType, riderName, riderPhone, category, returnType,
                    startDate, endDate, status, terminatedAt));
        }
        return ExcelExporter.exportWithHeaders(headers, rows);
    }

    private BulkRowResult evaluateRow(List<String> cols, int rowNum) {
        // 9-column layout:
        // col0=차량번호, col1=용도(자동 표시 — 파싱 안 함), col2=라이더이름, col3=연락처,
        // col4=계약형태, col5=인수방식, col6=시작일, col7=종료일, col8=검증결과
        String plate = cell(cols, 0);
        String phone = cell(cols, 3);
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
            ContractCategory category = parseCategory(cell(cols, 4));
            ContractReturnType returnType = parseReturnType(cell(cols, 5));
            Optional<ContractTemplate> template = templateRepository
                    .findFirstByCategoryAndReturnTypeAndEnabledTrueAndDeletedAtIsNull(
                            category, returnType);
            if (template.isEmpty()) {
                return BulkRowResult.error(rowNum, key,
                        "계약 템플릿 없음: " + cell(cols, 4) + "/" + cell(cols, 5));
            }
            if (parseDate(cell(cols, 6)) == null) {
                return BulkRowResult.error(rowNum, key, "시작일 없음");
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
            Instant newStart = parseDate(cell(cols, 6));
            Instant newEnd = parseDate(cell(cols, 7));
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

    /** col1 은 배차 방식이었다가 용도 단일화(V59)로 차량 용도의 읽기 전용 표시가 됐다.
     *  업로드에서는 파싱하지 않는다 — 용도는 차량의 속성이라 매칭 엑셀로 바꿀 수 없다. */
    private static String purposeLabel(BikePurpose p) {
        return p == BikePurpose.CLEANING ? "클린차량" : "배송용";
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
