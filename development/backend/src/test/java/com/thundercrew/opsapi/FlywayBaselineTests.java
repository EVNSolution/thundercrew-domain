package com.thundercrew.opsapi;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;

import com.thundercrew.opsapi.auth.seed.AdminSeedRunner;
import org.junit.jupiter.api.Test;
import org.springframework.boot.DefaultApplicationArguments;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

@SpringBootTest
@ActiveProfiles("test")
class FlywayBaselineTests extends PostgresContainerSupport {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @DynamicPropertySource
    static void postgresProperties(DynamicPropertyRegistry registry) {
        registerPostgresProperties(registry);
    }

    @Test
    void migrationCreatesAdminUsersAndContractTemplates() {
        Integer adminTableCount = jdbcTemplate.queryForObject(
                "select count(*) from information_schema.tables where table_name = 'admin_users'",
                Integer.class);
        Integer templateTableCount = jdbcTemplate.queryForObject(
                "select count(*) from information_schema.tables where table_name = 'contract_templates'",
                Integer.class);
        Integer authSessionTableCount = jdbcTemplate.queryForObject(
                "select count(*) from information_schema.tables where table_name = 'admin_auth_sessions'",
                Integer.class);

        assertThat(adminTableCount).isEqualTo(1);
        assertThat(templateTableCount).isEqualTo(1);
        assertThat(authSessionTableCount).isEqualTo(1);
    }

    @Test
    void authSessionTableStoresOnlyRefreshTokenHashesAndNoForeignKeys() {
        java.util.List<String> columns = jdbcTemplate.queryForList("""
                select column_name
                from information_schema.columns
                where table_name = 'admin_auth_sessions'
                """, String.class);
        Integer foreignKeyCount = jdbcTemplate.queryForObject("""
                select count(*)
                from information_schema.table_constraints
                where table_name = 'admin_auth_sessions'
                  and constraint_type = 'FOREIGN KEY'
                """, Integer.class);
        java.util.List<String> indexNames = jdbcTemplate.queryForList("""
                select indexname
                from pg_indexes
                where tablename = 'admin_auth_sessions'
                """, String.class);

        assertThat(columns)
                .contains("refresh_token_hash", "access_token_jti", "revoked_at", "refresh_token_expires_at")
                .doesNotContain("refresh_token");
        assertThat(foreignKeyCount).isZero();
        assertThat(indexNames).contains("ux_admin_auth_sessions_refresh_hash_active", "ux_admin_auth_sessions_access_jti_active");
    }

    @Test
    void migrationSeedsUnlimitedSystemContractTemplate() {
        Integer count = jdbcTemplate.queryForObject(
                "select count(*) from contract_templates where name = '무제한 계약' and duration_minutes is null and system_template = true and deleted_at is null",
                Integer.class);

        assertThat(count).isEqualTo(1);
    }

    /**
     * 시드 속성이 없으면 러너가 아무 것도 하지 않는다.
     *
     * 전에는 `admin_users` 전역 카운트가 0 인지로 확인했다. 그건 공유 Postgres
     * 컨테이너에서 **구조적으로 달성 불가능**하다 — 37개 테스트 클래스가 토큰을 얻으려고
     * admin 을 넣고 그중 33개만 지운다. 실행 순서에 따라 통과/실패가 갈렸다.
     *
     * 카운트를 느슨하게 바꾸면 계약이 사라지므로, 러너의 계약을 직접 본다. 이 테스트는
     * Spring 컨텍스트도 DB 도 쓰지 않아서 다른 테스트가 남긴 행에 영향받지 않는다.
     */
    @Test
    void adminSeedIsSkippedWhenSeedPropertiesAreMissing() {
        JdbcTemplate isolatedJdbc = mock(JdbcTemplate.class);
        PasswordEncoder isolatedEncoder = mock(PasswordEncoder.class);
        AdminSeedRunner runner = new AdminSeedRunner(isolatedJdbc, isolatedEncoder, "", "", "", "");

        runner.run(new DefaultApplicationArguments());

        // DB 를 아예 건드리지 않았다는 것이 "건너뛴다" 의 의미다.
        verifyNoInteractions(isolatedJdbc, isolatedEncoder);
    }
}
