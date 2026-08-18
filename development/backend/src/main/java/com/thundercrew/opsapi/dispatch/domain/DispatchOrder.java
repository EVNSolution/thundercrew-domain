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

    @Column(name = "origin_address", columnDefinition = "text")
    private String originAddress;
    @Column(name = "origin_latitude")
    private Double originLatitude;
    @Column(name = "origin_longitude")
    private Double originLongitude;

    @Column(nullable = false)
    private long sequence;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private DispatchOrderStatus status;

    @Column
    private Instant completedAt;

    @Column(name = "completion_photo")
    private byte[] completionPhoto;

    @Column(name = "completion_photo_content_type")
    private String completionPhotoContentType;

    @Column(name = "completed_by")
    private UUID completedBy;

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

    public void complete(Instant when, byte[] photo, String contentType, UUID completedBy) {
        if (this.status != DispatchOrderStatus.ASSIGNED) {
            throw new InvalidStateTransitionException("배정된 배차만 완료할 수 있습니다. 현재: " + this.status);
        }
        if (photo == null || photo.length == 0) {
            throw new InvalidStateTransitionException("배송 완료에는 사진이 필요합니다.");
        }
        this.status = DispatchOrderStatus.COMPLETED;
        this.completedAt = when;
        this.completionPhoto = photo;
        this.completionPhotoContentType = contentType;
        this.completedBy = completedBy;
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

    public String getOriginAddress() {
        return originAddress;
    }

    public Double getOriginLatitude() {
        return originLatitude;
    }

    public Double getOriginLongitude() {
        return originLongitude;
    }

    public byte[] getCompletionPhoto() {
        return completionPhoto;
    }

    public String getCompletionPhotoContentType() {
        return completionPhotoContentType;
    }

    public UUID getCompletedBy() {
        return completedBy;
    }

    /** 고객/주소 정보 수정. 배정 상태에서만 허용. */
    public void updateDetails(String customerName, String customerPhone,
                              String address, double latitude, double longitude) {
        if (this.status != DispatchOrderStatus.ASSIGNED) {
            throw new InvalidStateTransitionException("배정된 배차만 수정할 수 있습니다. 현재: " + this.status);
        }
        this.customerName = customerName;
        this.customerPhone = customerPhone;
        this.address = address;
        this.latitude = latitude;
        this.longitude = longitude;
    }

    /** 배정 차량·순번 변경(재배정). 배정 상태에서만 허용. */
    public void reassign(UUID bikeId, long sequence) {
        if (this.status != DispatchOrderStatus.ASSIGNED) {
            throw new InvalidStateTransitionException("배정된 배차만 재배정할 수 있습니다. 현재: " + this.status);
        }
        this.bikeId = bikeId;
        this.sequence = sequence;
    }

    /** 큐 내 순번만 변경(재정렬). 배정 상태에서만 허용. */
    public void changeSequence(long sequence) {
        if (this.status != DispatchOrderStatus.ASSIGNED) {
            throw new InvalidStateTransitionException("배정된 배차만 순번 변경할 수 있습니다. 현재: " + this.status);
        }
        this.sequence = sequence;
    }

    public void setOrigin(String originAddress, Double originLatitude, Double originLongitude) {
        this.originAddress = originAddress;
        this.originLatitude = originLatitude;
        this.originLongitude = originLongitude;
    }

    protected DispatchOrder() {
    }
}
