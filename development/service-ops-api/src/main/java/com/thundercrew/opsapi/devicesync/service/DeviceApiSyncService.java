package com.thundercrew.opsapi.devicesync.service;

import com.thundercrew.opsapi.common.api.InvalidStateTransitionException;
import com.thundercrew.opsapi.common.api.ResourceNotFoundException;
import com.thundercrew.opsapi.device.domain.Device;
import com.thundercrew.opsapi.device.repository.DeviceRepository;
import com.thundercrew.opsapi.devicesync.domain.DeviceApiSyncResultStatus;
import com.thundercrew.opsapi.devicesync.domain.DeviceApiSyncRunStatus;
import com.thundercrew.opsapi.devicesync.domain.DeviceApiSyncRequestedResultStatus;
import com.thundercrew.opsapi.devicesync.dto.DeviceApiSyncResultCreateRequest;
import com.thundercrew.opsapi.devicesync.dto.DeviceApiSyncResultResponse;
import com.thundercrew.opsapi.devicesync.dto.DeviceApiSyncRunCompleteRequest;
import com.thundercrew.opsapi.devicesync.dto.DeviceApiSyncRunCreateRequest;
import com.thundercrew.opsapi.devicesync.dto.DeviceApiSyncRunListResponse;
import com.thundercrew.opsapi.devicesync.dto.DeviceApiSyncRunResponse;
import com.thundercrew.opsapi.devicesync.repository.DeviceApiSyncCounts;
import com.thundercrew.opsapi.devicesync.repository.DeviceApiSyncRepository;
import com.thundercrew.opsapi.devicesync.repository.DeviceApiSyncResultRow;
import com.thundercrew.opsapi.devicesync.repository.DeviceApiSyncRunRow;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class DeviceApiSyncService {

    private final DeviceApiSyncRepository syncRepository;
    private final DeviceRepository deviceRepository;
    private final DeviceApiSyncSummaryRedactor redactor;
    private final Clock clock;

    public DeviceApiSyncService(
            DeviceApiSyncRepository syncRepository,
            DeviceRepository deviceRepository,
            DeviceApiSyncSummaryRedactor redactor,
            Clock clock
    ) {
        this.syncRepository = syncRepository;
        this.deviceRepository = deviceRepository;
        this.redactor = redactor;
        this.clock = clock;
    }

    @Transactional
    public DeviceApiSyncRunResponse createRun(DeviceApiSyncRunCreateRequest request) {
        DeviceApiSyncRunRow row = syncRepository.insertRun(
                UUID.randomUUID(),
                request.syncType(),
                redactedTextOrNull(request.externalTraceId()),
                null,
                Instant.now(clock),
                redactor.toRedactedJson(request.requestSummary())
        );
        return toRunResponse(row, List.of());
    }

    @Transactional
    public DeviceApiSyncResultResponse recordResult(UUID runId, DeviceApiSyncResultCreateRequest request) {
        DeviceApiSyncRunRow run = findRunOrThrow(runId);
        if (run.status() != DeviceApiSyncRunStatus.RUNNING) {
            throw new InvalidStateTransitionException("Device API sync run is already completed.");
        }
        Optional<Device> device = deviceRepository.findByDeviceUidAndDeletedAtIsNull(request.deviceUid());
        DeviceApiSyncResultStatus effectiveStatus = resolveStatus(device, request.status());
        DeviceApiSyncResultRow row = syncRepository.insertResult(
                UUID.randomUUID(),
                runId,
                request.deviceUid(),
                device.map(Device::getId).orElse(null),
                effectiveStatus,
                request.httpStatus(),
                redactedTextOrNull(request.externalEventId()),
                redactor.toRedactedJson(request.requestSummary()),
                redactor.toRedactedJson(request.responseSummary()),
                redactedTextOrNull(request.errorCode()),
                redactedTextOrNull(request.errorMessage())
        );
        return toResultResponse(row);
    }

    @Transactional
    public DeviceApiSyncRunResponse completeRun(UUID runId, DeviceApiSyncRunCompleteRequest request) {
        DeviceApiSyncRunRow run = findRunOrThrow(runId);
        if (run.status() != DeviceApiSyncRunStatus.RUNNING) {
            throw new InvalidStateTransitionException("Device API sync run is already completed.");
        }
        DeviceApiSyncCounts counts = syncRepository.countResults(runId);
        DeviceApiSyncRunStatus status = resolveRunStatus(counts);
        DeviceApiSyncRunRow completed = syncRepository.completeRun(
                runId,
                status,
                Instant.now(clock),
                counts,
                redactor.toRedactedJson(request.responseSummary()),
                redactedTextOrNull(request.errorCode()),
                redactedTextOrNull(request.errorMessage())
        );
        return toRunResponse(completed, syncRepository.findResults(runId));
    }

    @Transactional(readOnly = true)
    public DeviceApiSyncRunResponse getRun(UUID runId) {
        DeviceApiSyncRunRow run = findRunOrThrow(runId);
        return toRunResponse(run, syncRepository.findResults(runId));
    }

    @Transactional(readOnly = true)
    public DeviceApiSyncRunListResponse listRuns(Pageable pageable) {
        int size = Math.max(1, pageable.getPageSize());
        long offset = pageable.getOffset();
        long total = syncRepository.countRuns();
        List<DeviceApiSyncRunResponse> items = syncRepository.findRuns(size, offset).stream()
                .map(row -> toRunResponse(row, List.of()))
                .toList();
        boolean hasNext = offset + items.size() < total;
        return new DeviceApiSyncRunListResponse(
                items,
                new DeviceApiSyncRunListResponse.Page(
                        pageable.getPageNumber(),
                        size,
                        total,
                        hasNext,
                        pageable.getPageNumber() > 0
                )
        );
    }

    private DeviceApiSyncRunRow findRunOrThrow(UUID runId) {
        return syncRepository.findRun(runId)
                .orElseThrow(() -> new ResourceNotFoundException("DeviceApiSyncRun", runId));
    }

    private DeviceApiSyncResultStatus resolveStatus(Optional<Device> device, DeviceApiSyncRequestedResultStatus requestedStatus) {
        if (device.isEmpty()) {
            return DeviceApiSyncResultStatus.DEVICE_UNKNOWN;
        }
        if (!device.get().isEnabled()) {
            return DeviceApiSyncResultStatus.DEVICE_DISABLED;
        }
        return switch (requestedStatus) {
            case SUCCESS -> DeviceApiSyncResultStatus.SUCCESS;
            case FAILED -> DeviceApiSyncResultStatus.FAILED;
            case SKIPPED -> DeviceApiSyncResultStatus.SKIPPED;
        };
    }

    private DeviceApiSyncRunStatus resolveRunStatus(DeviceApiSyncCounts counts) {
        if (counts.failureCount() == 0) {
            return DeviceApiSyncRunStatus.SUCCESS;
        }
        if (counts.successCount() == 0) {
            return DeviceApiSyncRunStatus.FAILED;
        }
        return DeviceApiSyncRunStatus.PARTIAL_FAILURE;
    }

    private DeviceApiSyncRunResponse toRunResponse(DeviceApiSyncRunRow row, List<DeviceApiSyncResultRow> resultRows) {
        return new DeviceApiSyncRunResponse(
                row.id(),
                row.idx(),
                row.syncType(),
                row.status(),
                row.externalTraceId(),
                row.startedAt(),
                row.finishedAt(),
                row.totalCount(),
                row.successCount(),
                row.failureCount(),
                redactor.toResponseNode(row.requestSummary()),
                redactor.toResponseNode(row.responseSummary()),
                row.errorCode(),
                row.errorMessage(),
                row.createdAt(),
                row.updatedAt(),
                resultRows.stream().map(this::toResultResponse).toList()
        );
    }

    private DeviceApiSyncResultResponse toResultResponse(DeviceApiSyncResultRow row) {
        return new DeviceApiSyncResultResponse(
                row.id(),
                row.idx(),
                row.runId(),
                row.deviceUid(),
                row.deviceId(),
                row.status(),
                row.httpStatus(),
                row.externalEventId(),
                redactor.toResponseNode(row.requestSummary()),
                redactor.toResponseNode(row.responseSummary()),
                row.errorCode(),
                row.errorMessage(),
                row.createdAt()
        );
    }

    private String redactedTextOrNull(String value) {
        return StringUtils.hasText(value) ? redactor.redactText(value) : null;
    }
}
