package com.thundercrew.opsapi.common.bulk;

/** Row-level outcome produced by a bulk preview or apply operation. */
public enum BulkRowStatus {
    /** Row matches the current DB state — no change will be applied. */
    UNCHANGED,
    /** Row differs from the current DB record — an update will be applied. */
    UPDATE,
    /** No matching DB record found — a new record will be created. */
    NEW,
    /** Row could not be processed due to a validation or lookup failure. */
    ERROR,
    /** Row is marked for deletion — the matching DB record will be removed. */
    DELETE
}
