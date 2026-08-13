package com.thundercrew.opsapi.common.api;

import jakarta.servlet.http.HttpServletRequest;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.validation.FieldError;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/**
 * 전역 예외 → HTTP 응답 매핑.
 *
 * <p>이 advice 는 {@code @ExceptionHandler(Exception.class)} 캐치올을 가진다. 도메인별
 * advice(RiderAuthExceptionHandler 등)와 순위를 명시하지 않으면 어느 쪽이 먼저 조회되는지가
 * 스캔 순서에 달리고, 캐치올이 먼저 걸리면 구체 매핑이 조용히 무력화된다 — 실제로
 * `RiderAlreadyRegisteredException` 이 409 대신 500 으로 나갔다.
 *
 * <p>{@code @Order} 를 붙이지 않는다. 기본값이 이미 {@code LOWEST_PRECEDENCE} 이므로
 * 명시해도 달라지는 것이 없다 — 실제로 그렇게 해봤고 아무 효과가 없었다. 대신 도메인
 * advice 쪽에 {@code @Order(HIGHEST_PRECEDENCE)} 를 붙여 그쪽이 먼저 조회되게 한다.
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private final Clock clock;

    public GlobalExceptionHandler(Clock clock) {
        this.clock = clock;
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<ApiErrorResponse> handleValidation(
            MethodArgumentNotValidException exception,
            HttpServletRequest request
    ) {
        List<ApiErrorResponse.FieldViolation> violations = exception.getBindingResult()
                .getFieldErrors()
                .stream()
                .map(this::toFieldViolation)
                .toList();

        ApiErrorResponse body = new ApiErrorResponse(
                ErrorCode.VALIDATION_FAILED,
                "Request validation failed.",
                request.getRequestURI(),
                Instant.now(clock),
                violations
        );
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(body);
    }

    @ExceptionHandler(DuplicateActiveResourceException.class)
    ResponseEntity<ApiErrorResponse> handleDuplicateActiveResource(
            DuplicateActiveResourceException exception,
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

    @ExceptionHandler(InvalidStateTransitionException.class)
    ResponseEntity<ApiErrorResponse> handleInvalidStateTransition(
            InvalidStateTransitionException exception,
            HttpServletRequest request
    ) {
        ApiErrorResponse body = ApiErrorResponse.of(
                ErrorCode.INVALID_STATE_TRANSITION,
                exception.getMessage(),
                request.getRequestURI(),
                Instant.now(clock)
        );
        return ResponseEntity.status(HttpStatus.CONFLICT).body(body);
    }

    @ExceptionHandler(ResourceNotFoundException.class)
    ResponseEntity<ApiErrorResponse> handleResourceNotFound(
            ResourceNotFoundException exception,
            HttpServletRequest request
    ) {
        ApiErrorResponse body = ApiErrorResponse.of(
                ErrorCode.RESOURCE_NOT_FOUND,
                exception.getMessage(),
                request.getRequestURI(),
                Instant.now(clock)
        );
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(body);
    }

    @ExceptionHandler(ReferenceNotFoundException.class)
    ResponseEntity<ApiErrorResponse> handleReferenceNotFound(
            ReferenceNotFoundException exception,
            HttpServletRequest request
    ) {
        ApiErrorResponse body = ApiErrorResponse.of(
                ErrorCode.REFERENCE_NOT_FOUND,
                exception.getMessage(),
                request.getRequestURI(),
                Instant.now(clock)
        );
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(body);
    }

    @ExceptionHandler(ReferenceDeletedException.class)
    ResponseEntity<ApiErrorResponse> handleReferenceDeleted(
            ReferenceDeletedException exception,
            HttpServletRequest request
    ) {
        ApiErrorResponse body = ApiErrorResponse.of(
                ErrorCode.REFERENCE_DELETED,
                exception.getMessage(),
                request.getRequestURI(),
                Instant.now(clock)
        );
        return ResponseEntity.status(HttpStatus.CONFLICT).body(body);
    }

    @ExceptionHandler(PeriodOverlapException.class)
    ResponseEntity<ApiErrorResponse> handlePeriodOverlap(
            PeriodOverlapException exception,
            HttpServletRequest request
    ) {
        ApiErrorResponse body = ApiErrorResponse.of(
                ErrorCode.PERIOD_OVERLAP,
                exception.getMessage(),
                request.getRequestURI(),
                Instant.now(clock)
        );
        return ResponseEntity.status(HttpStatus.CONFLICT).body(body);
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    ResponseEntity<ApiErrorResponse> handleMessageNotReadable(
            HttpMessageNotReadableException exception,
            HttpServletRequest request
    ) {
        ApiErrorResponse body = ApiErrorResponse.of(
                ErrorCode.VALIDATION_FAILED,
                "Request body is malformed or contains an unsupported value.",
                request.getRequestURI(),
                Instant.now(clock)
        );
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(body);
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    ResponseEntity<ApiErrorResponse> handleTypeMismatch(
            MethodArgumentTypeMismatchException exception,
            HttpServletRequest request
    ) {
        ApiErrorResponse body = ApiErrorResponse.of(
                ErrorCode.VALIDATION_FAILED,
                "Request parameter or path value has an invalid type.",
                request.getRequestURI(),
                Instant.now(clock)
        );
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(body);
    }

    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    ResponseEntity<ApiErrorResponse> handleMethodNotSupported(
            HttpRequestMethodNotSupportedException exception,
            HttpServletRequest request
    ) {
        ApiErrorResponse body = ApiErrorResponse.of(
                ErrorCode.VALIDATION_FAILED,
                "HTTP method is not allowed for this resource.",
                request.getRequestURI(),
                Instant.now(clock)
        );
        return ResponseEntity.status(HttpStatus.METHOD_NOT_ALLOWED).body(body);
    }

    @ExceptionHandler(AuthenticationFailedException.class)
    ResponseEntity<ApiErrorResponse> handleAuthenticationFailed(
            AuthenticationFailedException exception,
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

    @ExceptionHandler(AccessDeniedException.class)
    ResponseEntity<ApiErrorResponse> handleAccessDenied(
            AccessDeniedException exception,
            HttpServletRequest request
    ) {
        ApiErrorResponse body = ApiErrorResponse.of(
                ErrorCode.ACCESS_DENIED,
                exception.getMessage(),
                request.getRequestURI(),
                Instant.now(clock)
        );
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(body);
    }

    /**
     * Content-Type 이 없거나 지원하지 않는 값일 때. 클라이언트 실수이므로 415 다.
     *
     * 매핑이 없으면 캐치올로 떨어져 500 INTERNAL_ERROR 가 나간다 — 서버가 고장난 것처럼
     * 보고되고, 재시도해도 같은 결과가 나온다.
     */
    @ExceptionHandler(HttpMediaTypeNotSupportedException.class)
    ResponseEntity<ApiErrorResponse> handleUnsupportedMediaType(
            HttpMediaTypeNotSupportedException exception,
            HttpServletRequest request
    ) {
        ApiErrorResponse body = ApiErrorResponse.of(
                ErrorCode.VALIDATION_FAILED,
                exception.getMessage(),
                request.getRequestURI(),
                Instant.now(clock)
        );
        return ResponseEntity.status(HttpStatus.UNSUPPORTED_MEDIA_TYPE).body(body);
    }

    @ExceptionHandler(Exception.class)
    ResponseEntity<ApiErrorResponse> handleUnexpected(Exception exception, HttpServletRequest request) {
        ApiErrorResponse body = ApiErrorResponse.of(
                ErrorCode.INTERNAL_ERROR,
                "Unexpected server error.",
                request.getRequestURI(),
                Instant.now(clock)
        );
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(body);
    }

    private ApiErrorResponse.FieldViolation toFieldViolation(FieldError error) {
        return new ApiErrorResponse.FieldViolation(error.getField(), error.getDefaultMessage());
    }
}
