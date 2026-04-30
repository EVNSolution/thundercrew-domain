package com.thundercrew.opsapi.integrity.service;

import com.thundercrew.opsapi.integrity.dto.IntegrityFindingCategory;
import com.thundercrew.opsapi.integrity.dto.IntegrityFindingResponse;
import com.thundercrew.opsapi.integrity.dto.IntegrityScanResponse;
import com.thundercrew.opsapi.integrity.dto.IntegritySummaryResponse;
import com.thundercrew.opsapi.integrity.repository.IntegrityFindingRow;
import com.thundercrew.opsapi.integrity.repository.IntegrityScanRepository;
import java.time.Clock;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class IntegrityScanService {

    private final IntegrityScanRepository integrityScanRepository;
    private final Clock clock;

    public IntegrityScanService(IntegrityScanRepository integrityScanRepository, Clock clock) {
        this.integrityScanRepository = integrityScanRepository;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public IntegrityScanResponse scanReferences() {
        List<IntegrityFindingResponse> findings = integrityScanRepository.findReferenceIntegrityFindings().stream()
                .map(this::toResponse)
                .toList();
        List<IntegritySummaryResponse> summary = summarize(findings);
        return new IntegrityScanResponse(clock.instant(), findings.size(), summary, findings);
    }

    private IntegrityFindingResponse toResponse(IntegrityFindingRow row) {
        return new IntegrityFindingResponse(
                row.category(),
                row.sourceTable(),
                row.sourceId(),
                row.sourceIdx(),
                row.referenceField(),
                row.referenceId(),
                row.targetTable(),
                "%s.%s references %s %s".formatted(
                        row.sourceTable(),
                        row.referenceField(),
                        row.category() == IntegrityFindingCategory.REFERENCE_DELETED ? "deleted" : "missing",
                        row.targetTable()
                )
        );
    }

    private List<IntegritySummaryResponse> summarize(List<IntegrityFindingResponse> findings) {
        Map<IntegrityFindingCategory, Long> counts = new EnumMap<>(IntegrityFindingCategory.class);
        for (IntegrityFindingResponse finding : findings) {
            counts.merge(finding.category(), 1L, Long::sum);
        }
        List<IntegritySummaryResponse> summary = new ArrayList<>();
        for (IntegrityFindingCategory category : IntegrityFindingCategory.values()) {
            Long count = counts.get(category);
            if (count != null) {
                summary.add(new IntegritySummaryResponse(category, count));
            }
        }
        return summary;
    }
}
