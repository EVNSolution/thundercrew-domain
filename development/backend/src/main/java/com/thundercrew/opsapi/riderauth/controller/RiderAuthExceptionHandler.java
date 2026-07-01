package com.thundercrew.opsapi.riderauth.controller;

import com.thundercrew.opsapi.common.api.ApiErrorResponse;
import com.thundercrew.opsapi.common.api.ErrorCode;
import com.thundercrew.opsapi.rider.controller.RiderSelfCommandController;
import com.thundercrew.opsapi.riderauth.service.RiderAlreadyRegisteredException;
import com.thundercrew.opsapi.riderauth.service.RiderAuthenticationException;
import jakarta.servlet.http.HttpServletRequest;
import java.time.Clock;
import java.time.Instant;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

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
