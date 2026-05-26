package com.thundercrew.opsapi.cleaningschedule.dto;

import com.thundercrew.opsapi.cleaningschedule.domain.CleaningSchedule;
import java.time.LocalDateTime;

public record CleaningScheduleReadResponse(
    String id,
    String bikeId,
    String bikePlateNumber,
    LocalDateTime scheduledAt,
    String address,
    String memo
) {
    public static CleaningScheduleReadResponse of(CleaningSchedule s, String bikePlateNumber) {
        return new CleaningScheduleReadResponse(
            s.getId().toString(),
            s.getBikeId().toString(),
            bikePlateNumber,
            s.getScheduledAt(),
            s.getAddress(),
            s.getMemo()
        );
    }
}
