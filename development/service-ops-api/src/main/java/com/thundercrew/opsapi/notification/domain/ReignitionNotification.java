package com.thundercrew.opsapi.notification.domain;

import com.thundercrew.opsapi.common.domain.DisplaySequencedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "reignition_notifications")
public class ReignitionNotification extends DisplaySequencedEntity {

    @Column(name = "bike_id", nullable = false)
    private UUID bikeId;

    @Column(nullable = false, columnDefinition = "text")
    private String plateNumber;

    @Column(name = "occurred_at", nullable = false)
    private Instant occurredAt;

    @Column(name = "next_customer_name", columnDefinition = "text")
    private String nextCustomerName;

    @Column(name = "next_address", columnDefinition = "text")
    private String nextAddress;

    @Column(name = "next_latitude")
    private Double nextLatitude;

    @Column(name = "next_longitude")
    private Double nextLongitude;

    public static ReignitionNotification create(UUID bikeId, String plateNumber, Instant occurredAt,
                                                String nextCustomerName, String nextAddress,
                                                Double nextLatitude, Double nextLongitude) {
        ReignitionNotification notification = new ReignitionNotification();
        notification.bikeId = bikeId;
        notification.plateNumber = plateNumber;
        notification.occurredAt = occurredAt;
        notification.nextCustomerName = nextCustomerName;
        notification.nextAddress = nextAddress;
        notification.nextLatitude = nextLatitude;
        notification.nextLongitude = nextLongitude;
        return notification;
    }

    public UUID getBikeId() {
        return bikeId;
    }

    public String getPlateNumber() {
        return plateNumber;
    }

    public Instant getOccurredAt() {
        return occurredAt;
    }

    public String getNextCustomerName() {
        return nextCustomerName;
    }

    public String getNextAddress() {
        return nextAddress;
    }

    public Double getNextLatitude() {
        return nextLatitude;
    }

    public Double getNextLongitude() {
        return nextLongitude;
    }

    protected ReignitionNotification() {
    }
}
