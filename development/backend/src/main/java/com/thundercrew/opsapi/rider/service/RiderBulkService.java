package com.thundercrew.opsapi.rider.service;

import com.thundercrew.opsapi.common.bulk.BulkApplyResponse;
import com.thundercrew.opsapi.common.bulk.BulkPreviewResponse;
import com.thundercrew.opsapi.common.bulk.BulkRowResult;
import com.thundercrew.opsapi.common.util.PhoneNumbers;
import com.thundercrew.opsapi.common.excel.ExcelExporter;
import com.thundercrew.opsapi.common.excel.ExcelParser;
import com.thundercrew.opsapi.contract.repository.RiderBikeContractRepository;
import com.thundercrew.opsapi.rider.domain.Rider;
import com.thundercrew.opsapi.rider.domain.RiderRole;
import com.thundercrew.opsapi.rider.domain.RiderSkillLevel;
import com.thundercrew.opsapi.rider.domain.RiderTrainingStatus;
import com.thundercrew.opsapi.rider.repository.RiderRepository;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class RiderBulkService {

    private static final int DATA_START_ROW = 2;

    private final RiderRepository riderRepository;
    private final RiderBikeContractRepository contractRepository;

    public RiderBulkService(RiderRepository riderRepository, RiderBikeContractRepository contractRepository) {
        this.riderRepository = riderRepository;
        this.contractRepository = contractRepository;
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
                String name = cell(cols, 0);
                String phone = PhoneNumbers.format(cell(cols, 1));
                if (name.isBlank() || phone == null || phone.isBlank()) {
                    skipped++;
                    continue;
                }
                // 열 순서는 자원 관리 라이더/클리너 표와 동일: 직무/등급/교육이수/팀.
                RiderRole role = parseRole(cell(cols, 2));
                RiderSkillLevel skill = parseSkill(cell(cols, 3));
                RiderTrainingStatus training = parseTraining(cell(cols, 4));
                String team = cell(cols, 5).isBlank() ? null : cell(cols, 5);

                Optional<Rider> existing = riderRepository.findByPhoneNumberAndDeletedAtIsNull(phone);
                if (existing.isPresent()) {
                    Rider rider = existing.get();
                    // 단건 수정과 같은 가드 — 활성 매칭 중 직무 변경 금지.
                    if (rider.getRole() != role
                            && contractRepository.findActiveByRiderId(rider.getId()).isPresent()) {
                        skipped++;
                        continue;
                    }
                    rider.updateBasicProfile(name, null, team, null, null, null, null);
                    rider.setRole(role);
                    rider.setSkillLevel(skill);
                    rider.updateTrainingStatus(training);
                    riderRepository.save(rider);
                } else {
                    Rider rider = Rider.create(name, phone, team, null, null);
                    rider.setRole(role);
                    rider.setSkillLevel(skill);
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
                        r.getRole() == RiderRole.CLEANER ? "클리너" : "라이더",
                        skillLabel(r.getSkillLevel()),
                        trainingLabel(r.getTrainingStatus()),
                        r.getTeamName() != null ? r.getTeamName() : ""))
                .toList();
        // 전화번호 열(인덱스 1): 텍스트 서식 고정(선행 0 보존) + 형식 데이터 유효성 검사
        // (010-1234-5678 형식 아니면 입력 차단).
        return ExcelExporter.export(RiderBulkService.class, "riders-template.xlsx",
                DATA_START_ROW, rows, new int[] {1}, new int[] {1});
    }

    private BulkRowResult evaluateRow(List<String> cols, int rowNum) {
        String phone = cell(cols, 1);
        if (phone.isBlank()) {
            return BulkRowResult.error(rowNum, "(빈 행)", "연락처 없음");
        }
        try {
            String name = cell(cols, 0);
            RiderRole role = parseRole(cell(cols, 2));
            RiderSkillLevel skill = parseSkill(cell(cols, 3));
            RiderTrainingStatus training = parseTraining(cell(cols, 4));
            String team = cell(cols, 5).isBlank() ? null : cell(cols, 5);

            Optional<Rider> existing = riderRepository.findByPhoneNumberAndDeletedAtIsNull(phone);
            if (existing.isEmpty()) {
                return BulkRowResult.newRow(rowNum, phone);
            }
            Rider rider = existing.get();
            List<String> changes = new ArrayList<>();
            if (!Objects.equals(rider.getName(), name)) changes.add("name");
            if (rider.getRole() != role) {
                if (contractRepository.findActiveByRiderId(rider.getId()).isPresent()) {
                    return BulkRowResult.error(rowNum, phone, "활성 매칭이 있는 라이더/클리너의 직무는 변경할 수 없습니다");
                }
                changes.add("role");
            }
            if (rider.getSkillLevel() != skill) {
                changes.add("skillLevel");
            }
            if (!Objects.equals(trainingLabel(rider.getTrainingStatus()), cell(cols, 4))) {
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

    private RiderRole parseRole(String val) {
        return switch (val) {
            case "라이더" -> RiderRole.RIDER;
            case "클리너" -> RiderRole.CLEANER;
            default -> throw new IllegalArgumentException("알 수 없는 직무: " + val);
        };
    }

    private RiderSkillLevel parseSkill(String val) {
        return switch (val) {
            case "초보" -> RiderSkillLevel.BEGINNER;
            case "고수" -> RiderSkillLevel.EXPERT;
            default -> null; // 미판정/빈 값
        };
    }

    private static String skillLabel(RiderSkillLevel skill) {
        if (skill == RiderSkillLevel.BEGINNER) return "초보";
        if (skill == RiderSkillLevel.EXPERT) return "고수";
        return "미판정";
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
