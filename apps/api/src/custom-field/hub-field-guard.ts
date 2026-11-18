import { ApiError } from "../errors/api-error";
import { isHubSystemAccount } from "../task-scope/is-hub-system-account";
import type { HubFieldProperties } from "./hub-field-properties";

// Pegasus fork (PEGA-123): the Pegasus Hub keeps each lead and reads card
// changes back by field name. Only its system account (PEGASUS_HUB_USER_ID)
// may change the fields it owns, not even owners or instance admins.

function isHub(userId: string | undefined) {
  return userId !== undefined && isHubSystemAccount(userId);
}

export function assertMayChangeDefinition(
  userId: string | undefined,
  field: { name: string; hubDefined: boolean },
  input: HubFieldProperties = {},
) {
  const touchesHub =
    field.hubDefined || input.hubDefined === true || input.hubManaged === true;
  if (!touchesHub || isHub(userId)) return;

  throw new ApiError(403, {
    code: "HUB_DEFINED_FIELD",
    message: "Only the Pegasus Hub may change this custom field",
    fields: [field.name],
  });
}

export function assertMaySetValues(
  userId: string | undefined,
  fields: Array<{ name: string; hubManaged: boolean }>,
) {
  const locked = fields
    .filter((field) => field.hubManaged)
    .map((field) => field.name);
  if (locked.length === 0 || isHub(userId)) return;

  throw new ApiError(403, {
    code: "HUB_MANAGED_FIELD",
    message: "Only the Pegasus Hub may set the value of these custom fields",
    fields: locked,
  });
}
