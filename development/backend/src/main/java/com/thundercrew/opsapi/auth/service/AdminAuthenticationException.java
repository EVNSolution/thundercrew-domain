package com.thundercrew.opsapi.auth.service;

import com.thundercrew.opsapi.common.api.AuthenticationFailedException;

public class AdminAuthenticationException extends AuthenticationFailedException {

    public AdminAuthenticationException() {
        super("Admin authentication failed.");
    }
}
