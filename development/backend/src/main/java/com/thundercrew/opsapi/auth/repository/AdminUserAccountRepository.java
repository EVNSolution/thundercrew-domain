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
                        select id, login_id, email, password_hash, display_name
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
                        select id, login_id, email, password_hash, display_name
                        from admin_users
                        where id = ?
                          and enabled = true
                          and deleted_at is null
                        """,
                this::mapRow,
                id
        ).stream().findFirst();
    }

    /**
     * 비밀번호 변경 시 호출. 이미 BCrypt 처리된 hash 를 그대로 받는다 — 평문은
     * 서비스 레이어에서 BCryptPasswordEncoder 로 인코딩 후 넘긴다.
     */
    public int updatePasswordHash(UUID id, String passwordHash) {
        return jdbcTemplate.update("""
                update admin_users
                set password_hash = ?, updated_at = now()
                where id = ?
                  and deleted_at is null
                """, passwordHash, id);
    }

    private AdminUserAccount mapRow(ResultSet resultSet, int rowNumber) throws SQLException {
        return new AdminUserAccount(
                resultSet.getObject("id", UUID.class),
                resultSet.getString("login_id"),
                resultSet.getString("email"),
                resultSet.getString("password_hash"),
                resultSet.getString("display_name")
        );
    }
}
