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

    /** 클리닝 배차의 서비스 예정 시각 (V56). 배송 배차는 null — 순번 축을 쓴다. */
    @Column(name = "scheduled_at")
    private Instant scheduledAt;

    /** 건별 소요시간(분). null 이면 설정 기본값으로 계산한다. */
    @Column(name = "service_minutes")
    private Integer serviceMinutes;

    /** 완료 방식 — AUTO(텔레메트리 추정) / MANUAL(운영자). COMPLETED 이전 null. */
    @Enumerated(EnumType.STRING)
    @Column(name = "completed_source", length = 10)
    private CompletedSource completedSource;

    /** 목적지 반경 안 정지 상태가 처음 관측된 시각 (V64). 이탈/이동 시 리셋. */
    @Column(name = "arrival_stop_since")
    private Instant arrivalStopSince;

    /** 정지 유지 시간이 채워져 "도착 감지" 로 확정된 시각 (V64). */
    @Column(name = "arrival_detected_at")
    private Instant arrivalDetectedAt;

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
        this.completedSource = CompletedSource.MANUAL;
    }

    /** 운영자 수동 완료 — 사진 없이. 모니터의 "완료" 버튼과 추정 불가 차량용. */
    public void completeManual(Instant when, UUID completedBy) {
        if (this.status != DispatchOrderStatus.ASSIGNED) {
            throw new InvalidStateTransitionException("배정된 배차만 완료할 수 있습니다. 현재: " + this.status);
        }
        this.status = DispatchOrderStatus.COMPLETED;
        this.completedAt = when;
        this.completedBy = completedBy;
        this.completedSource = CompletedSource.MANUAL;
    }

    /** 텔레메트리 자동 추정 완료 — 도착 감지 후 반경 이탈 시 스케줄러가 부른다. */
    public void completeAuto(Instant when) {
        if (this.status != DispatchOrderStatus.ASSIGNED) {
            throw new InvalidStateTransitionException("배정된 배차만 완료할 수 있습니다. 현재: " + this.status);
        }
        this.status = DispatchOrderStatus.COMPLETED;
        this.completedAt = when;
        this.completedSource = CompletedSource.AUTO;
    }

    /**
     * 완료 되돌리기 — 오판 정정. 도착 추적 상태까지 초기화해 자동 추정이
     * 처음부터 다시 판정할 수 있게 한다. 사진도 함께 지운다(잘못된 완료의
     * 증빙이 남아 있으면 다음 완료와 섞인다).
     */
    public void revertCompletion() {
        if (this.status != DispatchOrderStatus.COMPLETED) {
            throw new InvalidStateTransitionException("완료된 배차만 되돌릴 수 있습니다. 현재: " + this.status);
        }
        this.status = DispatchOrderStatus.ASSIGNED;
        this.completedAt = null;
        this.completedBy = null;
        this.completedSource = null;
        this.completionPhoto = null;
        this.completionPhotoContentType = null;
        this.arrivalStopSince = null;
        this.arrivalDetectedAt = null;
    }

    /** 클리닝 시간 배차 — 예정 시각·소요시간 지정. 생성 직후에만 부른다. */
    public void scheduleCleaning(Instant scheduledAt, Integer serviceMinutes) {
        this.scheduledAt = scheduledAt;
        this.serviceMinutes = serviceMinutes;
    }

    // ── 도착 추적 (스케줄러 전용) ──────────────────────────────────

    public void markArrivalStop(Instant when) {
        this.arrivalStopSince = when;
    }

    public void clearArrivalStop() {
        this.arrivalStopSince = null;
    }

    public void confirmArrival(Instant when) {
        this.arrivalDetectedAt = when;
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

    public Instant getScheduledAt() {
        return scheduledAt;
    }

    public Integer getServiceMinutes() {
        return serviceMinutes;
    }

    public CompletedSource getCompletedSource() {
        return completedSource;
    }

    public Instant getArrivalStopSince() {
        return arrivalStopSince;
    }

    public Instant getArrivalDetectedAt() {
        return arrivalDetectedAt;
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
