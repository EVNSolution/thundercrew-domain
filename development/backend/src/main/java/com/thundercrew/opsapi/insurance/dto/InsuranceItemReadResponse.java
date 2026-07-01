package com.thundercrew.opsapi.insurance.dto;

import com.thundercrew.opsapi.insurance.domain.InsuranceCategory;
import com.thundercrew.opsapi.insurance.domain.InsuranceCoverageType;
import com.thundercrew.opsapi.insurance.domain.InsuranceDurationUnit;
import com.thundercrew.opsapi.insurance.domain.InsuranceItem;
import java.time.Instant;
import java.util.UUID;

public record InsuranceItemReadResponse(
        UUID id,
        Long idx,
        String name,
        String description,
        boolean enabled,
        InsuranceCategory category,
        InsuranceCoverageType coverageType,
        InsuranceDurationUnit defaultDurationUnit,
        Integer defaultDurationValue,
        Instant createdAt,
        Instant updatedAt
) {
    public static InsuranceItemReadResponse from(InsuranceItem item) {
        return new InsuranceItemReadResponse(
                item.getId(),
                item.getIdx(),
                item.getName(),
                item.getDescription(),
                item.isEnabled(),
                item.getCategory(),
                item.getCoverageType(),
                item.getDefaultDurationUnit(),
                item.getDefaultDurationValue(),
                item.getCreatedAt(),
                item.getUpdatedAt()
        );
    }
}
