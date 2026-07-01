package com.thundercrew.opsapi.devicesync.repository;

import com.thundercrew.opsapi.devicesync.domain.DeviceApiSyncResultStatus;
import com.thundercrew.opsapi.devicesync.domain.DeviceApiSyncRunStatus;
import com.thundercrew.opsapi.devicesync.domain.DeviceApiSyncType;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Types;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class DeviceApiSyncRepository {

    private final JdbcTemplate jdbcTemplate;

    public DeviceApiSyncRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public DeviceApiSyncRunRow insertRun(
            UUID id,
            DeviceApiSyncType syncType,
            String externalTraceId,
            UUID requestedByAdminId,
            Instant startedAt,
            String requestSummary
    ) {
        return jdbcTemplate.queryForObject("""
                insert into device_api_sync_runs (
                    id, sync_type, status, external_trace_id, requested_by_admin_id,
                    started_at, request_summary
                ) values (?, ?, ?, ?, ?, ?::timestamptz, ?::jsonb)
                returning *
                """, this::mapRun,
                id,
                syncType.name(),
                DeviceApiSyncRunStatus.RUNNING.name(),
                externalTraceId,
                requestedByAdminId,
                startedAt.toString(),
                requestSummary);
    }

    public Optional<DeviceApiSyncRunRow> findRun(UUID id) {
        List<DeviceApiSyncRunRow> rows = jdbcTemplate.query(
                "select * from device_api_sync_runs where id = ?",
                this::mapRun,
                id);
        return rows.stream().findFirst();
    }

    public List<DeviceApiSyncRunRow> findRuns(int limit, long offset) {
        return jdbcTemplate.query("""
                select *
                from device_api_sync_runs
                order by started_at desc, idx desc
                limit ? offset ?
                """, this::mapRun, limit, offset);
    }

    public long countRuns() {
        Long count = jdbcTemplate.queryForObject("select count(*) from device_api_sync_runs", Long.class);
        return count == null ? 0L : count;
    }

    public DeviceApiSyncResultRow insertResult(
            UUID id,
            UUID runId,
            String deviceUid,
            UUID deviceId,
            DeviceApiSyncResultStatus status,
            Integer httpStatus,
            String externalEventId,
            String requestSummary,
            String responseSummary,
            String errorCode,
            String errorMessage
    ) {
        List<DeviceApiSyncResultRow> rows = jdbcTemplate.query(connection -> {
            var ps = connection.prepareStatement("""
                    insert into device_api_sync_results (
                        id, run_id, device_uid, device_id, status, http_status, external_event_id,
                        request_summary, response_summary, error_code, error_message
                    ) values (?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?::jsonb, ?, ?)
                    returning *
                    """);
            ps.setObject(1, id);
            ps.setObject(2, runId);
            ps.setString(3, deviceUid);
            if (deviceId == null) {
                ps.setNull(4, Types.OTHER);
            } else {
                ps.setObject(4, deviceId);
            }
            ps.setString(5, status.name());
            if (httpStatus == null) {
                ps.setNull(6, Types.INTEGER);
            } else {
                ps.setInt(6, httpStatus);
            }
            ps.setString(7, externalEventId);
            ps.setString(8, requestSummary);
            ps.setString(9, responseSummary);
            ps.setString(10, errorCode);
            ps.setString(11, errorMessage);
            return ps;
        }, this::mapResult);
        return rows.stream().findFirst()
                .orElseThrow(() -> new IllegalStateException("Device API sync result insert returned no row."));
    }

    public List<DeviceApiSyncResultRow> findResults(UUID runId) {
        return jdbcTemplate.query("""
                select *
                from device_api_sync_results
                where run_id = ?
                order by idx asc
                """, this::mapResult, runId);
    }

    public DeviceApiSyncCounts countResults(UUID runId) {
        return jdbcTemplate.queryForObject("""
                select
                    count(*)::int as total_count,
                    count(*) filter (where status = 'SUCCESS')::int as success_count,
                    count(*) filter (where status <> 'SUCCESS')::int as failure_count
                from device_api_sync_results
                where run_id = ?
                """, (rs, rowNum) -> new DeviceApiSyncCounts(
                rs.getInt("total_count"),
                rs.getInt("success_count"),
                rs.getInt("failure_count")
        ), runId);
    }

    public DeviceApiSyncRunRow completeRun(
            UUID id,
            DeviceApiSyncRunStatus status,
            Instant finishedAt,
            DeviceApiSyncCounts counts,
            String responseSummary,
            String errorCode,
            String errorMessage
    ) {
        return jdbcTemplate.queryForObject("""
                update device_api_sync_runs
                set status = ?,
                    finished_at = ?::timestamptz,
                    total_count = ?,
                    success_count = ?,
                    failure_count = ?,
                    response_summary = ?::jsonb,
                    error_code = ?,
                    error_message = ?,
                    updated_at = now()
                where id = ?
                returning *
                """, this::mapRun,
                status.name(),
                finishedAt.toString(),
                counts.totalCount(),
                counts.successCount(),
                counts.failureCount(),
                responseSummary,
                errorCode,
                errorMessage,
                id);
    }

    private DeviceApiSyncRunRow mapRun(ResultSet rs, int rowNumber) throws SQLException {
        return new DeviceApiSyncRunRow(
                rs.getObject("id", UUID.class),
                rs.getLong("idx"),
                DeviceApiSyncType.valueOf(rs.getString("sync_type")),
                DeviceApiSyncRunStatus.valueOf(rs.getString("status")),
                rs.getString("external_trace_id"),
                rs.getObject("requested_by_admin_id", UUID.class),
                getInstant(rs, "started_at"),
                getInstant(rs, "finished_at"),
                rs.getInt("total_count"),
                rs.getInt("success_count"),
                rs.getInt("failure_count"),
                rs.getString("request_summary"),
                rs.getString("response_summary"),
                rs.getString("error_code"),
                rs.getString("error_message"),
                getInstant(rs, "created_at"),
                getInstant(rs, "updated_at")
        );
    }

    private DeviceApiSyncResultRow mapResult(ResultSet rs, int rowNumber) throws SQLException {
        return new DeviceApiSyncResultRow(
                rs.getObject("id", UUID.class),
                rs.getLong("idx"),
                rs.getObject("run_id", UUID.class),
                rs.getString("device_uid"),
                rs.getObject("device_id", UUID.class),
                DeviceApiSyncResultStatus.valueOf(rs.getString("status")),
                (Integer) rs.getObject("http_status"),
                rs.getString("external_event_id"),
                rs.getString("request_summary"),
                rs.getString("response_summary"),
                rs.getString("error_code"),
                rs.getString("error_message"),
                getInstant(rs, "created_at")
        );
    }

    private Instant getInstant(ResultSet rs, String columnLabel) throws SQLException {
        Timestamp timestamp = rs.getTimestamp(columnLabel);
        return timestamp == null ? null : timestamp.toInstant();
    }
}
