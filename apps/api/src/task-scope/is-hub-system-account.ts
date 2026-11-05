// The Pegasus Hub's own account (`PEGASUS_HUB_USER_EMAIL`) is never governed
// by what it pushes. Read per call so the operator, not a board admin, decides.
export function isHubSystemAccount(email: string): boolean {
  const configured = process.env.PEGASUS_HUB_USER_EMAIL?.trim().toLowerCase();
  return Boolean(configured) && configured === email.trim().toLowerCase();
}
