import { expect } from "vite-plus/test";

export type ApiErrorBody = {
  message: string;
  code: string;
  issues?: Array<{ path: string; message: string }>;
  missingPermissions?: string[];
  // Pegasus fork (PEGA-123): names of the Hub fields a request may not change.
  fields?: string[];
};

export async function readErrorBody(response: Response) {
  expect(response.headers.get("content-type")).toContain("application/json");
  return (await response.json()) as ApiErrorBody;
}
