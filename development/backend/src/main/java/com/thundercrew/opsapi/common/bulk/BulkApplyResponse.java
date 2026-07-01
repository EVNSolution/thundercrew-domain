package com.thundercrew.opsapi.common.bulk;

/**
 * Response body returned by {@code POST /bulk-apply} endpoints.
 *
 * @param applied number of rows successfully persisted (created or updated)
 * @param skipped number of rows skipped due to errors or blank key values
 */
public record BulkApplyResponse(long applied, long skipped) {}
