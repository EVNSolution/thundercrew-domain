package com.thundercrew.opsapi.devicesync.dto;

import com.fasterxml.jackson.databind.JsonNode;
import com.thundercrew.opsapi.devicesync.domain.DeviceApiSyncType;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record DeviceApiSyncRunCreateRequest(
        @NotNull DeviceApiSyncType syncType,
        @Size(max = 200) String externalTraceId,
        JsonNode requestSummary
) {
}
