// Pegasus fork (PEGA-80): the Pegasus Hub mails card notifications and owns
// each user's notification settings. When set, the board links there instead
// of its own settings page. Only absolute http(s) URLs count, so a typo can't
// turn into a relative or script link.
export function getNotificationSettingsUrl(): string | null {
  const value = process.env.PEGASUS_NOTIFICATION_SETTINGS_URL?.trim();
  if (!value || !URL.canParse(value)) return null;
  const { protocol } = new URL(value);
  return protocol === "https:" || protocol === "http:" ? value : null;
}
