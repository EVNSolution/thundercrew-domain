package com.thundercrew.opsapi.telemetry.repository;

import com.thundercrew.opsapi.telemetry.domain.DeviceTelemetryLog;
import com.thundercrew.opsapi.telemetry.domain.TelemetrySource;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.repository.Repository;

public interface DeviceTelemetryLogRepository extends Repository<DeviceTelemetryLog, UUID> {

    Optional<DeviceTelemetryLog> findByDeviceUidAndVendorEventId(String deviceUid, String vendorEventId);

    Optional<DeviceTelemetryLog> findByDeviceUidAndReceivedAtAndTelemetrySourceAndPayloadHash(
            String deviceUid,
            Instant receivedAt,
            TelemetrySource telemetrySource,
            String payloadHash
    );

    DeviceTelemetryLog save(DeviceTelemetryLog log);
}
