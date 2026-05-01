package com.thundercrew.opsapi.common.api;

import java.time.Instant;
import java.util.List;

public record ApiErrorResponse(
        ErrorCode code,
        String message,
        String path,
        Instant timestamp,
        List<FieldViolation> fieldViolations
) {
    public static ApiErrorResponse of(ErrorCode code, String message, String path, Instant timestamp) {
        return new ApiErrorResponse(code, message, path, timestamp, List.of());
    }

    public record FieldViolation(String field, String message) {
    }
}
