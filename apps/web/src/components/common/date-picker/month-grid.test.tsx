import deDE from "@i18n/de-DE.json";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { MonthGrid } from "./month-grid";

function translate(key: string) {
  const [namespace, path] = key.split(":");
  const value = path
    .split(".")
    .reduce<unknown>(
      (node, part) => (node as Record<string, unknown> | undefined)?.[part],
      (deDE as Record<string, unknown>)[namespace],
    );
  return typeof value === "string" ? value : key;
}

vi.mock("@/lib/i18n", () => ({
  i18n: { resolvedLanguage: "de-DE", language: "de-DE", t: translate },
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: translate }),
}));

afterEach(cleanup);

// Pegasus fork (PEGA-90): the date picker follows the UI language, e.g. for
// date defaults in the field management.
describe("MonthGrid", () => {
  it("names months, weekdays and days in the user's language", () => {
    render(<MonthGrid value={new Date(2030, 2, 14)} onSelect={vi.fn()} />);

    expect(screen.getByText("März 2030")).toBeInTheDocument();
    expect(screen.getByLabelText("Montag")).toHaveTextContent("Mo");
    expect(
      screen.getByRole("navigation", { name: "Monatsnavigation" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Donnerstag, 14. März 2030" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Vorheriger Monat" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Nächster Monat" }),
    ).toBeInTheDocument();
  });
});
