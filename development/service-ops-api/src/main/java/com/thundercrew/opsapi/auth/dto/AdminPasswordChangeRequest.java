package com.thundercrew.opsapi.auth.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 관리자 비밀번호 변경 요청. UI 의 "비밀번호 변경" 다이얼로그가 호출하는
 * `PATCH /api/v1/auth/me/password` 의 body. JWT 의 subject 가 대상 admin 을
 * 식별하므로 body 에는 현재 비밀번호 + 새 비밀번호만 담는다.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record AdminPasswordChangeRequest(
        @NotBlank String currentPassword,
        @NotBlank @Size(min = 8, max = 100) String newPassword
) {
}
