package com.thundercrew.opsapi.common.bulk;

import java.util.List;

/**
 * Response body returned by {@code POST /bulk-preview} endpoints.
 *
 * @param rows    per-row evaluation results
 * @param summary aggregate counts
 */
public record BulkPreviewResponse(List<BulkRowResult> rows, BulkSummary summary) {

    public static BulkPreviewResponse of(List<BulkRowResult> rows) {
        return new BulkPreviewResponse(rows, BulkSummary.of(rows));
    }
}
