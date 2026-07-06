/**
 * Returns the offered-call ids that are present now but weren't in the
 * previously-seen set — i.e. calls that just appeared and should trigger a
 * "new call" alert. A call that disappeared and reappears counts as new again.
 */
export function detectNewOfferedCallIds(
  seen: ReadonlySet<string>,
  currentIds: readonly string[],
): string[] {
  return currentIds.filter((id) => !seen.has(id))
}
