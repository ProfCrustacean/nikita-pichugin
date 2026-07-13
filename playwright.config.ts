import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: "/tmp/pichugin-playwright-results",
  timeout: 30_000,
  webServer: {
    command: "npm run preview -- --port 4322",
    url: "http://127.0.0.1:4322",
    reuseExistingServer: true,
    timeout: 30_000
  },
  use: {
    baseURL: "http://127.0.0.1:4322",
    trace: "retain-on-failure",
    screenshot: "only-on-failure"
  },
  projects: [
    {
      name: "desktop",
      testIgnore: /responsive\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], viewport: { width: 1600, height: 1000 } }
    },
    {
      name: "mobile",
      testMatch: /responsive\.spec\.ts/,
      use: { ...devices["Pixel 7"] }
    }
  ]
});
