// The Pegasus Hub's own account (`PEGASUS_HUB_USER_ID`) is never governed by
// what it pushes. Matched by user id, which no one can choose or change, so
// signing up or switching to the account's email gains nothing. Read per call
// so the operator, not a board admin, decides.
export function isHubSystemAccount(userId: string): boolean {
  const configured = process.env.PEGASUS_HUB_USER_ID?.trim();
  return Boolean(configured) && configured === userId;
}
