#!/usr/bin/env node
// Sets up the Pegasus board ("Bewerber-Pool") in a Kaneo workspace from
// board.json: project, columns, workspace labels and custom fields. Safe to
// run again; it only applies what differs. See docs/board-einrichtung.md.
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { applyAction } from "./apply-action.mjs";
import { describeAction } from "./describe-action.mjs";
import { createKaneoClient } from "./kaneo-client.mjs";
import { planColumns, wantedColumnIds } from "./plan-columns.mjs";
import { planFields, wantedFieldIds } from "./plan-fields.mjs";
import { planLabels } from "./plan-labels.mjs";
import { planOrder } from "./plan-order.mjs";
import { planProject } from "./plan-project.mjs";

const USAGE = `Aufruf:
  KANEO_API_URL=https://kaneo.example.de KANEO_API_KEY=… \\
    pnpm board:setup --workspace <workspace-id> [--dry-run] [--spec board.json] [--ids-out ids.json]

  --workspace  ID des Workspace (oder KANEO_WORKSPACE_ID)
  --dry-run    nur anzeigen, was sich ändern würde
  --spec       Vorgabe-Datei (Standard: scripts/board-setup/board.json)
  --ids-out    schreibt Projekt-, Spalten-, Label- und Feld-IDs als JSON (für den Hub)`;

const { values: args } = parseArgs({
  options: {
    workspace: { type: "string" },
    spec: {
      type: "string",
      default: join(dirname(fileURLToPath(import.meta.url)), "board.json"),
    },
    "dry-run": { type: "boolean", default: false },
    "ids-out": { type: "string" },
    help: { type: "boolean", default: false },
  },
});

const workspaceId = args.workspace ?? process.env.KANEO_WORKSPACE_ID;
const apiKey = process.env.KANEO_API_KEY;
const baseUrl = process.env.KANEO_API_URL ?? "http://localhost:1337";
const dryRun = args["dry-run"];

if (args.help || !workspaceId || !apiKey) {
  console.log(USAGE);
  if (!args.help) {
    const missing = [
      !workspaceId && "--workspace (oder KANEO_WORKSPACE_ID)",
      !apiKey && "KANEO_API_KEY",
    ].filter(Boolean);
    console.error(`\nFehlt: ${missing.join(", ")}.`);
  }
  process.exit(args.help ? 0 : 2);
}

const spec = JSON.parse(await readFile(args.spec, "utf8"));
const client = createKaneoClient({ baseUrl, apiKey });

function report({ actions = [], warnings = [] }) {
  for (const action of actions) console.log(`  ${describeAction(action)}`);
  for (const warning of warnings) console.log(`  ! ${warning}`);
}

async function apply(actions, context) {
  for (const action of actions) {
    const result = await applyAction(client, action, context);
    console.log(`  ${describeAction(action)}`);
    if (result?.warning) console.log(`  ! ${result.warning}`);
  }
}

function reorderAction(type, wantedIds, current) {
  const order = planOrder(wantedIds, current);
  return order ? [{ type, order }] : [];
}

const getColumns = (projectId) => client.get(`/column/${projectId}`);
const getFields = async (projectId) =>
  (await client.get(`/custom-field/project/${projectId}`)).sort(
    (a, b) => a.position - b.position,
  );

