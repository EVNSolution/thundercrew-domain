package com.thundercrew.opsapi.contract.dto;

import com.thundercrew.opsapi.contract.domain.ContractTemplate;
import java.time.Instant;
import java.util.UUID;

public record ContractTemplateReadResponse(
        UUID id,
        Long idx,
        String name,
        Integer durationMinutes,
        boolean unlimited,
        String description,
        boolean enabled,
        boolean systemTemplate,
        Instant createdAt,
        Instant updatedAt
) {
    public static ContractTemplateReadResponse from(ContractTemplate template) {
        return new ContractTemplateReadResponse(
                template.getId(),
                template.getIdx(),
                template.getName(),
                template.getDurationMinutes(),
                template.getDurationMinutes() == null,
                template.getDescription(),
                template.isEnabled(),
                template.isSystemTemplate(),
                template.getCreatedAt(),
                template.getUpdatedAt()
        );
    }
}
