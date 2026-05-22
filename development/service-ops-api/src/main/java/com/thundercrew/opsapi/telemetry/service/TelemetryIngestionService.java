package com.thundercrew.opsapi.telemetry.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.thundercrew.opsapi.device.domain.BikeDeviceInstallation;
import com.thundercrew.opsapi.device.domain.Device;
import com.thundercrew.opsapi.device.repository.BikeDeviceInstallationRepository;
import com.thundercrew.opsapi.device.repository.DeviceRepository;
import com.thundercrew.opsapi.telemetry.domain.BikeRecentState;
import com.thundercrew.opsapi.telemetry.domain.DeviceTelemetryLog;
import com.thundercrew.opsapi.telemetry.domain.TelemetryIngestionErrorLog;
import com.thundercrew.opsapi.telemetry.domain.TelemetryIngestionStage;
import com.thundercrew.opsapi.telemetry.dto.TelemetryIngestRequest;
import com.thundercrew.opsapi.telemetry.dto.TelemetryIngestResponse;
import com.thundercrew.opsapi.telemetry.repository.BikeRecentStateRepository;
import com.thundercrew.opsapi.telemetry.repository.DeviceTelemetryLogRepository;
import com.thundercrew.opsapi.telemetry.repository.TelemetryIngestionErrorLogRepository;
import com.thundercrew.opsapi.telemetry.repository.TelemetryWriteRepository;
import jakarta.persistence.EntityManager;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class TelemetryIngestionService {

    private final DeviceTelemetryLogRepository telemetryLogRepository;
    private final BikeRecentStateRepository recentStateRepository;
    private final TelemetryIngestionErrorLogRepository errorLogRepository;
    private final TelemetryWriteRepository telemetryWriteRepository;
    private final DeviceRepository deviceRepository;
    private final BikeDeviceInstallationRepository installationRepository;
    private final EntityManager entityManager;
    private final ObjectMapper objectMapper;

    public TelemetryIngestionService(
            DeviceTelemetryLogRepository telemetryLogRepository,
            BikeRecentStateRepository recentStateRepository,
            TelemetryIngestionErrorLogRepository errorLogRepository,
            TelemetryWriteRepository telemetryWriteRepository,
            DeviceRepository deviceRepository,
            BikeDeviceInstallationRepository installationRepository,
            EntityManager entityManager,
            ObjectMapper objectMapper
    ) {
        this.telemetryLogRepository = telemetryLogRepository;
        this.recentStateRepository = recentStateRepository;
        this.errorLogRepository = errorLogRepository;
        this.telemetryWriteRepository = telemetryWriteRepository;
        this.deviceRepository = deviceRepository;
        this.installationRepository = installationRepository;
        this.entityManager = entityManager;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public TelemetryIngestResponse ingest(TelemetryIngestRequest request) {
        String rawPayload = writeRawPayload(request);
        String payloadHash = payloadHash(request, rawPayload);
        Optional<Device> device = deviceRepository.findByDeviceUidAndDeletedAtIsNull(request.deviceUid());
        Optional<BikeDeviceInstallation> installation = device
                .filter(Device::isEnabled)
                .flatMap(activeDevice -> installationRepository.findActiveAtByDeviceId(activeDevice.getId(), request.receivedAt()));

        DeviceTelemetryLog log = DeviceTelemetryLog.create(
                device.map(Device::getId).orElse(null),
                request.deviceUid(),
                installation.map(BikeDeviceInstallation::getBikeId).orElse(null),
                blankToNull(request.vendorEventId()),
                payloadHash,
                request.receivedAt(),
                request.deviceReportedAt(),
                request.latitude(),
                request.longitude(),
                request.speedKph(),
                request.batteryPercent(),
                request.odometerKm(),
                request.ignitionStatus(),
                request.telemetrySource(),
                rawPayload
        );
        Optional<UUID> insertedId = telemetryWriteRepository.insertDeviceTelemetryLogIfAbsent(log);
        if (insertedId.isEmpty()) {
            DeviceTelemetryLog duplicate = findDuplicate(request, payloadHash)
                    .orElseThrow(() -> new IllegalStateException("Duplicate telemetry replay could not be reloaded."));
            return TelemetryIngestResponse.of(duplicate, true, false, false, "IDEMPOTENT_REPLAY");
        }
        DeviceTelemetryLog saved = log;

        if (device.isEmpty()) {
            recordError(saved, TelemetryIngestionStage.DEVICE_RESOLUTION, "DEVICE_NOT_FOUND",
                    "Device UID is not registered or is deleted.");
            return TelemetryIngestResponse.of(saved, false, false, false, "DEVICE_UNRESOLVED");
        }
        if (!device.get().isEnabled()) {
            recordError(saved, TelemetryIngestionStage.DEVICE_RESOLUTION, "DEVICE_DISABLED",
                    "Device is disabled and cannot update bike current state.");
            return TelemetryIngestResponse.of(saved, false, false, false, "DEVICE_DISABLED");
        }
        if (installation.isEmpty()) {
            recordError(saved, TelemetryIngestionStage.BIKE_ASSOCIATION, "BIKE_INSTALLATION_NOT_FOUND",
                    "No active bike-device installation exists for the telemetry timestamp.");
            return TelemetryIngestResponse.of(saved, false, false, false, "BIKE_UNRESOLVED");
        }

        recentStateRepository.save(BikeRecentState.from(saved));
        boolean currentStateUpdated = telemetryWriteRepository.upsertBikeCurrentStateIfNewer(saved);
        entityManager.flush();
        return TelemetryIngestResponse.of(
                saved,
                false,
                true,
                currentStateUpdated,
                currentStateUpdated ? "ACCEPTED" : "STALE_TELEMETRY_IGNORED"
        );
    }

    private Optional<DeviceTelemetryLog> findDuplicate(TelemetryIngestRequest request, String payloadHash) {
        String vendorEventId = blankToNull(request.vendorEventId());
        if (vendorEventId != null) {
            return telemetryLogRepository.findByDeviceUidAndVendorEventId(request.deviceUid(), vendorEventId);
        }
        return telemetryLogRepository.findByDeviceUidAndReceivedAtAndTelemetrySourceAndPayloadHash(
                request.deviceUid(),
                request.receivedAt(),
                request.telemetrySource(),
                payloadHash
        );
    }

    private void recordError(
            DeviceTelemetryLog log,
            TelemetryIngestionStage stage,
            String errorCode,
            String errorMessage
    ) {
        errorLogRepository.save(TelemetryIngestionErrorLog.create(
                log.getId(),
                log.getDeviceUid(),
                log.getBikeId(),
                log.getReceivedAt(),
                stage,
                errorCode,
                errorMessage,
                "{\"telemetryLogId\":\"" + log.getId() + "\"}"
        ));
        entityManager.flush();
    }

    private String writeRawPayload(TelemetryIngestRequest request) {
        if (request.rawPayload() == null || request.rawPayload().isNull()) {
            return null;
        }
        try {
            return objectMapper.writeValueAsString(request.rawPayload());
        } catch (JsonProcessingException exception) {
            throw new IllegalArgumentException("Raw telemetry payload cannot be serialized.", exception);
        }
    }

    private String payloadHash(TelemetryIngestRequest request, String rawPayload) {
        String hashInput = String.join("|",
                request.deviceUid(),
                blankToEmpty(request.vendorEventId()),
                request.receivedAt().toString(),
                request.deviceReportedAt() == null ? "" : request.deviceReportedAt().toString(),
                request.latitude() == null ? "" : request.latitude().toPlainString(),
                request.longitude() == null ? "" : request.longitude().toPlainString(),
                request.speedKph() == null ? "" : request.speedKph().toPlainString(),
                request.batteryPercent() == null ? "" : request.batteryPercent().toPlainString(),
                request.odometerKm() == null ? "" : request.odometerKm().toString(),
                request.ignitionStatus().name(),
                request.telemetrySource().name(),
                rawPayload == null ? "" : rawPayload
        );
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(hashInput.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 digest is not available.", exception);
        }
    }

    private String blankToNull(String value) {
        return StringUtils.hasText(value) ? value : null;
    }

    private String blankToEmpty(String value) {
        return StringUtils.hasText(value) ? value : "";
    }
}
