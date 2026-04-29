package com.thundercrew.opsapi.insurance.dto;

import com.thundercrew.opsapi.insurance.domain.InsuranceItem;
import java.time.Instant;
import java.util.UUID;

public record InsuranceItemReadResponse(
        UUID id,
        Long idx,
        String name,
        String description,
        boolean enabled,
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
                item.getCreatedAt(),
                item.getUpdatedAt()
        );
    }
}
