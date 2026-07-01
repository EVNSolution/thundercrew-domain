package com.thundercrew.opsapi.rider.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.thundercrew.opsapi.rider.domain.RiderEducationType;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.UUID;

@JsonIgnoreProperties(ignoreUnknown = true)
public record RiderEducationRecordCreateRequest(
        @NotNull UUID riderId,
        @NotNull RiderEducationType educationType,
        @Size(max = 200) String courseName,
        @NotNull Instant completedAt,
        Instant expiresAt,
        @Size(max = 100) String certificateNo,
        @Size(max = 100) String issuingAuthority,
        String evidenceUrl,
        String memo
) {
}
