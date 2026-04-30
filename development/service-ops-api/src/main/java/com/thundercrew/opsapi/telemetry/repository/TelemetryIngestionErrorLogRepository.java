package com.thundercrew.opsapi.telemetry.repository;

import com.thundercrew.opsapi.telemetry.domain.TelemetryIngestionErrorLog;
import java.util.UUID;
import org.springframework.data.repository.Repository;

public interface TelemetryIngestionErrorLogRepository extends Repository<TelemetryIngestionErrorLog, UUID> {

    TelemetryIngestionErrorLog save(TelemetryIngestionErrorLog log);
}
