// Pegasus fork (PEGA-89): dev-only bulk seed of numbered lead cards with
// custom field values and labels into an existing project, for the filter
// story and for trying the board together with the Hub.
//
//   pnpm --filter @kaneo/api db:seed:cards -- --project <projectId> [--count 1000] [--prefix Karte]
//
// Re-running removes the cards with the same prefix first.
import { asc, eq, max } from "drizzle-orm";
import db, { getDatabasePool, schema } from "../src/database";
import { deleteCards, insertCards } from "./seed-cards/insert-cards";

if (process.env.NODE_ENV === "production") {
  console.error("Refusing to seed: NODE_ENV is production.");
  process.exit(1);
}

function argument(name: string, fallback?: string) {
  const index = process.argv.indexOf(`--${name}`);
  const value = index === -1 ? undefined : process.argv[index + 1];
  return value ?? fallback;
}

const projectId = argument("project");
const count = Number(argument("count", "1000"));
const prefix = argument("prefix", "Karte") as string;
if (!projectId || !Number.isInteger(count) || count < 1) {
  console.error(
    "Usage: db:seed:cards -- --project <projectId> [--count 1000] [--prefix Karte]",
  );
  process.exit(1);
}

const [project] = await db
  .select({
    id: schema.projectTable.id,
    workspaceId: schema.projectTable.workspaceId,
  })
  .from(schema.projectTable)
  .where(eq(schema.projectTable.id, projectId));
if (!project) {
  console.error(`Project ${projectId} not found.`);
  process.exit(1);
}
const columns = await db
  .select({ id: schema.columnTable.id, slug: schema.columnTable.slug })
  .from(schema.columnTable)
  .where(eq(schema.columnTable.projectId, projectId))
  .orderBy(asc(schema.columnTable.position), asc(schema.columnTable.id));
if (columns.length === 0) {
  console.error("The project has no columns.");
  process.exit(1);
}

const removed = await deleteCards(db, projectId, prefix);
const [{ highest }] = await db
  .select({ highest: max(schema.taskTable.number) })
  .from(schema.taskTable)
  .where(eq(schema.taskTable.projectId, projectId));
const { cards } = await insertCards(db, {
  projectId,
  workspaceId: project.workspaceId,
  columns,
  count,
  prefix,
  startNumber: (highest ?? 0) + 1,
});
console.log(
  `Removed ${removed} old cards, inserted ${cards.length} cards "${prefix} 0…${cards.length - 1}" with fields Paket, PLZ, Quelle and label "Kampagne A" on even cards.`,
);
await getDatabasePool().end();
