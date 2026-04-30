package com.thundercrew.opsapi.telemetry.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "telemetry_ingestion_error_logs")
public class TelemetryIngestionErrorLog {

    @Id
    @Column(nullable = false, updatable = false)
    private UUID id = UUID.randomUUID();

    @Column(nullable = false, insertable = false, updatable = false)
    private Long idx;

    private UUID telemetryLogId;

    @Column(length = 100)
    private String deviceUid;

    private UUID bikeId;

    private Instant receivedAt;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 50)
    private TelemetryIngestionStage ingestionStage;

    @Column(nullable = false)
    private boolean retryable = true;

    private Instant resolvedAt;

    @Column(nullable = false, length = 100)
    private String errorCode;

    private String errorMessage;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private String contextSummary;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    public static TelemetryIngestionErrorLog create(
            UUID telemetryLogId,
            String deviceUid,
            UUID bikeId,
            Instant receivedAt,
            TelemetryIngestionStage ingestionStage,
            String errorCode,
            String errorMessage,
            String contextSummary
    ) {
        TelemetryIngestionErrorLog log = new TelemetryIngestionErrorLog();
        log.telemetryLogId = telemetryLogId;
        log.deviceUid = deviceUid;
        log.bikeId = bikeId;
        log.receivedAt = receivedAt;
        log.ingestionStage = ingestionStage;
        log.errorCode = errorCode;
        log.errorMessage = errorMessage;
        log.contextSummary = contextSummary;
        return log;
    }

    @PrePersist
    void onCreate() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }

    protected TelemetryIngestionErrorLog() {
    }
}
