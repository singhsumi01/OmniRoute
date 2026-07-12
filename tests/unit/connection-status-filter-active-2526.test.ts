import { test } from "node:test";
import assert from "node:assert/strict";

import { filterActiveConnections } from "@/shared/utils/connectionStatus";

// Ported from decolua/9router#2526 — the combos builder listed provider
// connections the user had explicitly disabled, because the page only
// filtered on the connection's last `testStatus` and ignored `isActive`.
// A disabled connection can still carry a stale "active"/"success"
// testStatus from before it was disabled.

test("filterActiveConnections excludes explicitly disabled connections", () => {
  const active = { id: "active", isActive: true };
  const legacyActive = { id: "legacy" }; // no isActive field -> treated as active
  const disabled = { id: "disabled", isActive: false };

  assert.deepEqual(filterActiveConnections([active, disabled, legacyActive]), [
    active,
    legacyActive,
  ]);
});

test("filterActiveConnections returns an empty list for invalid input", () => {
  assert.deepEqual(filterActiveConnections(undefined), []);
  assert.deepEqual(filterActiveConnections(null), []);
});

test("combos page fetchData filter mirrors filterActiveConnections + testStatus gate", () => {
  // Regression for the exact bug: a disabled connection with a stale
  // "active" testStatus must NOT survive the combined filter used in
  // src/app/(dashboard)/dashboard/combos/page.tsx fetchData().
  const connections = [
    { id: "healthy", isActive: true, testStatus: "active" },
    { id: "disabled-but-stale-status", isActive: false, testStatus: "active" },
    { id: "disabled-success-status", isActive: false, testStatus: "success" },
    { id: "enabled-not-tested", isActive: true, testStatus: "untested" },
  ];

  const result = filterActiveConnections(connections).filter(
    (c) => c.testStatus === "active" || c.testStatus === "success"
  );

  assert.deepEqual(
    result.map((c) => c.id),
    ["healthy"]
  );
});
