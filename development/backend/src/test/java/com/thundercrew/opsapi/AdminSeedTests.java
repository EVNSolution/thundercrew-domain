package com.thundercrew.opsapi;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

@SpringBootTest(properties = {
        "thundercrew.admin.seed.login-id=ops-admin",
        "thundercrew.admin.seed.password=temporary-test-password",
        "thundercrew.admin.seed.display-name=Ops Admin"
})
@ActiveProfiles("test")
/**
 * 이 클래스는 시드 속성을 켜서 admin_users 행을 만든다. Postgres 컨테이너는
 * {@link PostgresContainerSupport} 를 통해 **모든 테스트 클래스가 공유**하므로 그 행이
 * 뒤 클래스로 새어 나간다. 실제로 FlywayBaselineTests 의
 * `adminSeedIsSkippedWhenSeedPropertiesAreMissing` 이 admin_users 0개를 기대하는데
 * 실행 순서에 따라 1개를 보고 실패했다.
 *
 * 그래서 이 클래스가 만든 것을 스스로 치운다. 다른 테스트의 단정을 느슨하게 바꾸는
 * 쪽으로 풀면 "시드가 안 돌아야 한다" 는 계약이 사라진다.
 */
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class AdminSeedTests extends PostgresContainerSupport {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @DynamicPropertySource
    static void postgresProperties(DynamicPropertyRegistry registry) {
        registerPostgresProperties(registry);
    }

    @Test
    void adminSeedCreatesBcryptHashedAdminOnlyWhenEnvPropertiesArePresent() {
        String passwordHash = jdbcTemplate.queryForObject(
                "select password_hash from admin_users where login_id = 'ops-admin' and deleted_at is null",
                String.class);

        assertThat(passwordHash).isNotEqualTo("temporary-test-password");
        assertThat(new BCryptPasswordEncoder().matches("temporary-test-password", passwordHash)).isTrue();
    }

    @AfterAll
    void removeSeededAdmin() {
        jdbcTemplate.update("delete from admin_users where login_id = 'ops-admin'");
    }
}
