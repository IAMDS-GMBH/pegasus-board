// Product name in emails. The fork ships as WWK Board; APP_NAME=Kaneo restores
// the upstream name together with the kaneo.app footer links and the mark.
export function appName(): string {
  return process.env.APP_NAME?.trim() || "WWK Board";
}

export function isKaneo(): boolean {
  return appName() === "Kaneo";
}

// Template copy keeps upstream's literal "Kaneo", so syncs stay conflict-free;
// it is swapped for the configured name when the email renders.
export function withAppName<T>(copy: T): T {
  return replaceName(copy) as T;
}

function replaceName(value: unknown): unknown {
  if (typeof value === "string") {
    return value.replace(/(?<![A-Za-z])Kaneo/g, appName());
  }
  if (typeof value === "function") {
    return (...args: unknown[]) => replaceName(value(...args));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, replaceName(entry)]),
    );
  }
  return value;
}
