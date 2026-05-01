package com.thundercrew.opsapi;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
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
}
