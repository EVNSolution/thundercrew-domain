package com.thundercrew.opsapi.auth.repository;

import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Types;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class AdminAuthSessionRepository {

    private final JdbcTemplate jdbcTemplate;

    public AdminAuthSessionRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public void save(AdminAuthSession session) {
        jdbcTemplate.update(connection -> {
            PreparedStatement ps = connection.prepareStatement("""
                    insert into admin_auth_sessions (
                        id, admin_user_id, access_token_jti, access_token_expires_at,
                        refresh_token_hash, refresh_token_expires_at, issued_at, last_used_at,
                        revoked_at, revoked_reason, replaced_by_session_id, created_at, updated_at
                    ) values (
                        ?, ?, ?, ?::timestamptz,
                        ?, ?::timestamptz, ?::timestamptz, ?::timestamptz,
                        ?::timestamptz, ?, ?, now(), now()
                    )
                    """);
            setUuid(ps, 1, session.id());
            setUuid(ps, 2, session.adminUserId());
            ps.setString(3, session.accessTokenJti());
            setInstantAsIsoString(ps, 4, session.accessTokenExpiresAt());
            ps.setString(5, session.refreshTokenHash());
            setInstantAsIsoString(ps, 6, session.refreshTokenExpiresAt());
            setInstantAsIsoString(ps, 7, session.issuedAt());
            setInstantAsIsoString(ps, 8, session.lastUsedAt());
            setInstantAsIsoString(ps, 9, session.revokedAt());
            setNullableString(ps, 10, session.revokedReason());
            setUuid(ps, 11, session.replacedBySessionId());
            return ps;
        });
    }

    public Optional<AdminAuthSession> findActiveByRefreshTokenHash(String refreshTokenHash, Instant now) {
        return jdbcTemplate.query(connection -> {
            PreparedStatement ps = connection.prepareStatement("""
                    select id, admin_user_id, access_token_jti, access_token_expires_at,
                           refresh_token_hash, refresh_token_expires_at, issued_at, last_used_at,
                           revoked_at, revoked_reason, replaced_by_session_id
                    from admin_auth_sessions
                    where refresh_token_hash = ?
                      and revoked_at is null
                      and refresh_token_expires_at > ?::timestamptz
                    for update
                    """);
            ps.setString(1, refreshTokenHash);
            setInstantAsIsoString(ps, 2, now);
            return ps;
        }, this::mapRow).stream().findFirst();
    }

    public boolean existsActiveAccessToken(UUID sessionId, String accessTokenJti, UUID adminUserId, Instant now) {
        Boolean result = jdbcTemplate.queryForObject("""
                select exists (
                    select 1
                    from admin_auth_sessions
                    where id = ?
                      and admin_user_id = ?
                      and access_token_jti = ?
                      and revoked_at is null
                      and access_token_expires_at > ?::timestamptz
                )
                """, Boolean.class, sessionId, adminUserId, accessTokenJti, now.toString());
        return Boolean.TRUE.equals(result);
    }

    public void markLastUsed(UUID id, Instant lastUsedAt) {
        jdbcTemplate.update(connection -> {
            PreparedStatement ps = connection.prepareStatement("""
                    update admin_auth_sessions
                    set last_used_at = ?::timestamptz,
                        updated_at = now()
                    where id = ?
                    """);
            setInstantAsIsoString(ps, 1, lastUsedAt);
            setUuid(ps, 2, id);
            return ps;
        });
    }

    public void revoke(UUID id, Instant revokedAt, String revokedReason, UUID replacedBySessionId) {
        jdbcTemplate.update(connection -> {
            PreparedStatement ps = connection.prepareStatement("""
                    update admin_auth_sessions
                    set revoked_at = coalesce(revoked_at, ?::timestamptz),
                        revoked_reason = coalesce(revoked_reason, ?),
                        replaced_by_session_id = coalesce(replaced_by_session_id, ?),
                        updated_at = now()
                    where id = ?
                    """);
            setInstantAsIsoString(ps, 1, revokedAt);
            setNullableString(ps, 2, revokedReason);
            setUuid(ps, 3, replacedBySessionId);
            setUuid(ps, 4, id);
            return ps;
        });
    }

    public void revokeByAccessTokenJti(String accessTokenJti, Instant revokedAt, String revokedReason) {
        jdbcTemplate.update(connection -> {
            PreparedStatement ps = connection.prepareStatement("""
                    update admin_auth_sessions
                    set revoked_at = coalesce(revoked_at, ?::timestamptz),
                        revoked_reason = coalesce(revoked_reason, ?),
                        updated_at = now()
                    where access_token_jti = ?
                      and revoked_at is null
                    """);
            setInstantAsIsoString(ps, 1, revokedAt);
            setNullableString(ps, 2, revokedReason);
            ps.setString(3, accessTokenJti);
            return ps;
        });
    }

    private AdminAuthSession mapRow(ResultSet resultSet, int rowNumber) throws SQLException {
        return new AdminAuthSession(
                resultSet.getObject("id", UUID.class),
                resultSet.getObject("admin_user_id", UUID.class),
                resultSet.getString("access_token_jti"),
                getInstant(resultSet, "access_token_expires_at"),
                resultSet.getString("refresh_token_hash"),
                getInstant(resultSet, "refresh_token_expires_at"),
                getInstant(resultSet, "issued_at"),
                getInstant(resultSet, "last_used_at"),
                getInstant(resultSet, "revoked_at"),
                resultSet.getString("revoked_reason"),
                resultSet.getObject("replaced_by_session_id", UUID.class)
        );
    }

    private Instant getInstant(ResultSet resultSet, String columnName) throws SQLException {
        java.sql.Timestamp timestamp = resultSet.getTimestamp(columnName);
        return timestamp == null ? null : timestamp.toInstant();
    }

    private void setUuid(PreparedStatement ps, int index, UUID value) throws SQLException {
        if (value == null) {
            ps.setNull(index, Types.OTHER);
            return;
        }
        ps.setObject(index, value);
    }

    private void setInstantAsIsoString(PreparedStatement ps, int index, Instant value) throws SQLException {
        if (value == null) {
            ps.setNull(index, Types.TIMESTAMP_WITH_TIMEZONE);
            return;
        }
        ps.setString(index, value.toString());
    }

    private void setNullableString(PreparedStatement ps, int index, String value) throws SQLException {
        if (value == null) {
            ps.setNull(index, Types.VARCHAR);
            return;
        }
        ps.setString(index, value);
    }
}
