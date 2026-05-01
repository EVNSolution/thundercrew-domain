package com.thundercrew.opsapi;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
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

    @Test
    void adminSeedIsSkippedWhenSeedPropertiesAreMissing() {
        Integer count = jdbcTemplate.queryForObject(
                "select count(*) from admin_users where deleted_at is null",
                Integer.class);

        assertThat(count).isZero();
    }
}
