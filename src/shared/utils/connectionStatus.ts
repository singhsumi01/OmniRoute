/**
 * Shared helpers for filtering/classifying provider connections by their
 * active/disabled state, independent of their last test result.
 *
 * A connection can have `isActive: false` (explicitly disabled by the user)
 * while still carrying a stale `testStatus` of "active"/"success" from
 * before it was disabled — callers that only filter on `testStatus` will
 * incorrectly keep serving disabled connections.
 */

export interface ConnectionActiveFlag {
  isActive?: boolean;
  [key: string]: unknown;
}

/**
 * Filters out connections that have been explicitly disabled
 * (`isActive === false`). Connections without an `isActive` field are
 * treated as active for backward compatibility.
 */
export function filterActiveConnections<T extends ConnectionActiveFlag>(
  connections: T[] | null | undefined
): T[] {
  if (!Array.isArray(connections)) return [];
  return connections.filter((connection) => connection?.isActive !== false);
}
