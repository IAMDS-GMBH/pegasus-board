import updateTaskAssignee from "./update-task-assignee";

// Pegasus fork (PEGA-143): the assignee gives a card back to its unit. It is
// an ordinary unassignment with the assignee as actor, so activity, live
// updates, notifications and the `task.unassigned` webhook stay the same; the
// Pegasus Hub reads an unassignment by the assignee as "returned".
function returnTask(id: string, currentUserId: string) {
  return updateTaskAssignee({
    id,
    userId: null,
    currentUserId,
    onlyIfAssignedTo: currentUserId,
  });
}

export default returnTask;
