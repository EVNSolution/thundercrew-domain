package com.thundercrew.opsapi.contract.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.thundercrew.opsapi.contract.domain.ContractCategory;
import com.thundercrew.opsapi.contract.domain.ContractDurationUnit;
import com.thundercrew.opsapi.contract.domain.ContractReturnType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.util.UUID;

/**
 * Backward-compatible: legacy callers can still send only {@code name +
 * durationMinutes + description + enabled} (the request lands as a CUSTOM
 * template). New callers should send {@code category + returnType +
 * durationUnit + durationValue + includesInsurance} so the template carries
 * structured business meaning. When both shapes arrive the new fields win and
 * {@code durationMinutes} is ignored at the service layer.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record ContractTemplateCreateRequest(
        @NotBlank @Size(max = 100) String name,
        @Positive Integer durationMinutes,
        String description,
        Boolean enabled,
        ContractCategory category,
        ContractReturnType returnType,
        ContractDurationUnit durationUnit,
        @Positive Integer durationValue,
        Boolean includesInsurance,
        UUID defaultInsuranceItemId
) {
}
