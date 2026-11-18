import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { format } from "date-fns";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { DateFieldEditor } from "./date-field-editor";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: vi.fn() },
}));

// The month grid is covered by its own tests; here only its value and picks.
vi.mock("@/components/common/date-picker/date-picker-menu", () => ({
  DatePickerMenu: ({
    value,
    onChange,
  }: {
    value: Date | null;
    onChange: (date: Date | null) => void;
  }) => (
    <div>
      <output aria-label="picked day">
        {value ? format(value, "yyyy-MM-dd") : ""}
      </output>
      <button type="button" onClick={() => onChange(new Date(2026, 10, 5))}>
        pick
      </button>
    </div>
  ),
}));

afterEach(cleanup);

function renderEditor(value: string) {
  const onSelect = vi.fn();
  render(
    <DateFieldEditor
      name="Termin"
      value={value}
      required={false}
      onSelect={onSelect}
    />,
  );
  const time = screen.getByLabelText("tasks:customFields.time");
  const enterTime = (next: string) => {
    fireEvent.change(time, { target: { value: next } });
    fireEvent.keyDown(time, { key: "Enter" });
  };
  return { onSelect, time, enterTime };
}

// Pegasus fork (PEGA-123): the appointment has a time, in German time.
describe("DateFieldEditor", () => {
  it("shows the day and time of a stored value in Berlin", () => {
    const { time } = renderEditor("2026-10-28T23:30:00.000Z");

    expect(screen.getByLabelText("picked day")).toHaveTextContent("2026-10-29");
    expect(time).toHaveValue("00:30");
  });

  it("keeps the time when another day is picked", () => {
    const { onSelect } = renderEditor("2026-10-28T12:00:00.000Z");

    fireEvent.click(screen.getByText("pick"));

    expect(onSelect).toHaveBeenCalledWith("2026-11-05T12:00:00.000Z");
  });

  it("saves a time entered for a day as UTC", () => {
    const { onSelect, enterTime } = renderEditor("2026-10-28");

    enterTime("09:30");

    expect(onSelect).toHaveBeenCalledWith("2026-10-28T08:30:00.000Z");
  });

  it("saves only the day when the time is cleared", () => {
    const { onSelect, enterTime } = renderEditor("2026-10-28T12:00:00.000Z");

    enterTime("");

    expect(onSelect).toHaveBeenCalledWith("2026-10-28");
  });

  it("uses a time entered before the day is picked", () => {
    const { onSelect, time, enterTime } = renderEditor("");

    enterTime("10:00");
    expect(onSelect).not.toHaveBeenCalled();
    expect(time).toHaveValue("10:00");
    fireEvent.click(screen.getByText("pick"));

    expect(onSelect).toHaveBeenCalledWith("2026-11-05T09:00:00.000Z");
  });

  it("saves a day without a time as a plain date", () => {
    const { onSelect } = renderEditor("");

    fireEvent.click(screen.getByText("pick"));

    expect(onSelect).toHaveBeenCalledWith("2026-11-05");
  });
});
