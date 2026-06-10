package com.thundercrew.opsapi.common.bulk;

import java.util.List;

/**
 * Aggregate counts across all rows in a {@link BulkPreviewResponse}.
 *
 * @param unchanged rows with no change
 * @param update    rows that will be updated
 * @param newRows   rows that will be inserted
 * @param error     rows that failed validation or lookup
 * @param total     total row count
 */
public record BulkSummary(long unchanged, long update, long newRows, long error, long total) {

    public static BulkSummary of(List<BulkRowResult> rows) {
        long unchanged = rows.stream().filter(r -> r.status() == BulkRowStatus.UNCHANGED).count();
        long update    = rows.stream().filter(r -> r.status() == BulkRowStatus.UPDATE).count();
        long newRows   = rows.stream().filter(r -> r.status() == BulkRowStatus.NEW).count();
        long error     = rows.stream().filter(r -> r.status() == BulkRowStatus.ERROR).count();
        return new BulkSummary(unchanged, update, newRows, error, rows.size());
    }
}
