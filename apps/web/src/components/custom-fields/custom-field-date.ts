// Pegasus fork (PEGA-123): a date field may hold a time ("Termin"). It is
// stored as UTC ISO 8601 and shown and entered in German time, wherever the
// viewer's browser is. No time zone library is installed, so this uses Intl.
export const BERLIN = "Europe/Berlin";

const TIME_PATTERN = /T\d{2}:\d{2}/;

export function hasTime(value: string) {
  return TIME_PATTERN.test(value);
}

const berlinParts = new Intl.DateTimeFormat("en-CA", {
  timeZone: BERLIN,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function partsAt(instant: number) {
  const parts = Object.fromEntries(
    berlinParts
      .formatToParts(new Date(instant))
      .map((part) => [part.type, part.value]),
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
  };
}

function offsetAt(instant: number) {
  const { date, time } = partsAt(instant);
  return (
    Date.parse(`${date}T${time}:00Z`) - Math.floor(instant / 60_000) * 60_000
  );
}

export function berlinDateTimeToIso(date: string, time: string) {
  const wall = Date.parse(`${date}T${time}:00Z`);
  let instant = wall - offsetAt(wall);
  // Near a DST switch the first guess can use the other side's offset.
  instant = wall - offsetAt(instant);
  return new Date(instant).toISOString();
}

export function isoToBerlinParts(value: string) {
  if (!hasTime(value)) return { date: value.slice(0, 10), time: "" };
  return partsAt(Date.parse(value));
}
