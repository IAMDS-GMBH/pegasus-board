import { client } from "@kaneo/libs";

import { HttpError } from "@/lib/http-error";

export type UpdateColumnData = {
  name?: string;
  icon?: string | null;
  color?: string | null;
  isFinal?: boolean;
  phase?: string | null;
  isLocked?: boolean;
  isRestricted?: boolean;
};

async function updateColumn(id: string, data: UpdateColumnData) {
  const response = await client.column[":id"].$put({
    param: { id },
    json: data,
  });

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}

export default updateColumn;
