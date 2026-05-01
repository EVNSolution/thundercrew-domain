package com.thundercrew.opsapi.auth.service;

public class AdminAuthenticationException extends RuntimeException {

    public AdminAuthenticationException() {
        super("Admin authentication failed.");
    }
}
