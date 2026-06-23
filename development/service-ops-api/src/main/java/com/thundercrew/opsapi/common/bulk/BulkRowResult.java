package com.thundercrew.opsapi.common.bulk;

import java.util.List;

/**
 * Result of evaluating a single Excel row during a bulk preview or apply.
 *
 * @param rowNumber   1-based Excel row number (for user-facing error messages)
 * @param status      evaluation outcome
 * @param key         natural key of the row (e.g. plateNumber or phoneNumber)
 * @param changes     field names that differ from the DB record (populated for UPDATE rows)
 * @param errorMessage human-readable reason for ERROR rows; null otherwise
 */
public record BulkRowResult(
        int rowNumber,
        BulkRowStatus status,
        String key,
        List<String> changes,
        String errorMessage
) {
    public static BulkRowResult unchanged(int row, String key) {
        return new BulkRowResult(row, BulkRowStatus.UNCHANGED, key, List.of(), null);
    }

    public static BulkRowResult update(int row, String key, List<String> changes) {
        return new BulkRowResult(row, BulkRowStatus.UPDATE, key, changes, null);
    }

    public static BulkRowResult newRow(int row, String key) {
        return new BulkRowResult(row, BulkRowStatus.NEW, key, List.of(), null);
    }

    public static BulkRowResult error(int row, String key, String message) {
        return new BulkRowResult(row, BulkRowStatus.ERROR, key, List.of(), message);
    }

    public static BulkRowResult delete(int row, String key) {
        return new BulkRowResult(row, BulkRowStatus.DELETE, key, List.of(), null);
    }
}
