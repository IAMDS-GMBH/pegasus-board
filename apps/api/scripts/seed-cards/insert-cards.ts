// Pegasus fork (PEGA-89): bulk-inserts generated cards with their custom
// field values and labels. Shared by the integration tests and `db:seed:cards`.
import { and, eq, inArray } from "drizzle-orm";
import type db from "../../src/database";
import { schema } from "../../src/database";
import { CARD_FIELDS, CARD_LABEL, generateCards } from "./generate-cards";

type Database = typeof db;

export type InsertCardsOptions = {
  projectId: string;
  workspaceId: string;
  columns: ReadonlyArray<{ id: string; slug: string }>;
  count: number;
  prefix?: string;
  startNumber?: number;
  assigneeFor?: (index: number) => string | undefined;
};

export type InsertedCard = {
  id: string;
  index: number;
  title: string;
  status: string;
};

const CHUNK = 500;

function chunks<T>(rows: T[]) {
  const result: T[][] = [];
  for (let start = 0; start < rows.length; start += CHUNK)
    result.push(rows.slice(start, start + CHUNK));
  return result;
}

export async function ensureCardFields(database: Database, projectId: string) {
  const existing = await database
    .select({
      id: schema.customFieldDefinitionTable.id,
      name: schema.customFieldDefinitionTable.name,
    })
    .from(schema.customFieldDefinitionTable)
    .where(eq(schema.customFieldDefinitionTable.projectId, projectId));
  const ids = new Map(existing.map((field) => [field.name, field.id]));
  const missing = CARD_FIELDS.filter((field) => !ids.has(field.name));
  if (missing.length) {
    const inserted = await database
      .insert(schema.customFieldDefinitionTable)
      .values(
        missing.map((field, position) => ({
          projectId,
          name: field.name,
          type: field.type,
          required: false,
          options: field.options,
          position: existing.length + position,
        })),
      )
      .returning({
        id: schema.customFieldDefinitionTable.id,
        name: schema.customFieldDefinitionTable.name,
      });
    for (const field of inserted) ids.set(field.name, field.id);
  }
  return ids;
}

export async function insertCards(
  database: Database,
  options: InsertCardsOptions,
) {
  const prefix = options.prefix ?? "Karte";
  const startNumber = options.startNumber ?? 1;
  const cards = generateCards(options.count, options.columns.length, prefix);
  const fieldIds = await ensureCardFields(database, options.projectId);

  const inserted: InsertedCard[] = [];
  for (const batch of chunks(cards)) {
    const rows = await database
      .insert(schema.taskTable)
      .values(
        batch.map((card) => {
          const column = options.columns[card.columnIndex];
          const assignee = options.assigneeFor?.(card.index);
          return {
            projectId: options.projectId,
            title: card.title,
            description: "",
            priority: "medium",
            status: column.slug,
            columnId: column.id,
            number: startNumber + card.index,
            position: card.index,
            ...(assignee ? { userId: assignee } : {}),
          };
        }),
      )
      .returning({
        id: schema.taskTable.id,
        title: schema.taskTable.title,
        status: schema.taskTable.status,
      });
    rows.forEach((row, offset) => {
      inserted.push({ ...row, index: batch[offset].index });
    });
  }

  const byIndex = new Map(inserted.map((card) => [card.index, card.id]));
  const valueRows = cards.flatMap((card) =>
    CARD_FIELDS.map((field) => ({
      taskId: byIndex.get(card.index) as string,
      fieldId: fieldIds.get(field.name) as string,
      value: card.values[field.name],
    })),
  );
  for (const batch of chunks(valueRows))
    await database.insert(schema.customFieldValueTable).values(batch);

  const labelRows = cards
    .filter((card) => card.labeled)
    .map((card) => ({
      workspaceId: options.workspaceId,
      taskId: byIndex.get(card.index) as string,
      name: CARD_LABEL.name,
      color: CARD_LABEL.color,
    }));
  for (const batch of chunks(labelRows))
    await database.insert(schema.labelTable).values(batch);

  return { cards: inserted, fieldIds };
}

/** Removes cards created by `insertCards` with the same prefix (dev script). */
export async function deleteCards(
  database: Database,
  projectId: string,
  prefix = "Karte",
) {
  const titles = await database
    .select({ id: schema.taskTable.id, title: schema.taskTable.title })
    .from(schema.taskTable)
    .where(eq(schema.taskTable.projectId, projectId));
  const pattern = new RegExp(
    `^${prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} \\d+$`,
  );
  const ids = titles
    .filter((task) => pattern.test(task.title))
    .map((t) => t.id);
  for (const batch of chunks(ids))
    await database
      .delete(schema.taskTable)
      .where(
        and(
          eq(schema.taskTable.projectId, projectId),
          inArray(schema.taskTable.id, batch),
        ),
      );
  return ids.length;
}
