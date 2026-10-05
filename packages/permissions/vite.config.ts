import { defineConfig } from "vite-plus";

export default defineConfig({
  run: {
    tasks: {
      compile: {
        command: "tsc",
        dependsOn: [
          { task: "build", from: ["dependencies", "devDependencies"] },
        ],
        cache: {
          // `auto` does not see the files tsc reads, so a changed `src/` kept
          // replaying an old `dist/` and the web app missed new permissions.
          input: [
            { auto: true },
            "src/**",
            "tsconfig.json",
            ".env*",
            { pattern: ".env*", base: "workspace" },
          ],
          output: ["dist/**"],
        },
      },
      "test:run": {
        command: "vp test run --config vitest.config.ts",
        dependsOn: [
          { task: "build", from: ["dependencies", "devDependencies"] },
        ],
        cache: false,
      },
    },
  },
});
