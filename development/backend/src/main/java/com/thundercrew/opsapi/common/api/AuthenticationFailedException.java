package com.thundercrew.opsapi.common.api;

/**
 * Thrown when a caller fails authentication (bad credentials, invalid/expired
 * refresh token, phone+name mismatch). Mapped to HTTP 401 by
 * {@link GlobalExceptionHandler}. Domain-specific auth exceptions should extend
 * this so they all surface as 401 with the standard error body.
 */
public class AuthenticationFailedException extends RuntimeException {

    public AuthenticationFailedException(String message) {
        super(message);
    }
}
