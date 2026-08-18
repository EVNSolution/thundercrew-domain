package com.thundercrew.opsapi.settings.controller;

import com.thundercrew.opsapi.settings.service.AppSettingService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import java.util.Map;
import java.util.UUID;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 운영 설정 API (4단계 §6). GET 은 현재 유효값(코드 기본값 + DB 오버레이),
 * PUT 은 부분 갱신 — 보낸 키만 바꾼다. 테마/액센트는 브라우저 로컬이라 여기
 * 없다 — 이 API 는 서버 동작(완료 추정·시간 배차 기본값)을 바꾸는 값만 다룬다.
 */
@RestController
@RequestMapping("/api/v1/settings")
public class SettingsController {

    private final AppSettingService appSettingService;

    public SettingsController(AppSettingService appSettingService) {
        this.appSettingService = appSettingService;
    }

    @GetMapping
    Map<String, Integer> effectiveValues() {
        return appSettingService.effectiveValues();
    }

    public record SettingsUpdateRequest(@NotNull Map<String, Integer> values) {}

    @PutMapping
    Map<String, Integer> update(@Valid @RequestBody SettingsUpdateRequest request,
                                @AuthenticationPrincipal Jwt jwt) {
        return appSettingService.update(request.values(), currentAdminId(jwt));
    }

    private UUID currentAdminId(Jwt jwt) {
        if (jwt == null) return null;
        try {
            return UUID.fromString(jwt.getSubject());
        } catch (Exception e) {
            return null;
        }
    }
}
