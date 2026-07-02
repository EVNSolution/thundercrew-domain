/**
 * Safely read the OTOPLUG ACC (ignition) signal from a telemetry record.
 *
 * accStatus semantics: 0 = ignition OFF, non-zero = ignition ON.
 *
 * Guards against the `Number(null) === 0` trap: a missing or null field means
 * "not reported" and must NOT be coerced to 0 (which would look like OFF).
 * Returns undefined for absent / non-numeric values so the backend falls back
 * to carrying forward the previous ignition state.
 *
 * Numeric strings are coerced via Number() on purpose, so a vendor sending
 * "0"/"1" instead of 0/1 is still read correctly rather than dropped.
 */
export function readAccStatus(rec: Record<string, unknown>): number | undefined {
  const value = rec.accStatus;
  if (value === null || value === undefined) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}
