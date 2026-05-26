package com.thundercrew.opsapi.cleaningschedule.domain;

import com.thundercrew.opsapi.common.domain.AuditableEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "cleaning_schedules")
public class CleaningSchedule extends AuditableEntity {

    @Column(name = "bike_id", nullable = false, updatable = false)
    private UUID bikeId;

    @Column(name = "scheduled_at", nullable = false)
    private LocalDateTime scheduledAt;

    @Column(name = "address", nullable = false, length = 255)
    private String address;

    @Column(name = "memo", length = 500)
    private String memo;

    protected CleaningSchedule() {}

    public static CleaningSchedule create(UUID bikeId, LocalDateTime scheduledAt, String address, String memo) {
        CleaningSchedule s = new CleaningSchedule();
        s.bikeId = bikeId;
        s.scheduledAt = scheduledAt;
        s.address = address;
        s.memo = memo;
        return s;
    }

    public UUID getBikeId() { return bikeId; }
    public LocalDateTime getScheduledAt() { return scheduledAt; }
    public String getAddress() { return address; }
    public String getMemo() { return memo; }
}
