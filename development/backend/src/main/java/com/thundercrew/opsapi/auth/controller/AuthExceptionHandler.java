package com.thundercrew.opsapi.auth.controller;

import java.time.Clock;
import java.time.Instant;

import com.thundercrew.opsapi.auth.service.AdminAuthenticationException;
import com.thundercrew.opsapi.common.api.ApiErrorResponse;
import com.thundercrew.opsapi.common.api.ErrorCode;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice(assignableTypes = AuthController.class)
public class AuthExceptionHandler {

    private final Clock clock;

    public AuthExceptionHandler(Clock clock) {
        this.clock = clock;
    }

    @ExceptionHandler(AdminAuthenticationException.class)
    ResponseEntity<ApiErrorResponse> handleAdminAuthentication(
            AdminAuthenticationException exception,
            HttpServletRequest request
    ) {
        ApiErrorResponse body = ApiErrorResponse.of(
                ErrorCode.AUTHENTICATION_FAILED,
                exception.getMessage(),
                request.getRequestURI(),
                Instant.now(clock)
        );
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(body);
    }
}
