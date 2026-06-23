package com.thundercrew.opsapi.rider.service;

import com.thundercrew.opsapi.common.bulk.BulkActionColumn;
import com.thundercrew.opsapi.common.bulk.BulkApplyResponse;
import com.thundercrew.opsapi.common.bulk.BulkPreviewResponse;
import com.thundercrew.opsapi.common.bulk.BulkRowResult;
import com.thundercrew.opsapi.common.util.PhoneNumbers;
import com.thundercrew.opsapi.common.excel.ExcelExporter;
import com.thundercrew.opsapi.common.excel.ExcelParser;
import com.thundercrew.opsapi.rider.domain.Rider;
import com.thundercrew.opsapi.rider.domain.RiderTrainingStatus;
import com.thundercrew.opsapi.rider.repository.RiderRepository;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class RiderBulkService {

    private static final int DATA_START_ROW = 2;

    private final RiderRepository riderRepository;
    private final RiderCommandService riderCommandService;

    public RiderBulkService(RiderRepository riderRepository, RiderCommandService riderCommandService) {
        this.riderRepository = riderRepository;
        this.riderCommandService = riderCommandService;
    }

    public BulkPreviewResponse preview(InputStream excelStream) throws IOException {
        List<List<String>> rows = ExcelParser.parseRows(excelStream, DATA_START_ROW);
        List<BulkRowResult> results = new ArrayList<>();
        int rowNum = DATA_START_ROW + 1; // convert 0-indexed to 1-indexed Excel row
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
                String action = cell(cols, 4);
                if (BulkActionColumn.isInvalid(action)) { skipped++; continue; }
                if (BulkActionColumn.isDelete(action)) {
                    String delPhone = PhoneNumbers.format(cell(cols, 1));
                    Optional<Rider> target = (delPhone == null || delPhone.isBlank())
                            ? Optional.empty()
                            : riderRepository.findByPhoneNumberAndDeletedAtIsNull(delPhone);
                    if (target.isEmpty()) { skipped++; continue; }
                    try {
                        riderCommandService.softDelete(target.get().getId());
                        applied++;
                    } catch (Exception e) {
                        skipped++;
                    }
                    continue;
                }
                String name = cell(cols, 0);
                String phone = PhoneNumbers.format(cell(cols, 1));
                if (name.isBlank() || phone == null || phone.isBlank()) {
                    skipped++;
                    continue;
                }
                RiderTrainingStatus training = parseTraining(cell(cols, 2));
                String team = cell(cols, 3).isBlank() ? null : cell(cols, 3);

                Optional<Rider> existing = riderRepository.findByPhoneNumberAndDeletedAtIsNull(phone);
                if (existing.isPresent()) {
                    Rider rider = existing.get();
                    rider.updateBasicProfile(name, null, team, null, null);
                    rider.updateTrainingStatus(training);
                    riderRepository.save(rider);
                } else {
                    Rider rider = Rider.create(name, phone, team, null, null);
                    rider.updateTrainingStatus(training);
                    riderRepository.save(rider);
                }
                applied++;
            } catch (Exception e) {
                skipped++;
            }
        }
        return new BulkApplyResponse(applied, skipped);
    }

    public byte[] export() throws IOException {
        List<Rider> riders = riderRepository.findAllByDeletedAtIsNull();
        List<List<String>> rows = riders.stream()
                .map(r -> List.of(
                        r.getName(),
                        r.getPhoneNumber(),
                        trainingLabel(r.getTrainingStatus()),
                        r.getTeamName() != null ? r.getTeamName() : "",
                        ""))
                .toList();
        // 전화번호 열(인덱스 1): 텍스트 서식 고정(선행 0 보존) + 형식 데이터 유효성 검사
        // (010-1234-5678 형식 아니면 입력 차단).
        return ExcelExporter.export(RiderBulkService.class, "riders-template.xlsx",
                DATA_START_ROW, rows, new int[] {1}, new int[] {1});
    }

    private BulkRowResult evaluateRow(List<String> cols, int rowNum) {
        String action = cell(cols, 4);
        if (BulkActionColumn.isInvalid(action)) {
            return BulkRowResult.error(rowNum, cell(cols, 1), "관리구분 값 오류: " + action.trim());
        }
        if (BulkActionColumn.isDelete(action)) {
            String delPhone = cell(cols, 1);
            Optional<Rider> target = riderRepository.findByPhoneNumberAndDeletedAtIsNull(delPhone);
            if (target.isEmpty()) {
                return BulkRowResult.error(rowNum, delPhone, "삭제 대상 없음");
            }
            UUID id = target.get().getId();
            if (riderRepository.existsActiveContractReference(id) || riderRepository.existsActiveInsuranceReference(id)) {
                return BulkRowResult.error(rowNum, delPhone, "삭제불가: 활성 매칭/보험 존재");
            }
            return BulkRowResult.delete(rowNum, delPhone);
        }
        String phone = cell(cols, 1);
        if (phone.isBlank()) {
            return BulkRowResult.error(rowNum, "(빈 행)", "연락처 없음");
        }
        try {
            String name = cell(cols, 0);
            RiderTrainingStatus training = parseTraining(cell(cols, 2));
            String team = cell(cols, 3).isBlank() ? null : cell(cols, 3);

            Optional<Rider> existing = riderRepository.findByPhoneNumberAndDeletedAtIsNull(phone);
            if (existing.isEmpty()) {
                return BulkRowResult.newRow(rowNum, phone);
            }
            Rider rider = existing.get();
            List<String> changes = new ArrayList<>();
            if (!Objects.equals(rider.getName(), name)) changes.add("name");
            if (!Objects.equals(trainingLabel(rider.getTrainingStatus()), cell(cols, 2))) {
                changes.add("trainingStatus");
            }
            if (!Objects.equals(rider.getTeamName(), team)) changes.add("teamName");
            return changes.isEmpty()
                    ? BulkRowResult.unchanged(rowNum, phone)
                    : BulkRowResult.update(rowNum, phone, List.copyOf(changes));
        } catch (IllegalArgumentException e) {
            return BulkRowResult.error(rowNum, phone, e.getMessage());
        }
    }

    private RiderTrainingStatus parseTraining(String val) {
        return switch (val) {
            case "온라인" -> RiderTrainingStatus.ONLINE;
            case "오프라인" -> RiderTrainingStatus.OFFLINE;
            case "미완료", "" -> RiderTrainingStatus.INCOMPLETE;
            default -> throw new IllegalArgumentException("알 수 없는 교육이수: " + val);
        };
    }

    private String trainingLabel(RiderTrainingStatus status) {
        if (status == null) return "미완료";
        return switch (status) {
            case ONLINE -> "온라인";
            case OFFLINE -> "오프라인";
            case INCOMPLETE -> "미완료";
        };
    }

    private static String cell(List<String> cols, int idx) {
        return idx < cols.size() ? cols.get(idx) : "";
    }
}
