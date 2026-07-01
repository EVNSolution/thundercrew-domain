package com.thundercrew.opsapi.audit.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public record AuditLogCreateRequest(
        @NotBlank String entityType,
        @NotNull UUID entityId,
        @NotBlank String field,
        String oldValue,
        String newValue
) {}
