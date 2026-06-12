package com.thundercrew.opsapi.dispatch.domain;

import com.thundercrew.opsapi.common.api.InvalidStateTransitionException;
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

    @Column(name = "bike_id")
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

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private DispatchOrderKind kind;

    @Column(name = "batch_id")
    private UUID batchId;

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
        order.kind = DispatchOrderKind.DELIVERY;
        order.batchId = null;
        return order;
    }

    public static DispatchOrder createForBatch(UUID bikeId, String customerName, String customerPhone,
                                               String address, double latitude, double longitude, long sequence,
                                               DispatchOrderKind kind, UUID batchId) {
        DispatchOrder order = create(bikeId, customerName, customerPhone, address, latitude, longitude, sequence);
        order.kind = kind;
        order.batchId = batchId;
        return order;
    }

    public void complete(Instant when) {
        if (this.status != DispatchOrderStatus.ASSIGNED) {
            throw new InvalidStateTransitionException("배정된 배차만 완료할 수 있습니다. 현재: " + this.status);
        }
        this.status = DispatchOrderStatus.COMPLETED;
        this.completedAt = when;
    }

    /** 배민 라이더 수락 콜: 차량 미배정(OFFERED) 생성. 수락 시 assign 으로 차량/순번 부여. */
    public static DispatchOrder createOffered(String customerName, String customerPhone,
                                              String address, double latitude, double longitude) {
        DispatchOrder order = new DispatchOrder();
        order.bikeId = null;
        order.customerName = customerName;
        order.customerPhone = customerPhone;
        order.address = address;
        order.latitude = latitude;
        order.longitude = longitude;
        order.sequence = 0L;
        order.status = DispatchOrderStatus.OFFERED;
        order.kind = DispatchOrderKind.DELIVERY;
        order.batchId = null;
        return order;
    }

    /** OFFERED 콜을 차량에 배정. OFFERED 가 아니면 거부. */
    public void assign(UUID bikeId, long sequence) {
        if (this.status != DispatchOrderStatus.OFFERED) {
            throw new InvalidStateTransitionException("이미 배정된 콜입니다. 현재: " + this.status);
        }
        this.bikeId = bikeId;
        this.sequence = sequence;
        this.status = DispatchOrderStatus.ASSIGNED;
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

    public DispatchOrderKind getKind() {
        return kind;
    }

    public UUID getBatchId() {
        return batchId;
    }

    protected DispatchOrder() {
    }
}
