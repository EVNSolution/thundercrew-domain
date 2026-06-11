package com.thundercrew.opsapi.dispatch.domain;

import com.thundercrew.opsapi.common.domain.DisplaySequencedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "dispatch_orders")
public class DispatchOrder extends DisplaySequencedEntity {

    @Column(name = "bike_id", nullable = false)
    private UUID bikeId;

    @Column(nullable = false, columnDefinition = "text")
    private String customerName;

    @Column(nullable = false, columnDefinition = "text")
    private String customerPhone;

    @Column(nullable = false, columnDefinition = "text")
    private String address;

    @Column(nullable = false)
    private double latitude;

    @Column(nullable = false)
    private double longitude;

    @Column(nullable = false)
    private long sequence;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private DispatchOrderStatus status;

    @Column
    private Instant completedAt;

    public static DispatchOrder create(UUID bikeId, String customerName, String customerPhone,
                                       String address, double latitude, double longitude, long sequence) {
        DispatchOrder order = new DispatchOrder();
        order.bikeId = bikeId;
        order.customerName = customerName;
        order.customerPhone = customerPhone;
        order.address = address;
        order.latitude = latitude;
        order.longitude = longitude;
        order.sequence = sequence;
        order.status = DispatchOrderStatus.ASSIGNED;
        return order;
    }

    public void complete(Instant when) {
        this.status = DispatchOrderStatus.COMPLETED;
        this.completedAt = when;
    }

    public UUID getBikeId() {
        return bikeId;
    }

    public String getCustomerName() {
        return customerName;
    }

    public String getCustomerPhone() {
        return customerPhone;
    }

    public String getAddress() {
        return address;
    }

    public double getLatitude() {
        return latitude;
    }

    public double getLongitude() {
        return longitude;
    }

    public long getSequence() {
        return sequence;
    }

    public DispatchOrderStatus getStatus() {
        return status;
    }

    public Instant getCompletedAt() {
        return completedAt;
    }

    protected DispatchOrder() {
    }
}
