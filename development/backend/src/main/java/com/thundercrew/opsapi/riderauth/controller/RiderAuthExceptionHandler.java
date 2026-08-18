package com.thundercrew.opsapi.riderauth.controller;

import com.thundercrew.opsapi.common.api.ApiErrorResponse;
import com.thundercrew.opsapi.common.api.ErrorCode;
import com.thundercrew.opsapi.rider.controller.RiderSelfCommandController;
import com.thundercrew.opsapi.riderauth.service.RiderAlreadyRegisteredException;
import com.thundercrew.opsapi.riderauth.service.RiderAuthenticationException;
import jakarta.servlet.http.HttpServletRequest;
import java.time.Clock;
import java.time.Instant;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/**
 * 이 도메인 advice 는 {@code GlobalExceptionHandler} 보다 **먼저** 조회돼야 한다.
 *
 * <p>Global 은 {@code @ExceptionHandler(Exception.class)} 캐치올을 가지고, {@code @Order}
 * 가 없는 advice 의 기본 우선순위는 {@code LOWEST_PRECEDENCE} 다. 둘이 동순위면 어느 쪽이
 * 먼저 조회되는지가 스캔 순서에 달리고, Global 이 먼저 걸리면 여기의 구체 매핑이 조용히
 * 무력화된다 — {@code RiderAlreadyRegisteredException} 이 409 대신 500 으로 나갔다.
 *
 * <p>Global 에 {@code @Order(LOWEST_PRECEDENCE)} 를 붙이는 것으로는 해결되지 않는다.
 * 그게 이미 기본값이라 같은 값을 명시하는 것일 뿐이다. 구체 advice 를 올려야 한다.
 */
@Order(Ordered.HIGHEST_PRECEDENCE)
@RestControllerAdvice(assignableTypes = {RiderAuthController.class, RiderCredentialAdminController.class, RiderSelfCommandController.class})
public class RiderAuthExceptionHandler {

    private final Clock clock;

    public RiderAuthExceptionHandler(Clock clock) {
        this.clock = clock;
    }

    @ExceptionHandler(RiderAuthenticationException.class)
    ResponseEntity<ApiErrorResponse> handleRiderAuthentication(
            RiderAuthenticationException exception,
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

    @ExceptionHandler(RiderAlreadyRegisteredException.class)
    ResponseEntity<ApiErrorResponse> handleAlreadyRegistered(
            RiderAlreadyRegisteredException exception,
            HttpServletRequest request
    ) {
        ApiErrorResponse body = ApiErrorResponse.of(
                ErrorCode.DUPLICATE_ACTIVE_RESOURCE,
                exception.getMessage(),
                request.getRequestURI(),
                Instant.now(clock)
        );
        return ResponseEntity.status(HttpStatus.CONFLICT).body(body);
    }
}
