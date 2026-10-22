import { defineConfig } from "vite-plus";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Upstream template tests assert the Kaneo copy; app-name.test.ts covers
    // the fork's WWK default.
    env: { APP_NAME: "Kaneo" },
  },
});
