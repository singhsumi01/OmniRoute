import { defineConfig } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const STORAGE_STATE = path.join(HERE, ".auth", "admin.json");

export default defineConfig({
  testDir: ".",
  timeout: 60_000,
  retries: 1,
  workers: 4,
  reporter: [
    ["list"],
    [
      "playwright-ctrf-json-reporter",
      { outputDir: "../../../homolog-report", outputFile: "ui-ctrf.json" },
    ],
  ],
  use: {
    baseURL: process.env.HOMOLOG_BASE_URL || "http://192.168.0.15:20128",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "homolog",
      testMatch: /.*\.spec\.ts/,
      dependencies: ["setup"],
      use: { storageState: STORAGE_STATE },
    },
  ],
});
