package com.thundercrew.opsapi.common.api;

import java.util.UUID;

public class ReferenceNotFoundException extends RuntimeException {

    public ReferenceNotFoundException(String resourceName, UUID id) {
        super(resourceName + " reference not found: " + id);
    }
}
