import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

async function returnTask(taskId: string) {
  const response = await client.task.return[":id"].$put({
    param: { id: taskId },
  });

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}

export default returnTask;
