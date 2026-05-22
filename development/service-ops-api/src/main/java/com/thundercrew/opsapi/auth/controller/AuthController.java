package com.thundercrew.opsapi.auth.controller;

import com.thundercrew.opsapi.auth.dto.AdminLoginRequest;
import com.thundercrew.opsapi.auth.dto.AdminLoginResponse;
import com.thundercrew.opsapi.auth.dto.AdminPasswordChangeRequest;
import com.thundercrew.opsapi.auth.dto.AdminRefreshRequest;
import com.thundercrew.opsapi.auth.service.AdminAuthService;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private final AdminAuthService adminAuthService;

    public AuthController(AdminAuthService adminAuthService) {
        this.adminAuthService = adminAuthService;
    }

    @PostMapping("/login")
    AdminLoginResponse login(@Valid @RequestBody AdminLoginRequest request) {
        return adminAuthService.login(request);
    }

    @PostMapping("/refresh")
    AdminLoginResponse refresh(@Valid @RequestBody AdminRefreshRequest request) {
        return adminAuthService.refresh(request);
    }

    @PostMapping("/logout")
    ResponseEntity<Void> logout(@AuthenticationPrincipal Jwt jwt) {
        adminAuthService.logout(jwt.getId());
        return ResponseEntity.noContent().build();
    }

    /**
     * 로그인된 admin 본인 비밀번호 변경. JWT subject 가 대상 admin 의 UUID.
     * 현재 비밀번호 미일치 시 service 가 AdminAuthenticationException 을 던지고
     * `AuthExceptionHandler` 가 401 로 매핑.
     */
    @PatchMapping("/me/password")
    ResponseEntity<Void> changePassword(
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody AdminPasswordChangeRequest request
    ) {
        UUID adminUserId = UUID.fromString(jwt.getSubject());
        adminAuthService.changePassword(adminUserId, request);
        return ResponseEntity.noContent().build();
    }
}