async function main() {
  console.log(
    `Kaneo: ${baseUrl} · Workspace ${workspaceId}${dryRun ? " · Probelauf" : ""}`,
  );

  // Plan everything before the first write, so a conflict stops the run early.
  const projects = await client.get(
    `/project?workspaceId=${encodeURIComponent(workspaceId)}&includeArchived=true`,
  );
  const projectPlan = planProject(spec.project, projects);
  if (projectPlan.error) {
    console.error(`Abbruch: ${projectPlan.error}`);
    process.exit(1);
  }

  let projectId = projectPlan.project?.id;
  const labels = await client.get(`/label/workspace/${workspaceId}`);
  const labelPlan = planLabels(spec.labels, labels);
  const columns = projectId ? await getColumns(projectId) : [];
  const fields = projectId ? await getFields(projectId) : [];
  const fieldPlan = planFields(spec.fields, fields);

  if (fieldPlan.errors.length > 0) {
    for (const error of fieldPlan.errors) console.error(`Abbruch: ${error}`);
    process.exit(1);
  }

  if (dryRun) {
    console.log(`\nProjekt „${spec.project.name}“ (${spec.project.slug})`);
    report(
      projectPlan.action
        ? { actions: [projectPlan.action] }
        : { warnings: projectPlan.warnings },
    );
    if (projectPlan.action) {
      console.log(
        "  (neues Projekt: Kaneos Standardspalten werden danach entfernt)",
      );
    }
    console.log("\nSpalten");
    const columnPlan = planColumns(spec.columns, columns);
    report({
      ...columnPlan,
      actions: [
        ...columnPlan.actions,
        ...reorderAction(
          "reorder-column",
          wantedColumnIds(spec.columns, columns),
          columns,
        ),
      ],
    });
    console.log("\nLabels");
    report(labelPlan);
    console.log("\nFelder");
    report({
      ...fieldPlan,
      actions: [
        ...fieldPlan.actions,
        ...reorderAction(
          "reorder-field",
          wantedFieldIds(spec.fields, fields),
          fields,
        ),
      ],
    });
    console.log("\nProbelauf: nichts geschrieben.");
    return;
  }

  let changes = 0;
  console.log(`\nProjekt „${spec.project.name}“ (${spec.project.slug})`);
  if (projectPlan.action) {
    const created = await applyAction(client, projectPlan.action, {
      workspaceId,
    });
    projectId = created.id;
    console.log(`  ${describeAction(projectPlan.action)}`);
    changes += 1;
  } else {
    report({ warnings: projectPlan.warnings });
  }
  const context = { workspaceId, projectId };

  // Columns are read again: a new project starts with Kaneo's default columns.
  console.log("\nSpalten");
  const columnPlan = planColumns(spec.columns, await getColumns(projectId));
  await apply(columnPlan.actions, context);
  report({ warnings: columnPlan.warnings });
  const columnsNow = await getColumns(projectId);
  const columnOrder = reorderAction(
    "reorder-column",
    wantedColumnIds(spec.columns, columnsNow),
    columnsNow,
  );
  await apply(columnOrder, context);
  changes += columnPlan.actions.length + columnOrder.length;

  console.log("\nLabels");
  await apply(labelPlan.actions, context);
  report({ warnings: labelPlan.warnings });
  changes += labelPlan.actions.length;

  console.log("\nFelder");
  await apply(fieldPlan.actions, context);
  report({ warnings: fieldPlan.warnings });
  const fieldsNow = await getFields(projectId);
  const fieldOrder = reorderAction(
    "reorder-field",
    wantedFieldIds(spec.fields, fieldsNow),
    fieldsNow,
  );
  await apply(fieldOrder, context);
  changes += fieldPlan.actions.length + fieldOrder.length;

  console.log(
    changes === 0
      ? "\nKeine Änderungen."
      : `\n${changes} Änderung(en) angewendet.`,
  );

  if (args["ids-out"]) {
    const finalColumns = await getColumns(projectId);
    const finalLabels = (
      await client.get(`/label/workspace/${workspaceId}`)
    ).filter(
      (l) => l.taskId === null && spec.labels.some((s) => s.name === l.name),
    );
    const finalFields = await getFields(projectId);
    const ids = {
      workspaceId,
      projectId,
      columns: finalColumns.map(({ id, name, slug, isFinal }) => ({
        id,
        name,
        slug,
        isFinal,
      })),
      labels: finalLabels.map(({ id, name }) => ({ id, name })),
      fields: finalFields.map(({ id, name, type }) => ({ id, name, type })),
    };
    await writeFile(args["ids-out"], `${JSON.stringify(ids, null, 2)}\n`);
    console.log(`IDs geschrieben: ${args["ids-out"]}`);
  }
}

try {
  await main();
} catch (error) {
  console.error(`\nFehler: ${error.message}`);
  process.exit(1);
}
