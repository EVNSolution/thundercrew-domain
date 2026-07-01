package com.thundercrew.opsapi.telemetry.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "device_telemetry_logs")
public class DeviceTelemetryLog {

    @Id
    @Column(nullable = false, updatable = false)
    private UUID id = UUID.randomUUID();

    @Column(nullable = false, insertable = false, updatable = false)
    private Long idx;

    private UUID deviceId;

    @Column(nullable = false, length = 100)
    private String deviceUid;

    private UUID bikeId;

    @Column(length = 200)
    private String vendorEventId;

    @Column(nullable = false, length = 128)
    private String payloadHash;

    @Column(nullable = false)
    private Instant receivedAt;

    private Instant deviceReportedAt;

    @Column(precision = 10, scale = 7)
    private BigDecimal latitude;

    @Column(precision = 10, scale = 7)
    private BigDecimal longitude;

    @Column(precision = 8, scale = 2)
    private BigDecimal speedKph;

    @Column(precision = 5, scale = 2)
    private BigDecimal batteryPercent;

    /**
     * 누적 주행거리 (km). 벤더 페이로드가 줄 때 채움; 일시적으로 빠지면 null.
     * 차량 상세의 정비 cycle_km 품목 상태 분류에 사용된다.
     */
    private Integer odometerKm;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private TelemetryIgnitionStatus ignitionStatus;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private TelemetrySource telemetrySource;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private String rawPayload;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    public static DeviceTelemetryLog create(
            UUID deviceId,
            String deviceUid,
            UUID bikeId,
            String vendorEventId,
            String payloadHash,
            Instant receivedAt,
            Instant deviceReportedAt,
            BigDecimal latitude,
            BigDecimal longitude,
            BigDecimal speedKph,
            BigDecimal batteryPercent,
            Integer odometerKm,
            TelemetryIgnitionStatus ignitionStatus,
            TelemetrySource telemetrySource,
            String rawPayload
    ) {
        DeviceTelemetryLog log = new DeviceTelemetryLog();
        log.deviceId = deviceId;
        log.deviceUid = deviceUid;
        log.bikeId = bikeId;
        log.vendorEventId = vendorEventId;
        log.payloadHash = payloadHash;
        log.receivedAt = receivedAt;
        log.deviceReportedAt = deviceReportedAt;
        log.latitude = latitude;
        log.longitude = longitude;
        log.speedKph = speedKph;
        log.batteryPercent = batteryPercent;
        log.odometerKm = odometerKm;
        log.ignitionStatus = ignitionStatus;
        log.telemetrySource = telemetrySource;
        log.rawPayload = rawPayload;
        return log;
    }

    @PrePersist
    void onCreate() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }

    public UUID getId() {
        return id;
    }

    public Long getIdx() {
        return idx;
    }

    public UUID getDeviceId() {
        return deviceId;
    }

    public String getDeviceUid() {
        return deviceUid;
    }

    public UUID getBikeId() {
        return bikeId;
    }

    public String getVendorEventId() {
        return vendorEventId;
    }

    public String getPayloadHash() {
        return payloadHash;
    }

    public Instant getReceivedAt() {
        return receivedAt;
    }

    public Instant getDeviceReportedAt() {
        return deviceReportedAt;
    }

    public BigDecimal getLatitude() {
        return latitude;
    }

    public BigDecimal getLongitude() {
        return longitude;
    }

    public BigDecimal getSpeedKph() {
        return speedKph;
    }

    public BigDecimal getBatteryPercent() {
        return batteryPercent;
    }

    public Integer getOdometerKm() {
        return odometerKm;
    }

    public TelemetryIgnitionStatus getIgnitionStatus() {
        return ignitionStatus;
    }

    public TelemetrySource getTelemetrySource() {
        return telemetrySource;
    }

    public String getRawPayload() {
        return rawPayload;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    protected DeviceTelemetryLog() {
    }
}
