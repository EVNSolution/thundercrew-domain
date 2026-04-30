package com.thundercrew.opsapi.integrity.repository;

import com.thundercrew.opsapi.integrity.dto.IntegrityFindingCategory;
import java.util.UUID;

public record IntegrityFindingRow(
        IntegrityFindingCategory category,
        String sourceTable,
        UUID sourceId,
        Long sourceIdx,
        String referenceField,
        UUID referenceId,
        String targetTable
) {
}
