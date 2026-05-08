package com.thundercrew.opsapi.auth.dto;

import java.util.UUID;

/**
 * Per-admin runtime preference snapshot. Currently a single field — the NCP
 * Maps SDK toggle (Slice C-1) — but shaped as a record so future preferences
 * can land here without breaking client code.
 */
public record AdminPreferencesResponse(
        UUID adminId,
        boolean ncpMapEnabled
) {
}
