package com.thundercrew.opsapi.riderauth.controller;

import com.thundercrew.opsapi.riderauth.dto.RiderLoginRequest;
import com.thundercrew.opsapi.riderauth.dto.RiderLoginResponse;
import com.thundercrew.opsapi.riderauth.dto.RiderRefreshRequest;
import com.thundercrew.opsapi.riderauth.dto.RiderRegisterRequest;
import com.thundercrew.opsapi.riderauth.service.RiderAuthService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/rider-auth")
public class RiderAuthController {

    private final RiderAuthService riderAuthService;

    public RiderAuthController(RiderAuthService riderAuthService) {
        this.riderAuthService = riderAuthService;
    }

    @PostMapping("/register")
    RiderLoginResponse register(@Valid @RequestBody RiderRegisterRequest request) {
        return riderAuthService.register(request);
    }

    @PostMapping("/login")
    RiderLoginResponse login(@Valid @RequestBody RiderLoginRequest request) {
        return riderAuthService.login(request);
    }

    @PostMapping("/refresh")
    RiderLoginResponse refresh(@Valid @RequestBody RiderRefreshRequest request) {
        return riderAuthService.refresh(request);
    }

    /**
     * 무상태 라이더 JWT 라 서버측에서 폐기할 세션이 없다. 클라이언트가 쿠키를
     * 지우면 로그아웃. 후속에 라이더 세션 테이블을 도입하면 여기서 revoke.
     */
    @PostMapping("/logout")
    ResponseEntity<Void> logout() {
        return ResponseEntity.noContent().build();
    }
}
