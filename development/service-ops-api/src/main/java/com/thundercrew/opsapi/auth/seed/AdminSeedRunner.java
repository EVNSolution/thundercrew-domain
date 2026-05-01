package com.thundercrew.opsapi.auth.seed;

import java.util.UUID;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Component
public class AdminSeedRunner implements ApplicationRunner {

    private final JdbcTemplate jdbcTemplate;
    private final PasswordEncoder passwordEncoder;
    private final String loginId;
    private final String password;
    private final String displayName;
    private final String email;

    public AdminSeedRunner(
            JdbcTemplate jdbcTemplate,
            PasswordEncoder passwordEncoder,
            @Value("${thundercrew.admin.seed.login-id:}") String loginId,
            @Value("${thundercrew.admin.seed.password:}") String password,
            @Value("${thundercrew.admin.seed.display-name:}") String displayName,
            @Value("${thundercrew.admin.seed.email:}") String email
    ) {
        this.jdbcTemplate = jdbcTemplate;
        this.passwordEncoder = passwordEncoder;
        this.loginId = loginId;
        this.password = password;
        this.displayName = displayName;
        this.email = email;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (!StringUtils.hasText(loginId) || !StringUtils.hasText(password) || !StringUtils.hasText(displayName)) {
            return;
        }

        String passwordHash = passwordEncoder.encode(password);
        Integer existing = jdbcTemplate.queryForObject(
                "select count(*) from admin_users where login_id = ? and deleted_at is null",
                Integer.class,
                loginId
        );

        if (existing != null && existing > 0) {
            jdbcTemplate.update("""
                    update admin_users
                    set password_hash = ?, display_name = ?, email = nullif(?, ''), enabled = true, updated_at = now()
                    where login_id = ? and deleted_at is null
                    """, passwordHash, displayName, email, loginId);
            return;
        }

        jdbcTemplate.update("""
                insert into admin_users (
                    id, login_id, email, password_hash, display_name, enabled, created_at, updated_at
                ) values (?, ?, nullif(?, ''), ?, ?, true, now(), now())
                """, UUID.randomUUID(), loginId, email, passwordHash, displayName);
    }
}
