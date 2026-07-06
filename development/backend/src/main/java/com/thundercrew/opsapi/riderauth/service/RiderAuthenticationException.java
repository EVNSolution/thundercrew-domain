package com.thundercrew.opsapi.riderauth.service;

import com.thundercrew.opsapi.common.api.AuthenticationFailedException;

public class RiderAuthenticationException extends AuthenticationFailedException {

    public RiderAuthenticationException() {
        super("Rider authentication failed.");
    }
}
