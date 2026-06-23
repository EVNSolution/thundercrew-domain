package com.thundercrew.opsapi.common.bulk;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

/**
 * Aggregate counts across all rows in a {@link BulkPreviewResponse}.
 *
 * @param unchanged rows with no change
 * @param update    rows that will be updated
 * @param newRows   rows that will be inserted (serialized as {@code "new"} in JSON)
 * @param delete    rows that will be deleted
 * @param error     rows that failed validation or lookup
 * @param total     total row count
 */
public record BulkSummary(long unchanged, long update, @JsonProperty("new") long newRows, long delete, long error, long total) {

    public static BulkSummary of(List<BulkRowResult> rows) {
        long unchanged = rows.stream().filter(r -> r.status() == BulkRowStatus.UNCHANGED).count();
        long update    = rows.stream().filter(r -> r.status() == BulkRowStatus.UPDATE).count();
        long newRows   = rows.stream().filter(r -> r.status() == BulkRowStatus.NEW).count();
        long delete    = rows.stream().filter(r -> r.status() == BulkRowStatus.DELETE).count();
        long error     = rows.stream().filter(r -> r.status() == BulkRowStatus.ERROR).count();
        return new BulkSummary(unchanged, update, newRows, delete, error, rows.size());
    }
}
