package com.thundercrew.opsapi.rider.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.validation.constraints.NotNull;
import java.util.UUID;

@JsonIgnoreProperties(ignoreUnknown = true)
public record RiderAppAccountLinkRequest(
        @NotNull UUID appAccountId
) {
}
