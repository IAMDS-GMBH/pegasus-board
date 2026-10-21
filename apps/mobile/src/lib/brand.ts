// The fork ships the app as WWK Board. WWK runs its own servers, so the
// sign-in screen does not offer upstream's hosted Kaneo Cloud.
export const brand = {
  name: "WWK Board",
  offersCloud: false,
} as const;
