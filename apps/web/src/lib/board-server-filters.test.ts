import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vite-plus/test";
import {
  getBoardServerFilters,
  setBoardServerFilters,
} from "./board-server-filters";

describe("board server filters registry", () => {
  it("stores filters per client and project", () => {
    const client = new QueryClient();
    const other = new QueryClient();
    setBoardServerFilters(client, "p1", { labels: ["A"] });
    expect(getBoardServerFilters(client, "p1")).toEqual({ labels: ["A"] });
    expect(getBoardServerFilters(client, "p2")).toBeNull();
    expect(getBoardServerFilters(other, "p1")).toBeNull();
  });

  it("clears an entry with null", () => {
    const client = new QueryClient();
    setBoardServerFilters(client, "p1", { customFields: { f: ["x"] } });
    setBoardServerFilters(client, "p1", null);
    expect(getBoardServerFilters(client, "p1")).toBeNull();
  });
});
