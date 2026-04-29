package com.thundercrew.opsapi.common.api;

public class DuplicateActiveResourceException extends RuntimeException {

    public DuplicateActiveResourceException(String resourceName, String fieldName) {
        super(resourceName + " with the same active " + fieldName + " already exists.");
    }
}
