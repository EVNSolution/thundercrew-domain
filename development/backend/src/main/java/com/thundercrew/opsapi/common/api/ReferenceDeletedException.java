package com.thundercrew.opsapi.common.api;

import java.util.UUID;

public class ReferenceDeletedException extends RuntimeException {

    public ReferenceDeletedException(String resourceName, UUID id) {
        super(resourceName + " reference is deleted: " + id);
    }
}
