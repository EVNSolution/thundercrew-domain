package com.thundercrew.opsapi.integrity.dto;

import java.util.UUID;

public record IntegrityFindingResponse(
        IntegrityFindingCategory category,
        String sourceTable,
        UUID sourceId,
        Long sourceIdx,
        String referenceField,
        UUID referenceId,
        String targetTable,
        String message
) {
}
