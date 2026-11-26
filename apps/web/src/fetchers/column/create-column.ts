import { client } from "@kaneo/libs";

import { HttpError } from "@/lib/http-error";

export type CreateColumnData = {
  name: string;
  icon?: string;
  color?: string;
  isFinal?: boolean;
  phase?: string | null;
  isLocked?: boolean;
  isRestricted?: boolean;
};

async function createColumn(projectId: string, data: CreateColumnData) {
  const response = await client.column[":projectId"].$post({
    param: { projectId },
    json: data,
  });

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}

export default createColumn;
