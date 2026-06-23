package com.thundercrew.opsapi.riderauth.service;

public class RiderAlreadyRegisteredException extends RuntimeException {
    public RiderAlreadyRegisteredException() {
        super("Rider account already registered.");
    }
}
