// Pegasus fork (PEGA-89): a custom field filter over 1,000 cards must show
// its result in under two seconds and combine with a label filter. The cards
// are numbered 0…999; card i has Paket P((i % 3) + 1) and, when i is even,
// the label "Kampagne A".
import { randomUUID } from "node:crypto";
import {
  type APIRequestContext,
  expect,
  type Page,
  test,
} from "@playwright/test";

const CARD_COUNT = 1000;
const BUDGET_MS = 2000;
const CONCURRENCY = 10;

async function post(request: APIRequestContext, path: string, data: object) {
  const baseURL = test.info().project.use.baseURL;
  if (!baseURL) throw new Error("Browser tests require a baseURL");
  const response = await request.post(`/api/${path}`, {
    data,
    headers: { Origin: new URL(baseURL).origin },
  });
  await expect(response).toBeOK();
  return response.json();
}

async function createWorkspace(page: Page) {
  const suffix = randomUUID();
  await post(page.request, "auth/sign-up/email", {
    name: "Filter Tester",
    email: `filter-${suffix}@example.com`,
    password: `Browser-test-${suffix}`,
  });
  const workspace = await post(page.request, "auth/organization/create", {
    name: "Filter test workspace",
    slug: `filter-${suffix}`,
  });
  await post(page.request, "auth/organization/set-active", {
    organizationId: workspace.id,
  });
  await page.goto(`/dashboard/workspace/${workspace.id}`);
  return workspace.id as string;
}

async function createProject(page: Page) {
  await page.getByRole("link", { name: "All projects", exact: true }).click();
  await expect(page).toHaveURL(/\/projects$/);
  await page
    .getByRole("button", { name: "Create project", exact: true })
    .first()
    .click();
  await page
    .getByPlaceholder("Project name", { exact: true })
    .fill("Bewerber-Pool");
  await page
    .getByRole("button", { name: "Create Project", exact: true })
    .click();
  await expect(page).toHaveURL(/\/project\/[^/]+\/board$/);
  const projectId = /\/project\/([^/]+)\/board$/.exec(page.url())?.[1];
  if (!projectId) throw new Error("Project id missing from the board URL");
  return { boardUrl: page.url(), projectId };
}

async function inBatches<T>(items: T[], run: (item: T) => Promise<void>) {
  for (let start = 0; start < items.length; start += CONCURRENCY) {
    await Promise.all(items.slice(start, start + CONCURRENCY).map(run));
  }
}

async function seedCards(
  request: APIRequestContext,
  workspaceId: string,
  projectId: string,
) {
  const field = await post(request, "custom-field", {
    projectId,
    name: "Paket",
    type: "dropdown",
    options: ["P1", "P2", "P3"],
  });
  const columns = ["to-do", "in-progress", "in-review", "done"];
  const indexes = Array.from({ length: CARD_COUNT }, (_, index) => index);
  const taskIds = new Map<number, string>();
  await inBatches(indexes, async (index) => {
    const task = await post(request, `task/${projectId}`, {
      title: `Karte ${index}`,
      description: "",
      priority: "medium",
      status: columns[index % columns.length],
      customFields: [{ fieldId: field.id, value: `P${(index % 3) + 1}` }],
    });
    taskIds.set(index, task.id);
  });
  await inBatches(
    indexes.filter((index) => index % 2 === 0),
    async (index) => {
      await post(request, "label", {
        name: "Kampagne A",
        color: "#009036",
        workspaceId,
        taskId: taskIds.get(index),
      });
    },
  );
}

/** The toolbar count; option rows in the (portaled) filter menu repeat it. */
function shownCount(page: Page, text: string) {
  return page.locator("#root").getByText(text, { exact: true });
}

async function closeFilterMenu(page: Page) {
  // The nested value panel and the root panel each take one Escape.
  const rootInput = page.getByPlaceholder("Add filter…", { exact: true });
  for (let attempt = 0; attempt < 3 && (await rootInput.isVisible()); attempt++)
    await page.keyboard.press("Escape");
  await expect(rootInput).toBeHidden();
}

async function pickFilter(page: Page, subject: string, option: RegExp) {
  await closeFilterMenu(page);
  await page.getByRole("button", { name: "Filter", exact: true }).click();
  // The menu re-renders its rows while counts update, so a pointer click can
  // hit a detached row; dispatching the click on the current row is stable.
  const subjectOption = page.getByRole("option", { name: subject }).first();
  await expect(subjectOption).toBeVisible();
  await subjectOption.dispatchEvent("click");
  const valueOption = page.getByRole("option", { name: option }).first();
  await expect(valueOption).toBeVisible();
  const started = Date.now();
  await valueOption.dispatchEvent("click");
  return started;
}

test("filters 1,000 cards by a custom field in under two seconds", async ({
  page,
}) => {
  test.setTimeout(15 * 60_000);
  const workspaceId = await createWorkspace(page);
  const { boardUrl, projectId } = await createProject(page);
  await seedCards(page.request, workspaceId, projectId);

  await page.goto(boardUrl);
  await expect(shownCount(page, `${CARD_COUNT} tasks`)).toBeVisible({
    timeout: 60_000,
  });

  // Paket = P2 → cards 1, 4, 7, … (333 cards); the API gets the filter.
  const filtered = page.waitForRequest(
    (request) =>
      request.url().includes(`/api/task/tasks/${projectId}`) &&
      request.url().includes("customFields="),
  );
  const started = await pickFilter(page, "Paket", /^P2\b/);
  await expect(shownCount(page, "333 tasks")).toBeVisible();
  const elapsed = Date.now() - started;
  await filtered;
  await closeFilterMenu(page);
  console.log(`PEGA-89 timing: custom field filter ${elapsed} ms`);
  await expect(page.getByText("Karte 1", { exact: true })).toBeVisible();
  await expect(page.getByText("Karte 0", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Karte 2", { exact: true })).toHaveCount(0);
  test.info().annotations.push({
    type: "timing",
    description: `custom field filter over ${CARD_COUNT} cards: ${elapsed} ms`,
  });
  expect(elapsed).toBeLessThan(BUDGET_MS);

  // Combined with the label "Kampagne A" → even cards with P2 (166 cards).
  const labelStarted = await pickFilter(page, "Labels", /^Kampagne A\b/);
  await expect(shownCount(page, "166 tasks")).toBeVisible();
  const labelElapsed = Date.now() - labelStarted;
  await closeFilterMenu(page);
  console.log(`PEGA-89 timing: field and label filter ${labelElapsed} ms`);
  await expect(page.getByText("Karte 4", { exact: true })).toBeVisible();
  await expect(page.getByText("Karte 1", { exact: true })).toHaveCount(0);
  test.info().annotations.push({
    type: "timing",
    description: `field and label filter: ${labelElapsed} ms`,
  });
  expect(labelElapsed).toBeLessThan(BUDGET_MS);

  // Clearing the filters brings the whole board back.
  await page.getByRole("button", { name: "Clear all", exact: true }).click();
  await expect(shownCount(page, `${CARD_COUNT} tasks`)).toBeVisible({
    timeout: 60_000,
  });
});
