package com.thundercrew.opsapi.dispatch.dto;

import com.thundercrew.opsapi.common.bulk.BulkRowResult;
import com.thundercrew.opsapi.common.bulk.BulkSummary;
import java.util.List;

/**
 * Response body for {@code POST /api/v1/dispatch-orders/bulk-preview}.
 *
 * <p>Mirrors {@code BulkPreviewResponse} but the rows carry the parsed payload + resolved bikeId so
 * the frontend can geocode each valid (NEW) row and submit it to the JSON apply endpoint.
 *
 * @param rows    per-row parse/validate results (with payload)
 * @param summary aggregate counts (reuses {@link BulkSummary}; only NEW/ERROR are populated)
 */
public record DispatchBulkPreviewResponse(List<DispatchBulkPreviewRow> rows, BulkSummary summary) {

    public static DispatchBulkPreviewResponse of(List<DispatchBulkPreviewRow> rows) {
        // BulkSummary aggregates over BulkRowResult; adapt each preview row's status into a
        // throwaway result purely for counting (key/changes/message are irrelevant to the counts).
        List<BulkRowResult> forSummary = rows.stream()
                .map(r -> new BulkRowResult(r.rowNumber(), r.status(), r.plateNumber(), List.of(), r.message()))
                .toList();
        return new DispatchBulkPreviewResponse(rows, BulkSummary.of(forSummary));
    }
}
