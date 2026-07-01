package com.thundercrew.opsapi.devicesync.dto;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.constraints.Size;

public record DeviceApiSyncRunCompleteRequest(
        JsonNode responseSummary,
        @Size(max = 100) String errorCode,
        String errorMessage
) {
}
