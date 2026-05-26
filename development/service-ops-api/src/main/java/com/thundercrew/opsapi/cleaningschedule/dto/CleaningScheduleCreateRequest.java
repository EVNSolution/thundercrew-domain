package com.thundercrew.opsapi.cleaningschedule.dto;

import java.time.LocalDateTime;

public record CleaningScheduleCreateRequest(
    String bikeId,           // UUID 문자열
    LocalDateTime scheduledAt, // ISO-8601: "2026-06-01T10:00:00"
    String address,
    String memo              // nullable
) {}
