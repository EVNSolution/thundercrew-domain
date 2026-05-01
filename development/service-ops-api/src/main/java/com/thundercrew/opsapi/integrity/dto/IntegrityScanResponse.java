package com.thundercrew.opsapi.integrity.dto;

import java.time.Instant;
import java.util.List;

public record IntegrityScanResponse(
        Instant generatedAt,
        long totalFindings,
        List<IntegritySummaryResponse> summary,
        List<IntegrityFindingResponse> findings
) {
}
