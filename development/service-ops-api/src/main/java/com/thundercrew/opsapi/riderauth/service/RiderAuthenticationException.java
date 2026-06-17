package com.thundercrew.opsapi.riderauth.service;

public class RiderAuthenticationException extends RuntimeException {

    public RiderAuthenticationException() {
        super("Rider authentication failed.");
    }
}
