package com.thundercrew.opsapi.devicesync.dto;

import com.fasterxml.jackson.databind.JsonNode;
import com.thundercrew.opsapi.devicesync.domain.DeviceApiSyncRequestedResultStatus;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record DeviceApiSyncResultCreateRequest(
        @NotBlank @Size(max = 100) String deviceUid,
        @Size(max = 200) String externalEventId,
        @NotNull DeviceApiSyncRequestedResultStatus status,
        @Min(100) @Max(599) Integer httpStatus,
        JsonNode requestSummary,
        JsonNode responseSummary,
        @Size(max = 100) String errorCode,
        String errorMessage
) {
}
