package com.thundercrew.opsapi.device.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

@JsonIgnoreProperties(ignoreUnknown = true)
public record DeviceCreateRequest(
        @NotBlank @Size(max = 100) String deviceUid,
        @Size(max = 100) String manufacturer,
        @Size(max = 100) String modelName,
        Boolean enabled,
        String memo
) {
}
