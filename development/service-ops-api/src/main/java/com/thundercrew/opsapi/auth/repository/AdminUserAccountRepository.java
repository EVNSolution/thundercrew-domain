package com.thundercrew.opsapi.auth.repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class AdminUserAccountRepository {

    private final JdbcTemplate jdbcTemplate;

    public AdminUserAccountRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public Optional<AdminUserAccount> findEnabledActiveByLoginId(String loginId) {
        return jdbcTemplate.query("""
                        select id, login_id, email, password_hash, display_name, ncp_map_enabled
                        from admin_users
                        where login_id = ?
                          and enabled = true
                          and deleted_at is null
                        """,
                this::mapRow,
                loginId
        ).stream().findFirst();
    }

    public Optional<AdminUserAccount> findEnabledActiveById(UUID id) {
        return jdbcTemplate.query("""
                        select id, login_id, email, password_hash, display_name, ncp_map_enabled
                        from admin_users
                        where id = ?
                          and enabled = true
                          and deleted_at is null
                        """,
                this::mapRow,
                id
        ).stream().findFirst();
    }

    public int updateNcpMapEnabled(UUID id, boolean ncpMapEnabled) {
        return jdbcTemplate.update("""
                update admin_users
                set ncp_map_enabled = ?,
                    updated_at = now()
                where id = ?
                  and enabled = true
                  and deleted_at is null
                """, ncpMapEnabled, id);
    }

    private AdminUserAccount mapRow(ResultSet resultSet, int rowNumber) throws SQLException {
        return new AdminUserAccount(
                resultSet.getObject("id", UUID.class),
                resultSet.getString("login_id"),
                resultSet.getString("email"),
                resultSet.getString("password_hash"),
                resultSet.getString("display_name"),
                resultSet.getBoolean("ncp_map_enabled")
        );
    }
}
