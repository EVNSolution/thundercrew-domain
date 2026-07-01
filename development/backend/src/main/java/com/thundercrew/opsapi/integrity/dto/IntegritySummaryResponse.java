package com.thundercrew.opsapi.integrity.dto;

public record IntegritySummaryResponse(
        IntegrityFindingCategory category,
        long count
) {
}
