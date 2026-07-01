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

    /**
     * Spring startup 시점 admin 계정 보장. 이전엔 매 startup 마다 env 값으로
     * password / display_name / email 을 모두 덮어써서 운영자가 UI 에서 바꾼
     * 비밀번호도 다음 배포 때 초기화되는 부작용이 있었다. 이제는 idempotent —
     * 같은 loginId 의 admin 이 이미 존재하면 아무 것도 하지 않고 return,
     * 부재 시에만 env 값으로 새 row 를 만든다.
     *
     * 운영자가 비밀번호를 바꾸려면 UI 의 "비밀번호 변경" 흐름(`PATCH
     * /api/v1/auth/me/password`)을 사용. env 의 password 값은 빈 DB 첫 부팅
     * 시점의 seed 로만 의미가 있다.
     */
    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (!StringUtils.hasText(loginId) || !StringUtils.hasText(password) || !StringUtils.hasText(displayName)) {
            return;
        }

        Integer existing = jdbcTemplate.queryForObject(
                "select count(*) from admin_users where login_id = ? and deleted_at is null",
                Integer.class,
                loginId
        );

        if (existing != null && existing > 0) {
            return;
        }

        String passwordHash = passwordEncoder.encode(password);
        jdbcTemplate.update("""
                insert into admin_users (
                    id, login_id, email, password_hash, display_name, enabled, created_at, updated_at
                ) values (?, ?, nullif(?, ''), ?, ?, true, now(), now())
                """, UUID.randomUUID(), loginId, email, passwordHash, displayName);
    }
}
