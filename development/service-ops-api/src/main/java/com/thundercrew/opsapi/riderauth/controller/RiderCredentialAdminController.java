package com.thundercrew.opsapi.riderauth.controller;

import com.thundercrew.opsapi.riderauth.dto.RiderCredentialUpdateRequest;
import com.thundercrew.opsapi.riderauth.service.RiderAuthService;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 관리자가 라이더의 앱 비밀번호를 발급/재설정. ADMIN 전용
 * (/api/v1/riders/** 는 SecurityConfig 에서 hasRole("ADMIN")).
 */
@RestController
@RequestMapping("/api/v1/riders")
public class RiderCredentialAdminController {

    private final RiderAuthService riderAuthService;

    public RiderCredentialAdminController(RiderAuthService riderAuthService) {
        this.riderAuthService = riderAuthService;
    }

    @PatchMapping("/{id}/credential")
    ResponseEntity<Void> setCredential(
            @PathVariable UUID id,
            @Valid @RequestBody RiderCredentialUpdateRequest request
    ) {
        riderAuthService.setPassword(id, request.newPassword());
        return ResponseEntity.noContent().build();
    }
}
